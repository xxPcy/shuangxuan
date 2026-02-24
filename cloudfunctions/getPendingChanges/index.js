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

    // 仅支持基于专业代码(code)的 quota_settings 结构
    if (!Array.isArray(teacher.quota_settings) || teacher.quota_settings.length === 0) {
      return { success: true, pendingChanges: [] };
    }

    const pendingChanges = [];
    const approvalTimestamp = teacher.approval_timestamp || 0;
    const elapsedTime = approvalTimestamp ? currentTimestamp - approvalTimestamp : timeoutDuration + 1;
    const remainingTimeMs = timeoutDuration - elapsedTime;

    teacher.quota_settings
      .filter((item) => ['level1', 'level2', 'level3'].includes(item.type) && Number(item.pending_quota || 0) > 0)
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
  } catch (error) {
    console.error('Error in getPendingChanges:', error);
    return { success: false, error: error.message };
  }
};
