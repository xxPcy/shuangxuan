// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-2gn42bha8f90b918' }) // 使用当前云环境
const db=cloud.database();
// 云函数入口函数
exports.main = async (event, context) => {
  const { strloginUser, strloginpassword ,strloginName} = event;

  try {
    const res = await db.collection('Teacher').where({
      Id: strloginUser,
      Password: strloginpassword,
      name:strloginName
    }).get();

    if (res.data.length > 0) {
      return {
        success: true,
        data: res.data[0]  // 返回用户信息
      };
    } else {
      return {
        success: false,
        message: '学号或密码错误'
      };
    }
  } catch (err) {
    return {
      success: false,
      message: '查询失败',
      error: err
    };
  }
}