// 云函数入口文件
// 根据学生三级专业代码从 QuotaHolders 中获取导师列表（支持占用/不占用指标）

const cloud = require('wx-server-sdk');

cloud.init({ env: 'cloud1-2gn42bha8f90b918' });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const {
    specializedCode, // 学生三级专业代码
    page = 1,
    pageSize = 20,
    useQuota = false // true: 占用指标（只看已审批可用名额）；false: 不占用指标（看历史分配链路）
  } = event;

  const rawSpecializedCode = String(specializedCode || '').trim();
  const codeMatches = (targetCode) => {
    const rawTargetCode = String(targetCode || '').trim();
    if (!rawTargetCode) return false;
    return rawSpecializedCode.startsWith(rawTargetCode);
  };

  if (!rawSpecializedCode) {
    return {
      success: false,
      message: '缺少三级专业代码',
      data: []
    };
  }

  try {
    const quotaHoldersRes = await db.collection('QuotaHolders').doc('quotaholder').get();
    if (!quotaHoldersRes.data) {
      return {
        success: false,
        message: 'QuotaHolders 数据不存在',
        data: []
      };
    }

    const quotaHolders = quotaHoldersRes.data;
    const level1Holders = quotaHolders.level1_holders || {};
    const level2Holders = quotaHolders.level2_holders || {};
    const level3Holders = quotaHolders.level3_holders || {};

    // 1) 按专业代码前缀聚合“曾经被分配过该专业链路”的导师候选池
    const candidateMap = new Map(); // teacherId -> { teacherId, teacherName, historyQuota }

    const collectFromLevel = (holders) => {
      Object.keys(holders).forEach((code) => {
        if (!codeMatches(code)) return;
        const teacherList = holders[code] || [];
        teacherList.forEach((t) => {
          const teacherId = String(t.teacherId || '').trim();
          if (!teacherId) return;
          if (!candidateMap.has(teacherId)) {
            candidateMap.set(teacherId, {
              teacherId,
              teacherName: t.teacherName || '',
              historyQuota: 0
            });
          }
          const item = candidateMap.get(teacherId);
          item.historyQuota += Number(t.quota || 0);
        });
      });
    };

    collectFromLevel(level1Holders);
    collectFromLevel(level2Holders);
    collectFromLevel(level3Holders);

    const historyTeacherIdSet = new Set(Array.from(candidateMap.keys()));

    // 2) 查询所有导师（避免 QuotaHolders 未同步导致漏显示）
    const totalTeachersRes = await db.collection('Teacher').count();
    const totalTeachers = totalTeachersRes.total || 0;
    const batchSize = 100;
    let allTeachers = [];
    for (let i = 0; i < totalTeachers; i += batchSize) {
      const teacherRes = await db.collection('Teacher')
        .skip(i)
        .limit(batchSize)
        .get();
      allTeachers = allTeachers.concat(teacherRes.data || []);
    }

    // 3) 计算当前可用名额（仅已审批）并按 level3 -> level2 -> level1 优先
    let teachersWithQuota = allTeachers.map((teacher) => {
      const quotaSettings = Array.isArray(teacher.quota_settings) ? teacher.quota_settings : [];

      const approvedByCode = new Map();
      quotaSettings.forEach((item) => {
        if (!['level1', 'level2', 'level3'].includes(item.type)) return;
        const code = String(item.code || '').trim();
        if (!codeMatches(code)) return;
        const maxQuota = Number(item.max_quota || 0);
        const usedQuota = Number(item.used_quota || 0);
        const remaining = Math.max(maxQuota - usedQuota, 0);
        approvedByCode.set(code, (approvedByCode.get(code) || 0) + remaining);
      });

      const level3Code = rawSpecializedCode.length >= 6 ? rawSpecializedCode.slice(0, 6) : '';
      const level2Code = rawSpecializedCode.length >= 4 ? rawSpecializedCode.slice(0, 4) : '';
      const level1Code = rawSpecializedCode.length >= 2 ? rawSpecializedCode.slice(0, 2) : '';
      const firstAvailableCode = [level3Code, level2Code, level1Code].find((code) => code && Number(approvedByCode.get(code) || 0) > 0) || '';
      const matchedApprovedQuota = firstAvailableCode ? Number(approvedByCode.get(firstAvailableCode) || 0) : 0;

      const teacherId = String(teacher.Id || '').trim();
      const history = candidateMap.get(teacherId);

      return {
        ...teacher,
        matchedCode: firstAvailableCode || rawSpecializedCode,
        matchedConfirmedQuota: matchedApprovedQuota,
        matchedPendingQuota: 0,
        matchedQuota: matchedApprovedQuota,
        historyQuota: history ? history.historyQuota : 0
      };
    });

    // useQuota=true: 占用指标学生，只看“已审批可用名额 > 0”
    // useQuota=false: 不占指标学生，看历史分配链路（08/0854/085410 任一命中即可）
    if (useQuota) {
      teachersWithQuota = teachersWithQuota.filter((t) => Number(t.matchedQuota || 0) > 0);
    } else {
      teachersWithQuota = teachersWithQuota.filter((t) => {
        const teacherId = String(t.Id || '').trim();
        return historyTeacherIdSet.has(teacherId);
      });
    }

    teachersWithQuota.sort((a, b) => {
      if (Number(b.matchedQuota || 0) !== Number(a.matchedQuota || 0)) {
        return Number(b.matchedQuota || 0) - Number(a.matchedQuota || 0);
      }
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    // 4) 分页
    const total = teachersWithQuota.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pagedData = teachersWithQuota.slice(start, end);

    return {
      success: true,
      data: pagedData,
      total,
      hasMore: end < total,
      page,
      pageSize
    };
  } catch (err) {
    console.error('获取导师列表失败:', err);
    return {
      success: false,
      message: '获取导师列表失败',
      error: err.message || err
    };
  }
};
