// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;

  try {
    // 1. 获取所有专业逻辑 (作为骨架)
    // 假设 Logic 表数据量不大(几百条以内)，一次取完；如果很大需分批
    const logicRes = await db.collection('Logic').limit(1000).get();
    const logicList = logicRes.data;

    // 2. 初始化统计 Map (Code -> 统计对象)
    const statsMap = {};
    logicList.forEach(item => {
      // 找出每一行里的一级、二级、三级代码，初始化统计数据
      // 注意：Logic表是扁平的，一行可能包含3个层级，我们需要分别提取
      
      const levels = [
        { c: item.level1_code, n: item.level1_name, t: 'level1' },
        { c: item.level2_code, n: item.level2_name, t: 'level2' },
        { c: item.level3_code, n: item.level3_name, t: 'level3' }
      ];

      levels.forEach(lvl => {
        if (lvl.c && !statsMap[lvl.c]) {
          statsMap[lvl.c] = {
            code: String(lvl.c).trim(),
            name: String(lvl.n).trim(),
            type: lvl.t,
            max_total: 0,
            pending_total: 0,
            used_total: 0
          };
        }
      });
    });

    // 3. 获取所有导师的 quota_settings (只取这个字段，减少流量)
    // 如果导师很多，这里需要分批拉取，这里暂时写简易版
    const countRes = await db.collection('Teacher').count();
    const batchTimes = Math.ceil(countRes.total / 100);
    let allTeacherQuotas = [];
    
    for (let i = 0; i < batchTimes; i++) {
      const res = await db.collection('Teacher')
        .skip(i * 100)
        .limit(100)
        .field({ quota_settings: 1 }) // 只查这个字段
        .get();
      allTeacherQuotas = allTeacherQuotas.concat(res.data);
    }

    // 4. 聚合计算
    allTeacherQuotas.forEach(teacher => {
      if (teacher.quota_settings && Array.isArray(teacher.quota_settings)) {
        teacher.quota_settings.forEach(quota => {
          const target = statsMap[quota.code];
          if (target) {
            target.max_total += (quota.max_quota || 0);
            target.pending_total += (quota.pending_quota || 0);
            target.used_total += (quota.used_quota || 0);
          }
        });
      }
    });

    // 5. 转回数组并排序
    const resultList = Object.values(statsMap).sort((a, b) => {
      return a.code.localeCompare(b.code);
    });

    return { success: true, data: resultList };

  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};