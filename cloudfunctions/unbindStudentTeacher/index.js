
// // 云函数入口函数
// const cloud = require('wx-server-sdk');

// cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// exports.main = async (event, context) => {
//   const { studentId, teacherId } = event; // 传入学生ID和导师ID
//   console.log('studentId:', studentId); // 打印 studentId
//   console.log('teacherId:', teacherId); // 打印 teacherId

//   if (!studentId || !teacherId) {
//     return { error: '学生ID或导师ID缺失' };
//   }
//   const db = cloud.database();

//   try {
//     // 开启数据库事务
//     const transaction = await db.startTransaction();

//     // 查询导师信息
//     const teacherRes = await transaction.collection('Teacher').where({
//       Id: teacherId
//     }).get();

//     if (teacherRes.data.length === 0) {
//       throw new Error('导师信息不存在');
//     }

//     const teacher = teacherRes.data[0];

//     // 查询学生信息
//     const studentRes = await transaction.collection('Stu').where({
//       Id: studentId
//     }).get();

//     if (studentRes.data.length === 0) {
//       throw new Error('学生信息不存在');
//     }

//     const student = studentRes.data[0];

//     // 检查导师是否已选择该学生
//     const studentIndex = teacher.student.findIndex(selectedStudent => selectedStudent.studentName === student.name);
//     if (studentIndex === -1) {
//       throw new Error('该学生和导师未建立绑定关系');
//     }

//     // 更新学生的状态并清空导师信息
//     const tasks = [];

//     // 1. 更新学生数据库：status 改为 'chosing'，清空 selected 字段
//     tasks.push(transaction.collection('Stu').doc(student._id).update({
//       data: {
//         status: 'chosing',
//         selected: ''
//       }
//     }));

//     // 2. 更新导师数据库：从导师的 student 数组中删除该学生
//     teacher.student.splice(studentIndex, 1); // 删除学生对象

//     tasks.push(transaction.collection('Teacher').doc(teacher._id).update({
//       data: {
//         student: teacher.student, // 更新导师的 student 数组
//         // 更新导师的名额（增加剩余名额，减少已使用名额）
//         remainingQuota: teacher.remainingQuota + 1, // 增加剩余名额
//         usedQuota: teacher.usedQuota - 1 // 减少已使用名额
//       }
//     }));

//     // 执行所有任务
//     await Promise.all(tasks);

//     // 提交事务
//     await transaction.commit();

//     return { success: true };
//   } catch (err) {
//     console.error('解绑学生和导师关系失败', err);
//     return { error: err.message };
//   }
// };



// 云函数入口函数
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-2gn42bha8f90b918' });

exports.main = async (event, context) => {
  const { studentId, teacherId } = event; // 传入学生ID和导师ID

  if (!studentId || !teacherId) {
    return { error: '学生ID或导师ID缺失' };
  }

  const db = cloud.database();

  try {
    const transaction = await db.startTransaction();

    // 1. 查询学生信息
    const studentRes = await transaction.collection('Stu').where({
      Id: studentId  // 使用学生的自定义 ID 字段
    }).get();

    if (studentRes.data.length === 0) {
      throw new Error('学生信息不存在');
    }

    const student = studentRes.data[0];

    // 2. 更新学生信息，将状态改为 'chosing' 并清空 selected 和 selectedTecId 字段
    await transaction.collection('Stu').doc(student._id).update({
      data: {
        status: 'chosing',  // 改为 'chosing' 状态
        selected: '',  // 清空导师姓名
        selectedTecId: ''  // 清空导师Id
      }
    });

    // 3. 查询导师信息
    const teacherRes = await transaction.collection('Teacher').where({
      Id: teacherId
    }).get();

    if (teacherRes.data.length === 0) {
      throw new Error('导师信息不存在');
    }

    const teacher = teacherRes.data[0];

    // 4. 查找导师的学生信息
    let studentIndex = -1;
    let studentCategoryKey = null;
    let matchedStudentInfo = null;

    // 遍历导师的学生数组，找到该学生并确定其 categoryKey（专业代码）
    for (const studentInfo of teacher.student) {
      if (studentInfo.Id === studentId) {
        studentIndex = teacher.student.indexOf(studentInfo);
        studentCategoryKey = studentInfo.categoryKey; // 接受时记录的专业代码
        matchedStudentInfo = studentInfo;
        break;
      }
    }

    if (studentIndex === -1) {
      throw new Error('导师的学生列表中找不到该学生');
    }

    // 5. 删除导师的学生
    teacher.student.splice(studentIndex, 1);

    // 6. 判断该学生是否占用指标
    const studentUseQuota = matchedStudentInfo ? (matchedStudentInfo.useQuota !== false) : true; // 默认占用

    // 7. 在 quota_settings 中找到对应条目并恢复名额（仅占用指标的学生需要恢复）
    const newQuotaSettings = [...(teacher.quota_settings || [])];
    if (studentUseQuota && studentCategoryKey) {
      const quotaSettings = teacher.quota_settings || [];
      const studentTrack = student.track || 'regular';

      // 按 categoryKey + track 匹配（优先精确匹配）
      let matchedQuotaIndex = quotaSettings.findIndex(q => 
        q.code === studentCategoryKey && (q.track || 'regular') === studentTrack
      );
      
      // 如果精确匹配失败，尝试只按 code 匹配（兼容旧数据）
      if (matchedQuotaIndex === -1) {
        matchedQuotaIndex = quotaSettings.findIndex(q => q.code === studentCategoryKey);
      }

      if (matchedQuotaIndex >= 0) {
        newQuotaSettings[matchedQuotaIndex] = {
          ...newQuotaSettings[matchedQuotaIndex],
          used_quota: Math.max((newQuotaSettings[matchedQuotaIndex].used_quota || 0) - 1, 0)
        };
      }
    }

    // 7. 更新导师数据库
    await transaction.collection('Teacher').doc(teacher._id).update({
      data: {
        student: teacher.student,
        quota_settings: newQuotaSettings
      }
    });

    // 8. 提交事务
    await transaction.commit();

    return { success: true };
  } catch (err) {
    console.error('解绑学生和导师关系失败', err);
    return { error: err.message };
  }
};
