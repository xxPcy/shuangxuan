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
    useQuota = false // false: 占用指标，只看当前有可用名额；true: 不占用指标，可看曾经分配过该专业链路名额的老师
  } = event;

  const rawSpecializedCode = String(specializedCode || '').trim();
  const normalizeCode = (code) => {
    const text = String(code || '').trim();
    if (!text) return '';
    if (!/^\d+$/.test(text)) return text;
    const normalized = text.replace(/^0+/, '');
    return normalized || '0';
  };
  const normalizedSpecializedCode = normalizeCode(rawSpecializedCode);
  const codeMatches = (targetCode) => {
    const rawTargetCode = String(targetCode || '').trim();
    if (!rawTargetCode) return false;
    if (rawSpecializedCode.startsWith(rawTargetCode)) return true;

    const normalizedTargetCode = normalizeCode(rawTargetCode);
    if (!normalizedSpecializedCode || !normalizedTargetCode) return false;
    return normalizedSpecializedCode.startsWith(normalizedTargetCode);
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

    // 3) 计算当前可用名额（confirmedRemaining + pending）
    let teachersWithQuota = allTeachers.map((teacher) => {
      const quotaSettings = Array.isArray(teacher.quota_settings) ? teacher.quota_settings : [];
      const matchedEntries = quotaSettings.filter((item) => {
        if (!['level1', 'level2', 'level3'].includes(item.type)) return false;
        const code = String(item.code || '');
        return codeMatches(code);
      });

      const confirmedRemainingQuota = matchedEntries.reduce((sum, item) => {
        const maxQuota = Number(item.max_quota || 0);
        const usedQuota = Number(item.used_quota || 0);
        return sum + Math.max(maxQuota - usedQuota, 0);
      }, 0);

      const pendingQuota = matchedEntries.reduce((sum, item) => {
        return sum + Number(item.pending_quota || 0);
      }, 0);

      const teacherId = String(teacher.Id || '').trim();
      const history = candidateMap.get(teacherId);

      return {
        ...teacher,
        matchedCode: rawSpecializedCode,
        matchedConfirmedQuota: confirmedRemainingQuota,
        matchedPendingQuota: pendingQuota,
        matchedQuota: confirmedRemainingQuota + pendingQuota,
        historyQuota: history ? history.historyQuota : 0
      };
    });

    // 占用指标学生：只看当前可用名额 > 0
    // 不占用指标学生(useQuota=true)：看曾经被分配过该专业链路名额的所有导师（可含0名额）
    if (!useQuota) {
      teachersWithQuota = teachersWithQuota.filter((t) => Number(t.matchedQuota || 0) > 0);
    } else {
      teachersWithQuota = teachersWithQuota.filter((t) => {
        const teacherId = String(t.Id || '').trim();
        return historyTeacherIdSet.has(teacherId) || Number(t.matchedQuota || 0) > 0;
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
