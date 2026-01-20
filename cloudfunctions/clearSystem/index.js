// cloud function: clearSystem
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-2gn42bha8f90b918' });

exports.main = async (event, context) => {
  const db = cloud.database();
  const transaction = await db.startTransaction();

  try {
    // 1. 清空 Announcements 数据库
    await transaction.collection('Announcements').remove();

    // 2. 清空 Stu 数据库
    await transaction.collection('Stu').remove();

    // 3. 清空 Teacher 数据库
    await transaction.collection('Teacher').remove();

    // 4. 重置 TotalQuota 数据库
    const totalQuotaData = await transaction.collection('TotalQuota').get();

    // 对 TotalQuota 数据库中的每个记录进行处理
    const updatePromises = totalQuotaData.data.map(item => {
      const updateData = {};

      // 需要重置为 999 的字段
      const fieldsToSetTo999 = [
        'dqgcpartTime_total', 'dqgcsoldier_total',
        'dzxxpartTime_total', 'dzxxsoldier_total'
      ];

      // 需要重置为 0 的字段
      const fieldsToSetTo0 = [
        'dqgclp_current', 'dqgclp_total',
        'dqgcpartTime_current', 'dqgcxs_current',
        'dqgczs_current', 'dqgclp_total',
        'dqgcsoldier_current', 
        'dqgcxs_total', 'dqgczs_total',
        'dxxzlp_current', 'dxxzlp_total',
        'dzxxpartTime_current', 
        'dzxxsoldier_current', 
        'dzxxzs_current', 'dzxxzs_total',
        'kongzhiX_current', 'kongzhiX_total'
      ];

      // 设置为 999 的字段
      fieldsToSetTo999.forEach(field => {
        if (item[field] !== 999 && !isNaN(item[field])) {
          updateData[field] = 999; // 设置为 999
        }
      });

      // 设置为 0 的字段
      fieldsToSetTo0.forEach(field => {
        if (item[field] !== 999 && !isNaN(item[field])) {
          updateData[field] = 0; // 设置为 0
        }
      });

      // 如果有需要更新的字段，执行更新操作
      if (Object.keys(updateData).length > 0) {
        return transaction.collection('TotalQuota').doc(item._id).update({
          data: updateData
        });
      }
    });

    // 等待所有字段更新操作完成
    await Promise.all(updatePromises);

    // 提交事务
    await transaction.commit();

    return {
      success: true,
      message: '系统已清空'
    };

  } catch (err) {
    // 如果有任何错误，回滚事务
    await transaction.rollback();
    return {
      success: false,
      message: err.message
    };
  }
};
