

// const cloud = require('wx-server-sdk');
// cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
// const db = cloud.database();

// exports.main = async (event, context) => {
//   try {
//     console.log("Timeout check triggered with event:", event);

//     const quotaCategories = [
//       { label: '电子信息（专硕）', key: 'dzxxzs' },
//       { label: '控制科学与工程（学硕）', key: 'kongzhiX' },
//       { label: '电气工程（专硕）', key: 'dqgczs' },
//       { label: '电气工程（学硕）', key: 'dqgcxs' },
//       { label: '电子信息（联培）', key: 'dzxxlp' },
//       { label: '电气工程（联培）', key: 'dqgclp' },
//       { label: '电子信息(士兵计划)', key: 'dzxxsoldier' },
//       { label: '电子信息(非全日制)', key: 'dzxxpartTime' },
//       { label: '电气工程(士兵计划)', key: 'dqgcsoldier' },
//       { label: '电气工程(非全日制)', key: 'dqgcpartTime' }
//     ];
//     const timeoutDuration = 1 * 2 * 60 * 1000; // 2分钟超时
//     const currentTimestamp = new Date().getTime();

//     let pageIndex = 0;
//     const pageSize = 100;

//     while (true) {
//       const teacherRes = await db.collection('Teacher')
//         .where({ approval_status: 'pending' })
//         .skip(pageIndex * pageSize)
//         .limit(pageSize)
//         .get();

//       if (!teacherRes.data || teacherRes.data.length === 0) {
//         console.log("没有待审批的导师，退出循环");
//         break;
//       }

//       for (const teacher of teacherRes.data) {
//         const teacherId = teacher._id;
//         console.log(`检查超时: ${teacher.name}, ID: ${teacherId}`);

//         const autoRejectPromises = [];
//         let hasPending = false;

//         for (const category of quotaCategories) {
//           const pendingKey = `pending_${category.key}`;
//           const pendingValue = teacher[pendingKey] || 0;
//           const approvalTimestamp = teacher.approval_timestamp || 0;

//           if (pendingValue > 0) {
//             hasPending = true;
//             const elapsedTime = approvalTimestamp ? currentTimestamp - approvalTimestamp : timeoutDuration + 1;
//             if (elapsedTime > timeoutDuration) {
//               // 再次确认状态，避免重复退回
//               const teacherCheck = await db.collection('Teacher').doc(teacherId).get();
//               if (teacherCheck.data.approval_status !== 'pending') {
//                 console.log(`导师 ${teacher.name} 状态已变更，跳过`);
//                 continue;
//               }
//               if (teacherCheck.data[pendingKey] === 0) {
//                 console.log(`导师 ${teacher.name}, ${category.key} 已清零，跳过`);
//                 continue;
//               }

//               console.log(`检测到超时: ${teacher.name}, ${category.key}, 名额: ${pendingValue}`);
//               autoRejectPromises.push(
//                 db.collection('TotalQuota').doc('totalquota').update({
//                   data: { [`${category.key}_current`]: db.command.inc(pendingValue) }
//                 }).then(() => {
//                   console.log(`退回 ${pendingValue} 到 ${category.key}_current`);
//                   return db.collection('Teacher').doc(teacherId).update({
//                     data: { [pendingKey]: 0 }
//                   });
//                 }).then(() => {
//                   console.log(`清空 ${teacherId} 的 ${pendingKey}`);
//                   return db.collection('RejectedQuota').add({
//                     data: {
//                       teacherName: teacher.name,
//                       teacherId: teacher.Id,
//                       label: category.label,
//                       key: category.key,
//                       rejectedValue: pendingValue,
//                       reason: '超时',
//                       timestamp: new Date()
//                     }
//                   });
//                 }).catch(err => {
//                   console.error(`退回失败: ${teacherId}, ${category.key}, 错误:`, err);
//                 })
//               );
//             }
//           }
//         }

//         await Promise.all(autoRejectPromises);
//         if (hasPending) {
//           const updatedTeacher = await db.collection('Teacher').doc(teacherId).get();
//           let allCleared = true;
//           for (const category of quotaCategories) {
//             if (updatedTeacher.data[`pending_${category.key}`] > 0) {
//               allCleared = false;
//               break;
//             }
//           }
//           if (allCleared) {
//             console.log(`导师 ${teacher.name} 所有名额已清空，更新状态为 rejected`);
//             await db.collection('Teacher').doc(teacherId).update({
//               data: { approval_status: 'rejected' }
//             });
//           }
//         } else {
//           console.log(`导师 ${teacher.name} 无待审批名额，更新状态为 rejected`);
//           await db.collection('Teacher').doc(teacherId).update({
//             data: { approval_status: 'rejected' }
//           });
//         }
//       }

//       pageIndex++;
//     }

//     console.log("超时检测完成");
//     return { success: true };

