const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-2gn42bha8f90b918' }) // 使用当前云环境
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { teacherId, code, track, validValue, label } = event
  const matchTrack = track || 'regular';

  return await db.runTransaction(async transaction => {
    // 获取导师数据
    const teacherData = (await transaction.collection('Teacher').doc(teacherId).get()).data
    const quotaSettings = teacherData.quota_settings || [];

    // 找到对应的 quota_settings 条目（按 code + track 匹配）
    const quotaIndex = quotaSettings.findIndex(q => 
      q.code === code && (q.track || 'regular') === matchTrack
    );
    
    if (quotaIndex === -1) {
      throw new Error(`未找到对应名额配置: code=${code}, track=${matchTrack}`);
    }

    const quota = quotaSettings[quotaIndex];
    const quotaType = quota.type; // level1, level2, level3

    // 清空 pending_quota
    const newQuotaSettings = [...quotaSettings];
    newQuotaSettings[quotaIndex] = {
      ...newQuotaSettings[quotaIndex],
      pending_quota: 0
    };

    await transaction.collection('Teacher').doc(teacherId).update({
      data: {
        quota_settings: newQuotaSettings
      }
    })

    // 退回名额到 TotalQuota
    const quotaFieldMap = {
      'level1': 'level1_quota',
      'level2': 'level2_quota', 
      'level3': 'level3_quota'
    };
    const quotaField = quotaFieldMap[quotaType];
    const quotaKey = `${code}|${matchTrack}`;

    if (quotaField) {
      const totalQuotaRes = await transaction.collection('TotalQuota').doc('totalquota').get();
      const levelQuota = totalQuotaRes.data[quotaField] || {};
      const codeQuota = levelQuota[quotaKey] || levelQuota[code] || {};
      const actualKey = levelQuota[quotaKey] ? quotaKey : code;

      await transaction.collection('TotalQuota').doc('totalquota').update({
        data: {
          [`${quotaField}.${actualKey}.pending_approval`]: (codeQuota.pending_approval || 0) + validValue
        }
      })
    }

    // 记录拒绝信息
    await transaction.collection('RejectedQuota').add({
      data: {
        teacherName: teacherData.name,
        teacherId: teacherData.Id,
        code: code,
        track: matchTrack,
        label: label || quota.name,
        rejectedValue: validValue,
        reason: '主动拒绝',
        timestamp: new Date()
      }
    })
  })
}
