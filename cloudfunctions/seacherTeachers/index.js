// // 云函数入口文件
// const cloud = require('wx-server-sdk')

// cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
// const db = cloud.database(); // 初始化数据库

// // 云函数入口函数
// exports.main = async (event, context) => {
//   const { page = 1, pageSize = 20 } = event;
//   const skip = (page - 1) * pageSize;
  
//   try {
//     const res = await db.collection('teachers')
//       .skip(skip)
//       .limit(pageSize)
//       .get();
      
//     return {
//       success: true,
//       data: res.data
//     };
//   } catch (err) {
//     return {
//       success: false,
//       message: '查询失败',
//       error: err
//     };
//   }
// };