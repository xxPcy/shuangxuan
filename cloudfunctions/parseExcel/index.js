


// // 新增指标
// // 云函数入口文件
// const cloud = require('wx-server-sdk');
// const xlsx = require('node-xlsx'); // 需要安装 node-xlsx
// cloud.init();
// const db = cloud.database();

// exports.main = async (event, context) => {
//   const { fileId } = event;

//   try {
//     // 1. 下载 Excel 文件
//     const fileResult = await cloud.downloadFile({
//       fileID: fileId,
//     });
//     const fileBuffer = fileResult.fileContent;

//     // 2. 解析 Excel 数据（假设数据在第一个工作表中）
//     const sheets = xlsx.parse(fileBuffer);
//     const data = sheets[0].data;

//     // 3. 定义 Excel 中各专业对应的字段名称（从第3列开始）
//     const columnNames = ["dqgcxs", "dqgczs", "dqgclp", "kongzhiX", "dzxxzs", "dzxxlp",,"dqgcsoldier","dzxxsoldier"];

//     // 4. 遍历 Excel 行，将数据整理到 teacherData 对象中
//     // 假设：第一列为导师姓名，第二列为导师 ID，从第三列开始为各专业分配指标
//     const teacherData = {};
//     for (let i = 1; i < data.length; i++) {
//       const row = data[i];
//       // 将导师姓名转换为字符串并去除多余空格
//       const teacherName = row[0] ? row[0].toString().trim() : '未知';
//       // 将导师ID转换为字符串，保留前导零并去除空格
//       const teacherId = row[1] ? row[1].toString().trim() : '';
//       if (!teacherId) {
//         console.warn(`Excel 行 ${i} 无效，导师 ID 为空`);
//         continue;
//       }
//       // 构建各专业的分配指标对象
//       const quotas = {};
//       for (let j = 0; j < columnNames.length; j++) {
//         // Excel 中从第3列开始（下标 2）
//         quotas[columnNames[j]] = row[j + 2] || 0;
//       }
//       if (!teacherData[teacherId]) {
//         teacherData[teacherId] = [];
//       }
//       teacherData[teacherId].push({ rowIndex: i, quotas, name: teacherName });
//     }

//     // 5. 检查 Excel 内是否存在重复的导师 ID
//     const errorDetails = [];
//     for (let teacherId in teacherData) {
//       if (teacherData[teacherId].length > 1) {
//         errorDetails.push({
//           teacherId,
//           name: teacherData[teacherId][0].name, // 取第一个记录的姓名
//           error: "重复的导师ID",
//           rows: teacherData[teacherId].map(item => ({
//             rowIndex: item.rowIndex,
//             quotas: item.quotas
//           }))
//         });
//       }
//     }

//     // 6. 检查 Excel 中的导师 ID 是否在数据库中存在
//     const teacherIds = Object.keys(teacherData);
//     let existingTeacherIdsSet = new Set();

//     // 解决数据库 in 查询限制，分批查询（例如每批20个）
//     const batchSize = 20;
//     for (let i = 0; i < teacherIds.length; i += batchSize) {
//       const batch = teacherIds.slice(i, i + batchSize);
//       const dbRes = await db.collection('Teacher').where({
//         Id: db.command.in(batch)
//       }).get();
//       // 将数据库中读取的导师ID转换为字符串后存入Set
//       dbRes.data.forEach(item => {
//         existingTeacherIdsSet.add((item.Id || '').toString().trim());
//       });
//     }

//     // 对每个 Excel 中的导师ID检查是否存在于数据库结果中
//     for (let teacherId of teacherIds) {
//       if (!existingTeacherIdsSet.has(teacherId)) {
//         errorDetails.push({
//           teacherId,
//           name: teacherData[teacherId][0].name,
//           error: "数据库中不存在该导师ID",
//           rows: teacherData[teacherId].map(item => ({
//             rowIndex: item.rowIndex,
//             quotas: item.quotas
//           }))
//         });
//       }
//     }

//     // 7. 如果有任何错误，返回错误详情，不执行更新操作
//     if (errorDetails.length > 0) {
//       return {
//         success: false,
//         error: "上传失败，存在错误的导师ID",
//         details: errorDetails
//       };
//     }

//     // 8. 没有错误则开始更新导师数据，并累计总表指标
//     const totalIncrements = {}; // 用于累计总表的历史总量增量
//     columnNames.forEach(column => {
//       totalIncrements[`${column}_total`] = 0;
//     });

