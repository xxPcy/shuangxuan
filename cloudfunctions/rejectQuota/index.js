const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-2gn42bha8f90b918' }) // 使用当前云环境
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { teacherId, type, validValue, category } = event

  return await db.runTransaction(async transaction => {
    await transaction.collection('TotalQuota').doc('totalquota').update({
      data: {
        [`${type}_current`]: _.inc(validValue)
      }
    })

    await transaction.collection('Teacher').doc(teacherId).update({
      data: {
        [`pending_${type}`]: 0
      }
    })

    const teacherData = (await transaction.collection('Teacher').doc(teacherId).get()).data

    await transaction.collection('RejectedQuota').add({
      data: {
        teacherName: teacherData.name,
        label: category.label,
        teacherId: teacherData.Id,
        key: type,
        rejectedValue: validValue,
        reason: '主动拒绝',
        timestamp: new Date()
      }
    })
  })
}