//   } catch (error) {
//     console.error("Error in timeout check:", error);
//     return { success: false, error: error.message };
//   }
// };



const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-2gn42bha8f90b918' });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    console.log("Timeout check triggered with event:", event);

    const quotaCategories = [
      { label: '电子信息（专硕）', key: 'dzxxzs' },
      { label: '控制科学与工程（学硕）', key: 'kongzhiX' },
      { label: '电气工程（专硕）', key: 'dqgczs' },
      { label: '电气工程（学硕）', key: 'dqgcxs' },
      { label: '电子信息（联培）', key: 'dzxxlp' },
      { label: '电气工程（联培）', key: 'dqgclp' },
      { label: '电子信息(士兵计划)', key: 'dzxxsoldier' },
      { label: '电子信息(非全日制)', key: 'dzxxpartTime' },
      { label: '电气工程(士兵计划)', key: 'dqgcsoldier' },
      { label: '电气工程(非全日制)', key: 'dqgcpartTime' }
    ];
    // const timeoutDuration = 1 * 2 * 60 * 1000; // 2分钟超时
    // const timeoutDuration = 24 * 60 * 60 * 1000; // 2分钟超时
    // const timeoutDuration = 4 * 60 * 1000; // 4分钟超时
    const timeoutDuration = 48 * 60 * 60 * 1000; // 48小时超时
    const currentTimestamp = new Date().getTime();

    let pageIndex = 0;
    const pageSize = 100;

    while (true) {
      const teacherRes = await db.collection('Teacher')
        .where({ approval_status: 'pending' })
        .skip(pageIndex * pageSize)
        .limit(pageSize)
        .get();

      if (!teacherRes.data || teacherRes.data.length === 0) {
        console.log("没有待审批的导师，退出循环");
        break;
      }

      for (const teacher of teacherRes.data) {
        const teacherId = teacher._id;
        console.log(`检查超时: ${teacher.name}, ID: ${teacherId}`);

        const autoRejectPromises = [];
        let hasPending = false;

        for (const category of quotaCategories) {
          const pendingKey = `pending_${category.key}`;
          const pendingValue = teacher[pendingKey] || 0;
          const approvalTimestamp = teacher.approval_timestamp || 0;

          if (pendingValue > 0) {
            hasPending = true;
            const elapsedTime = approvalTimestamp ? currentTimestamp - approvalTimestamp : timeoutDuration + 1;
            if (elapsedTime > timeoutDuration) {
              // 再次确认状态，避免重复退回
              const teacherCheck = await db.collection('Teacher').doc(teacherId).get();
              if (teacherCheck.data.approval_status !== 'pending') {
                console.log(`导师 ${teacher.name} 状态已变更，跳过`);
                continue;
              }
              if (teacherCheck.data[pendingKey] === 0) {
                console.log(`导师 ${teacher.name}, ${category.key} 已清零，跳过`);
                continue;
              }

              console.log(`检测到超时: ${teacher.name}, ${category.key}, 名额: ${pendingValue}`);
              autoRejectPromises.push(
                db.collection('TotalQuota').doc('totalquota').update({
                  data: { [`${category.key}_current`]: db.command.inc(pendingValue) }
                }).then(() => {
                  console.log(`退回 ${pendingValue} 到 ${category.key}_current`);
                  return db.collection('Teacher').doc(teacherId).update({
                    data: { [pendingKey]: 0 }
                  });
                }).then(() => {
                  console.log(`清空 ${teacherId} 的 ${pendingKey}`);
                  return db.collection('RejectedQuota').add({
                    data: {
                      teacherName: teacher.name,
                      teacherId: teacher.Id,
                      label: category.label,
                      key: category.key,
                      rejectedValue: pendingValue,
                      reason: '超时',
                      timestamp: new Date()
                    }
                  });
                }).catch(err => {
                  console.error(`退回失败: ${teacherId}, ${category.key}, 错误:`, err);
                })
              );
            }
          }
        }

        await Promise.all(autoRejectPromises);
        if (hasPending) {
          const updatedTeacher = await db.collection('Teacher').doc(teacherId).get();
          let allCleared = true;
          for (const category of quotaCategories) {
            if (updatedTeacher.data[`pending_${category.key}`] > 0) {
              allCleared = false;
              break;
            }
          }
          if (allCleared) {
            console.log(`导师 ${teacher.name} 所有名额已清空，更新状态为 rejected`);
            await db.collection('Teacher').doc(teacherId).update({
              data: { approval_status: 'rejected' }
            });
          }
        } else {
          console.log(`导师 ${teacher.name} 无待审批名额，更新状态为 rejected`);
          await db.collection('Teacher').doc(teacherId).update({
            data: { approval_status: 'rejected' }
          });
        }
      }

      pageIndex++;
    }

    console.log("超时检测完成");
    return { success: true };

  } catch (error) {
    console.error("Error in timeout check:", error);
    return { success: false, error: error.message };
  }
};