//     const updateTeacherPromises = [];
//     // 此时 teacherData 中每个导师 ID 只对应一条记录（重复已被捕获）
//     for (let teacherId in teacherData) {
//       const record = teacherData[teacherId][0];
//       const quotas = record.quotas;
//       const pendingFields = {};
//       for (let col of columnNames) {
//         const incVal = quotas[col];
//         pendingFields[`pending_${col}`] = db.command.inc(incVal);
//         totalIncrements[`${col}_total`] += incVal;
//       }
//       // 初始化审批状态及时间戳
//       pendingFields["approval_status"] = "pending";
//       pendingFields["approval_timestamp"] = Date.now();

//       // 更新对应导师记录（这里假设字段 Id 是数据库中导师的唯一标识）
//       const teacherPromise = db.collection('Teacher').where({
//         Id: teacherId
//       }).update({
//         data: pendingFields,
//       }).then(updateRes => {
//         console.log(`导师更新成功, ID: ${teacherId}`, updateRes);
//         return updateRes;
//       }).catch(err => {
//         console.error(`导师更新失败, ID: ${teacherId}`, err);
//         throw err;
//       });
//       updateTeacherPromises.push(teacherPromise);
//     }

//     // 执行所有导师的更新任务
//     await Promise.all(updateTeacherPromises);

//     // 9. 更新 TotalQuota 集合的历史总量字段（累加更新）
//     const totalQuotaUpdates = {};
//     for (let key in totalIncrements) {
//       if (totalIncrements[key] > 0) {
//         totalQuotaUpdates[key] = db.command.inc(totalIncrements[key]);
//       }
//     }

//     await db.collection('TotalQuota').doc('totalquota').update({
//       data: totalQuotaUpdates,
//     }).then(updateRes => {
//       console.log('TotalQuota 历史总量更新成功:', updateRes);
//     }).catch(err => {
//       console.error('TotalQuota 更新失败:', err);
//       throw err;
//     });

//     return { success: true, message: "导师名额和总表历史总量已成功更新。" };
//   } catch (error) {
//     console.error("更新失败：", error);
//     return { success: false, error: error.message };
//   }
// };









