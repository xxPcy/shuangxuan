const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-2gn42bha8f90b918' });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { teacherId } = event;
    console.log(`获取待审批数据: teacherId = ${teacherId}`);

    const timeoutDuration = 48 * 60 * 60 * 1000; // 48小时超时
    const currentTimestamp = new Date().getTime();

    const teacherRes = await db.collection('Teacher').doc(teacherId).get();
    const teacher = teacherRes.data;

    if (!teacher) {
      return { success: true, pendingChanges: [] };
    }

    // 优先使用基于 Logic 初始化的 quota_settings 结构
    if (Array.isArray(teacher.quota_settings) && teacher.quota_settings.length > 0) {
      const pendingChanges = [];
      const approvalTimestamp = teacher.approval_timestamp || 0;
      const elapsedTime = approvalTimestamp ? currentTimestamp - approvalTimestamp : timeoutDuration + 1;
      const remainingTimeMs = timeoutDuration - elapsedTime;

      teacher.quota_settings
        .filter((item) => item.type === 'level3' && Number(item.pending_quota || 0) > 0)
        .forEach((item) => {
          if (remainingTimeMs > 0) {
            const remainingHours = Math.floor(remainingTimeMs / (60 * 60 * 1000));
            const remainingMinutes = Math.floor((remainingTimeMs % (60 * 60 * 1000)) / (60 * 1000));
            pendingChanges.push({
              label: item.name || item.code,
              key: item.code,
              pendingValue: Number(item.pending_quota || 0),
              teacherId,
              remainingTime: `${remainingHours}小时${remainingMinutes}分钟`
            });
          }
        });

      return { success: true, pendingChanges };
    }

    // 兼容旧版硬编码字段
    const quotaCategories = [
      { label: '电子信息（专硕）', key: 'dzxxzs' },
      { label: '控制科学与工程（学硕）', key: 'kongzhiX' },
      { label: '电气工程（专硕）', key: 'dqgczs' },
      { label: '电气工程（学硕）', key: 'dqgcxs' },
      { label: '电子信息（联培）', key: 'dzxxlp' },
      { label: '电气工程（联培）', key: 'dqgclp' },
      { label: '电子信息(士兵计划)', key: 'dzxxsoldier' },
      { label: '电子信息(非全日制)', key: 'dzxxpartTime' },
      { label: '电气工程(士兵计划)', key: 'dqgcsoldier' },
      { label: '电气工程(非全日制)', key: 'dqgcpartTime' }
    ];

    if (teacher.approval_status !== 'pending') {
      return { success: true, pendingChanges: [] };
    }

    const pendingChanges = [];
    for (const category of quotaCategories) {
      const pendingKey = `pending_${category.key}`;
      const pendingValue = teacher[pendingKey] || 0;
      const approvalTimestamp = teacher.approval_timestamp || 0;

      if (pendingValue > 0) {
        const elapsedTime = approvalTimestamp ? currentTimestamp - approvalTimestamp : timeoutDuration + 1;
        const remainingTimeMs = timeoutDuration - elapsedTime;

        if (remainingTimeMs > 0) {
          const remainingHours = Math.floor(remainingTimeMs / (60 * 60 * 1000));
          const remainingMinutes = Math.floor((remainingTimeMs % (60 * 60 * 1000)) / (60 * 1000));
          pendingChanges.push({
            label: category.label,
            key: category.key,
            pendingValue,
            teacherId,
            remainingTime: `${remainingHours}小时${remainingMinutes}分钟`
          });
        }
      }
    }

    return { success: true, pendingChanges };
  } catch (error) {
    console.error('Error in getPendingChanges:', error);
    return { success: false, error: error.message };
  }
};
