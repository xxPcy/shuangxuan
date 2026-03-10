const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-2gn42bha8f90b918' });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { teacherId } = event;
    console.log(`获取待审批数据: teacherId = ${teacherId}`);

    // const timeoutDuration = 1 * 2 * 60 * 1000; // 2分钟超时
    // const timeoutDuration = 24 * 60 * 60 * 1000;//24小时超时
    const timeoutDuration = 48 * 60 * 60 * 1000;//48小时超时
    // const timeoutDuration = 4 * 60 * 1000; // 4分钟超时

    const currentTimestamp = new Date().getTime();

    const teacherRes = await db.collection('Teacher').doc(teacherId).get();
    const teacher = teacherRes.data;

    if (!teacher) {
      console.log(`导师 ${teacherId} 不存在`);
      return { success: true, pendingChanges: [] };
    }

    // 从 quota_settings 数组中读取待审批名额
    const quotaSettings = teacher.quota_settings || [];
    const approvalTimestamp = teacher.approval_timestamp || 0;
    
    const pendingChanges = [];
    
    // 按 code 排序（一级、二级、三级代码排序）
    const sortedQuotaSettings = [...quotaSettings].sort((a, b) => {
      return (a.code || '').localeCompare(b.code || '');
    });

    for (const quota of sortedQuotaSettings) {
      const pendingValue = quota.pending_quota || 0;

      if (pendingValue > 0) {
        // 如果没有 approval_timestamp，则给予完整的超时时间
        let remainingTimeMs = timeoutDuration;
        if (approvalTimestamp) {
          const elapsedTime = currentTimestamp - approvalTimestamp;
          remainingTimeMs = timeoutDuration - elapsedTime;
        }

        if (remainingTimeMs > 0) {
          const remainingHours = Math.floor(remainingTimeMs / (60 * 60 * 1000));
          const remainingMinutes = Math.floor((remainingTimeMs % (60 * 60 * 1000)) / (60 * 1000));
          pendingChanges.push({
            label: quota.name,           // 专业名称
            code: quota.code,             // 专业代码
            type: quota.type,             // 级别类型 (level1, level2, level3)
            pendingValue: pendingValue,   // 待审批名额
            maxQuota: quota.max_quota || 0,   // 当前最大名额
            usedQuota: quota.used_quota || 0, // 已使用名额
            teacherId: teacherId,
            remainingTime: `${remainingHours}小时${remainingMinutes}分钟`
          });
        } else {
          console.log(`忽略超时名额: ${teacher.name}, ${quota.name}, 剩余时间为 0`);
        }
      }
    }

    console.log(`返回导师 ${teacherId} 的待审批数据:`, pendingChanges);
    return { success: true, pendingChanges };
  } catch (error) {
    console.error("Error in getPendingChanges:", error);
    return { success: false, error: error.message };
  }
};