const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function normalizeTrackValue(track) {
  const raw = String(track || '全日制').trim();
  const lower = raw.toLowerCase();
  if (!raw) return '全日制';
  if (raw === '联培' || lower === 'joint') return '联培';
  if (raw === '非全日制' || raw === '非全' || lower === 'parttime') return '非全日制';
  if (raw === '士兵' || lower === 'soldier') return '士兵';
  if (raw === '全日制' || raw === '普通' || lower === 'regular') return '全日制';
  return raw;
}

exports.main = async (event, context) => {
  try {
    console.log('触发超时检测定时器:', event);

    // 【测试环境建议】：如果想立刻看到退回效果，可以把下面这行的 48 * 60 * 60 * 1000 改成 60 * 1000 (1分钟)
    const timeoutDuration = 48 * 60 * 60 * 1000; // 48小时超时
    // const timeoutDuration =  60 * 1000; // 一分钟
    const currentTimestamp = new Date().getTime();
    const pageSize = 100;

    // 用于收集批量更新到 TotalQuota 的数据
    let totalQuotaUpdates = {
      level1_quota: {},
      level2_quota: {},
      level3_quota: {}
    };
    
    let hasUpdates = false;

    // 采用更安全的 where 方式查询，防止 doc() 不存在抛出致命异常
    const totalQuotaRes = await db.collection('TotalQuota').where({ _id: 'totalquota' }).get();
    const totalQuotaData = totalQuotaRes.data && totalQuotaRes.data.length > 0 ? totalQuotaRes.data[0] : {};
    
    const baseLevel1 = totalQuotaData.level1_quota || {};
    const baseLevel2 = totalQuotaData.level2_quota || {};
    const baseLevel3 = totalQuotaData.level3_quota || {};

    const modifyTotalQuotaData = (code, track, pendingValue) => {
       const codeStr = String(code || '');
       let levelKey = 'level3_quota';
       let levelObj = totalQuotaUpdates.level3_quota;
       let baseObj = baseLevel3;
       
       if (codeStr.length <= 2) {
         levelKey = 'level1_quota';
         levelObj = totalQuotaUpdates.level1_quota;
         baseObj = baseLevel1;
       } else if (codeStr.length <= 4) {
         levelKey = 'level2_quota';
         levelObj = totalQuotaUpdates.level2_quota;
         baseObj = baseLevel2;
       }

       const normTrack = normalizeTrackValue(track);
       const compositeKey = codeStr + '__' + normTrack;
       const fallbackKey = (normTrack === '全日制' && baseObj[codeStr]) ? codeStr : compositeKey;

       if (!levelObj[fallbackKey]) {
          levelObj[fallbackKey] = {
             ...(baseObj[fallbackKey] || { code: codeStr, track: normTrack, pending_approval: 0, name: codeStr })
          };
       }
       // 累加退回的待审指标
       levelObj[fallbackKey].pending_approval = Number(levelObj[fallbackKey].pending_approval || 0) + pendingValue;
       hasUpdates = true;
    };

    let lastId = null; // 用于可靠的游标分页游走

    while (true) {
      let query = { approval_status: 'pending' };
      if (lastId) {
        query._id = _.gt(lastId); // 取大于上一次最后ID的记录
      }

      const teacherRes = await db.collection('Teacher')
        .where(query)
        .orderBy('_id', 'asc') // 强制按_id排序，保证游标稳定
        .limit(pageSize)
        .get();

      if (!teacherRes.data || teacherRes.data.length === 0) {
        console.log('本轮循环完毕，没有更多待排查导师了。');
        break;
      }

      for (const teacher of teacherRes.data) {
        lastId = teacher._id; // 记录当页最后一个处理过的导师的ID

        console.log('正在检查导师是否超时: ' + teacher.name + ', ID: ' + teacher._id);
        const approvalTimestamp = teacher.approval_timestamp || 0;
        const elapsedTime = approvalTimestamp ? currentTimestamp - approvalTimestamp : timeoutDuration + 1;
        
        if (elapsedTime <= timeoutDuration) {
           console.log('该导师尚未超时，跳过处理。');
           continue;
        }

        let newQuotaSettings = teacher.quota_settings || [];
        let didModify = false;
        const rejectedRecords = [];

        newQuotaSettings = newQuotaSettings.map(item => {
           if (Number(item.pending_quota || 0) > 0) {
              const pendingValue = Number(item.pending_quota);
              console.log('检测到超时未审批指标! 专业代码: ' + item.code + ' 退回数量: ' + pendingValue);
              
              modifyTotalQuotaData(item.code, item.track, pendingValue);
              
              rejectedRecords.push({
                 teacherName: teacher.name,
                 teacherId: teacher.Id,
                 label: item.name || item.code,
                 key: item.code,
                 track: normalizeTrackValue(item.track),
                 rejectedValue: pendingValue,
                 reason: '超过48小时未处理，系统自动退回',
                 timestamp: new Date()
              });

              didModify = true;
              return { ...item, pending_quota: 0 };
           }
           return item;
        });

        if (didModify) {
            await db.collection('Teacher').doc(teacher._id).update({
               data: {
                  quota_settings: newQuotaSettings,
                  approval_status: 'rejected'
               }
            });

            if (rejectedRecords.length > 0) {
               for (const record of rejectedRecords) {
                  await db.collection('RejectedQuota').add({ data: record });
               }
            }
        } else {
             await db.collection('Teacher').doc(teacher._id).update({
               data: { approval_status: 'rejected' }
            });
        }
      }
    }

    // 集中式写回 TotalQuota
    if (hasUpdates && Object.keys(totalQuotaData).length > 0) {
       console.log('开始批量将退回后的指标更新至指标大总表 ...');
       const finalUpdateData = { last_updated: new Date().getTime() };
       
       if (Object.keys(totalQuotaUpdates.level1_quota).length > 0) {
           for(let k in totalQuotaUpdates.level1_quota) {
               finalUpdateData['level1_quota.' + k] = totalQuotaUpdates.level1_quota[k];
           }
       }
       if (Object.keys(totalQuotaUpdates.level2_quota).length > 0) {
           for(let k in totalQuotaUpdates.level2_quota) {
               finalUpdateData['level2_quota.' + k] = totalQuotaUpdates.level2_quota[k];
           }
       }
       if (Object.keys(totalQuotaUpdates.level3_quota).length > 0) {
           for(let k in totalQuotaUpdates.level3_quota) {
               finalUpdateData['level3_quota.' + k] = totalQuotaUpdates.level3_quota[k];
           }
       }

       if (Object.keys(finalUpdateData).length > 1) {
           await db.collection('TotalQuota').doc('totalquota').update({
               data: finalUpdateData
           });
           console.log('系统指标大池退回更新成功!');
       }
    }

    console.log('全部超时自动审批处理已完成。');
    return { success: true };

  } catch (error) {
    console.error('运行超时检查自动退回程序时出现异常:', error);
    return { success: false, error: error.message };
  }
};