// 新增指标
// 云函数入口文件
const cloud = require('wx-server-sdk');
const xlsx = require('node-xlsx'); // 需要安装 node-xlsx
cloud.init({ env: 'cloud1-2gn42bha8f90b918' });
const db = cloud.database();
exports.main = async (event, context) => {
  const { fileId } = event;

  try {
    // 1. 下载 Excel 文件
    const fileResult = await cloud.downloadFile({
      fileID: fileId,
    });
    const fileBuffer = fileResult.fileContent;

    // 2. 解析 Excel 数据（假设数据在第一个工作表中）
    const sheets = xlsx.parse(fileBuffer);
    const data = sheets[0].data;

    // 3. 分别定义需要添加pending_前缀和不需要添加前缀的字段
    const pendingColumnNames = ["dqgcxs", "dqgczs", "dqgclp", "kongzhiX", "dzxxzs", "dzxxlp"];
    const nonPendingColumnNames = ["dqgcsoldier", "dzxxsoldier"];
    // 合并用于Excel解析
    const columnNames = [...pendingColumnNames, ...nonPendingColumnNames];

    // 4. 遍历 Excel 行，将数据整理到 teacherData 对象中
    // 假设：第一列为导师姓名，第二列为导师 ID，从第三列开始为各专业分配指标
    const teacherData = {};
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // 将导师姓名转换为字符串并去除多余空格
      const teacherName = row[0] ? row[0].toString().trim() : '未知';
      // 将导师ID转换为字符串，保留前导零并去除空格
      const teacherId = row[1] ? row[1].toString().trim() : '';
      if (!teacherId) {
        console.warn(`Excel 行 ${i} 无效，导师 ID 为空`);
        continue;
      }
      // 构建各专业的分配指标对象
      const quotas = {};
      for (let j = 0; j < columnNames.length; j++) {
        // Excel 中从第3列开始（下标 2）
        quotas[columnNames[j]] = row[j + 2] || 0;
      }
      if (!teacherData[teacherId]) {
        teacherData[teacherId] = [];
      }
      teacherData[teacherId].push({ rowIndex: i, quotas, name: teacherName });
    }

    // 5. 检查 Excel 内是否存在重复的导师 ID
    const errorDetails = [];
    for (let teacherId in teacherData) {
      if (teacherData[teacherId].length > 1) {
        errorDetails.push({
          teacherId,
          name: teacherData[teacherId][0].name, // 取第一个记录的姓名
          error: "重复的导师ID",
          rows: teacherData[teacherId].map(item => ({
            rowIndex: item.rowIndex,
            quotas: item.quotas
          }))
        });
      }
    }

    // 6. 检查 Excel 中的导师 ID 是否在数据库中存在
    const teacherIds = Object.keys(teacherData);
    let existingTeacherIdsSet = new Set();

    // 解决数据库 in 查询限制，分批查询（例如每批20个）
    const batchSize = 20;
    for (let i = 0; i < teacherIds.length; i += batchSize) {
      const batch = teacherIds.slice(i, i + batchSize);
      const dbRes = await db.collection('Teacher').where({
        Id: db.command.in(batch)
      }).get();
      // 将数据库中读取的导师ID转换为字符串后存入Set
      dbRes.data.forEach(item => {
        existingTeacherIdsSet.add((item.Id || '').toString().trim());
      });
    }

    // 对每个 Excel 中的导师ID检查是否存在于数据库结果中
    for (let teacherId of teacherIds) {
      if (!existingTeacherIdsSet.has(teacherId)) {
        errorDetails.push({
          teacherId,
          name: teacherData[teacherId][0].name,
          error: "数据库中不存在该导师ID",
          rows: teacherData[teacherId].map(item => ({
            rowIndex: item.rowIndex,
            quotas: item.quotas
          }))
        });
      }
    }

    // 7. 如果有任何错误，返回错误详情，不执行更新操作
    if (errorDetails.length > 0) {
      return {
        success: false,
        error: "上传失败，存在错误的导师ID",
        details: errorDetails
      };
    }

    // 8. 没有错误则开始更新导师数据，并累计总表指标
    const totalIncrements = {}; // 用于累计总表的历史总量增量
    columnNames.forEach(column => {
      totalIncrements[`${column}_total`] = 0;
    });

    const updateTeacherPromises = [];
    // 此时 teacherData 中每个导师 ID 只对应一条记录（重复已被捕获）
    for (let teacherId in teacherData) {
      const record = teacherData[teacherId][0];
      const quotas = record.quotas;
      const pendingFields = {};
      
      // 处理需要pending_前缀的字段
      for (let col of pendingColumnNames) {
        const incVal = quotas[col];
        pendingFields[`pending_${col}`] = db.command.inc(incVal);
        totalIncrements[`${col}_total`] += incVal;
      }
      
      // 处理不需要pending_前缀的字段（直接更新）
      for (let col of nonPendingColumnNames) {
        const incVal = quotas[col];
        pendingFields[col] = db.command.inc(incVal); // 没有pending_前缀
        totalIncrements[`${col}_total`] += incVal;
      }
      
      // 初始化审批状态及时间戳
      pendingFields["approval_status"] = "pending";
      pendingFields["approval_timestamp"] = Date.now();

      // 更新对应导师记录（这里假设字段 Id 是数据库中导师的唯一标识）
      const teacherPromise = db.collection('Teacher').where({
        Id: teacherId
      }).update({
        data: pendingFields,
      }).then(updateRes => {
        console.log(`导师更新成功, ID: ${teacherId}`, updateRes);
        return updateRes;
      }).catch(err => {
        console.error(`导师更新失败, ID: ${teacherId}`, err);
        throw err;
      });
      updateTeacherPromises.push(teacherPromise);
    }

    // 执行所有导师的更新任务
    await Promise.all(updateTeacherPromises);

    // 9. 更新 TotalQuota 集合的历史总量字段（累加更新）
    const totalQuotaUpdates = {};
    for (let key in totalIncrements) {
      if (totalIncrements[key] > 0) {
        totalQuotaUpdates[key] = db.command.inc(totalIncrements[key]);
      }
    }

    await db.collection('TotalQuota').doc('totalquota').update({
      data: totalQuotaUpdates,
    }).then(updateRes => {
      console.log('TotalQuota 历史总量更新成功:', updateRes);
    }).catch(err => {
      console.error('TotalQuota 更新失败:', err);
      throw err;
    });

    return { success: true, message: "导师名额和总表历史总量已成功更新。" };
  } catch (error) {
    console.error("更新失败：", error);
    return { success: false, error: error.message };
  }
};