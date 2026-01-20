// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-2gn42bha8f90b918' }) // 使用当前云环境
const db = cloud.database();
// 云函数入口函数
exports.main = async (event, context) => {
    try{
      const res=await db.collection('Teacher')
      .doc(event._id)
      .get();
      
      return{
        success:true ,
        data:res.data
      };
    }catch(error){
      return{
        success:false,
        error:error.message
      };
    }
};