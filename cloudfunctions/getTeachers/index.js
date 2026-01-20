// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-2gn42bha8f90b918' }) // 使用当前云环境
const db = cloud.database();
const _=db.command

exports.main = async (event, context) => {
  const { page = 1, pageSize = 20,fields } = event;
  const skip = (page - 1) * pageSize;

  try {
    let query = db.collection('Teacher')

    // 动态构建查询条件：至少一个字段的值大于 0
    if (fields && fields.length > 0) {
      const conditions = fields.map(field => ({
        [field]: _.gt(0)  // 使用数据库操作符 _.gt 表示大于 0
      }))
      query = query.where(_.or(...conditions))  // 使用 _.or 组合条件
    }

    // 执行分页查询
    const res = await query
      .skip(skip)
      .limit(pageSize)
      .get()

    return {
      success: true,
      data: res.data
    }
  } catch (err) {
    return {
      success: false,
      message: '查询失败',
      error: err
    }
  }
};