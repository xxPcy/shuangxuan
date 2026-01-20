// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-2gn42bha8f90b918' })
const db=cloud.database();
// 云函数入口函数
exports.main = async (event, context) => {
  const _ = db.command
  const rejectionDetails = {
    teacherName: event.tecName, // 导师姓名
    teacherId:event.tecId, // 导师ID
    reason: '由于导师名额已满，已被自动退回', // 拒绝理由
    timestamp: event.timestamp // 时间戳
  };
  try {
    // 更新学生状态为未选择，并清空选择的导师信息
    await db.collection('Stu').where({
      _id: _.in(event.studentIds),
      // selected: event.tecName
    }).update({
      data: {
        status: 'chosing',
        selected: '',
        preselection: [],
        reason:_.push(rejectionDetails)//将拒绝理由存入数组
      }
    })

    // 从导师的prestudent中移除这些学生
    await db.collection('Teacher').doc(event.tecId).update({
      data: {
        prestudent: _.pull({
          studentId: _.in(event.studentIds)
        })
      }
    })

    return {
      success: true,
      message: '学生已成功退回'
    }
  } catch (e) {
    return {
      success: false,
      message: e
    }
  }
  } 

