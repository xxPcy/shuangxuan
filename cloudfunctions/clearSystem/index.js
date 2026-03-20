// cloud function: clearSystem
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-2gn42bha8f90b918' });

exports.main = async (event, context) => {
  const db = cloud.database();

  try {
    // 1. 清空 Announcements 数据库
    await db.collection('Announcements').where({
      _id: db.command.exists(true)
    }).remove();

    // 2. 清空 Stu 数据库
    await db.collection('Stu').where({
      _id: db.command.exists(true)
    }).remove();

    // 3. 清空 Teacher 数据库
    await db.collection('Teacher').where({
      _id: db.command.exists(true)
    }).remove();

    // 4. 清空 逻辑表 数据库
    await db.collection('Logic').where({
      _id: db.command.exists(true)
    }).remove();

    // 5. 重置 Total 集合（删除 level1_quota, level2_quota, level3_quota 字段）
    await db.collection('TotalQuota').where({
      _id: db.command.exists(true) // 假设处理 Total 集合中所有文档，如果没有特殊条件
    }).update({
      data: {
        level1_quota: db.command.remove(),
        level2_quota: db.command.remove(),
        level3_quota: db.command.remove()
      }
    });

    // 6. 重置 QuotaHolders 集合（删除 level1_holders, level2_holders, level3_holders 字段）
    await db.collection('QuotaHolders').where({
      _id: db.command.exists(true) // 假设处理 QuotaHolders 集合中所有文档
    }).update({
      data: {
        level1_holders: db.command.remove(),
        level2_holders: db.command.remove(),
        level3_holders: db.command.remove()
      }
    });
    // 4. 清空 退回指标 数据库
    await db.collection('RejectedQuota').where({
      _id: db.command.exists(true)
    }).remove();


    return {
      success: true,
      message: '系统已清空'
    };

  } catch (err) {
    console.error('清空系统失败:', err);
    return {
      success: false,
      message: err.message
    };
  }
};
