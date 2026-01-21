


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
// Excel表结构：导师ID、导师姓名、一级名称、一级代码、新增指标数、二级名称、二级代码、新增指标数、三级名称、三级代码、新增指标数、学制
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

    // 3. Excel列索引定义
    // 列结构：导师ID(0)、导师姓名(1)、一级名称(2)、一级代码(3)、一级新增指标数(4)、
    //        二级名称(5)、二级代码(6)、二级新增指标数(7)、
    //        三级名称(8)、三级代码(9)、三级新增指标数(10)、学制(11)
    const COL_TEACHER_ID = 0;
    const COL_TEACHER_NAME = 1;
    const COL_LEVEL1_CODE = 3;
    const COL_LEVEL1_VALUE = 4;
    const COL_LEVEL2_CODE = 6;
    const COL_LEVEL2_VALUE = 7;
    const COL_LEVEL3_CODE = 9;
    const COL_LEVEL3_VALUE = 10;

    // 4. 遍历 Excel 行，将数据整理到 teacherData 对象中
    // 每个导师可能有多行数据（不同的专业代码），需要合并
    // 由于Excel单元格合并，需要记住上一行的导师ID、姓名、一级代码等信息
    const teacherData = {};
    const errorRows = []; // 记录有问题的行
    
    // 用于统计全院总指标数（按一级、二级、三级分类）
    const totalQuotaStats = {
      level1: {},  // 一级代码 -> { code, name, quota }
      level2: {},  // 二级代码 -> { code, name, quota }
      level3: {}   // 三级代码 -> { code, name, quota }
    };
    
    // 用于记录上一行的合并单元格信息
    let lastTeacherId = '';
    let lastTeacherName = '';
    let lastLevel1Code = '';
    let lastLevel1Name = '';
    let lastLevel2Code = '';
    let lastLevel2Name = '';
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // 跳过完全空的行
      if (!row || row.length === 0 || row.every(cell => !cell)) {
        continue;
      }
      
      // 获取导师ID（如果当前行为空，使用上一行的值 - 处理合并单元格）
      let teacherId = row[COL_TEACHER_ID] ? row[COL_TEACHER_ID].toString().trim() : '';
      if (teacherId) {
        lastTeacherId = teacherId;
        // 新导师开始时，重置一级和二级代码
        lastLevel1Code = '';
        lastLevel1Name = '';
        lastLevel2Code = '';
        lastLevel2Name = '';
      } else {
        teacherId = lastTeacherId;
      }
      
      // 如果仍然没有导师ID，记录错误
      if (!teacherId) {
        errorRows.push({
          row: i + 1,
          error: "导师ID为空，无法确定归属"
        });
        continue;
      }
      
      // 获取导师姓名（如果当前行为空，使用上一行的值）
      let teacherName = row[COL_TEACHER_NAME] ? row[COL_TEACHER_NAME].toString().trim() : '';
      if (teacherName) {
        lastTeacherName = teacherName;
      } else {
        teacherName = lastTeacherName || '未知';
      }
      
      // 获取一级代码和名称（如果当前行为空，使用上一行的值 - 处理合并单元格）
      // 一级名称在列索引2
      const COL_LEVEL1_NAME = 2;
      let level1Code = row[COL_LEVEL1_CODE] ? row[COL_LEVEL1_CODE].toString().trim() : '';
      let level1Name = row[COL_LEVEL1_NAME] ? row[COL_LEVEL1_NAME].toString().trim() : '';
      if (level1Code) {
        lastLevel1Code = level1Code;
        lastLevel1Name = level1Name;
      } else {
        level1Code = lastLevel1Code;
        level1Name = lastLevel1Name;
      }
      const level1Value = parseInt(row[COL_LEVEL1_VALUE]) || 0;
      
      // 获取二级代码和名称（如果当前行为空，使用上一行的值 - 处理合并单元格）
      // 二级名称在列索引5
      const COL_LEVEL2_NAME = 5;
      let level2Code = row[COL_LEVEL2_CODE] ? row[COL_LEVEL2_CODE].toString().trim() : '';
      let level2Name = row[COL_LEVEL2_NAME] ? row[COL_LEVEL2_NAME].toString().trim() : '';
      if (level2Code) {
        lastLevel2Code = level2Code;
        lastLevel2Name = level2Name;
      } else {
        level2Code = lastLevel2Code;
        level2Name = lastLevel2Name;
      }
      const level2Value = parseInt(row[COL_LEVEL2_VALUE]) || 0;
      
      // 获取三级代码、名称和指标数（三级通常每行都有值）
      // 三级名称在列索引8
      const COL_LEVEL3_NAME = 8;
      const level3Code = row[COL_LEVEL3_CODE] ? row[COL_LEVEL3_CODE].toString().trim() : '';
      const level3Name = row[COL_LEVEL3_NAME] ? row[COL_LEVEL3_NAME].toString().trim() : '';
      const level3Value = parseInt(row[COL_LEVEL3_VALUE]) || 0;

      // 初始化导师数据
      if (!teacherData[teacherId]) {
        teacherData[teacherId] = {
          name: teacherName,
          quotas: {} // 存储 专业代码 -> 增量值
        };
      }

      // 累加一级指标（按专业代码存储）- 同时统计全院总量
      if (level1Code && level1Value > 0) {
        teacherData[teacherId].quotas[level1Code] = (teacherData[teacherId].quotas[level1Code] || 0) + level1Value;
        // 统计全院一级指标
        if (!totalQuotaStats.level1[level1Code]) {
          totalQuotaStats.level1[level1Code] = { code: level1Code, name: level1Name, quota: 0, pending_approval: 0 };
        }
        totalQuotaStats.level1[level1Code].quota += level1Value;
      }

      // 累加二级指标（按专业代码存储）- 同时统计全院总量
      if (level2Code && level2Value > 0) {
        teacherData[teacherId].quotas[level2Code] = (teacherData[teacherId].quotas[level2Code] || 0) + level2Value;
        // 统计全院二级指标
        if (!totalQuotaStats.level2[level2Code]) {
          totalQuotaStats.level2[level2Code] = { code: level2Code, name: level2Name, quota: 0, pending_approval: 0 };
        }
        totalQuotaStats.level2[level2Code].quota += level2Value;
      }

      // 累加三级指标（按专业代码存储）- 同时统计全院总量
      if (level3Code && level3Value > 0) {
        teacherData[teacherId].quotas[level3Code] = (teacherData[teacherId].quotas[level3Code] || 0) + level3Value;
        // 统计全院三级指标
        if (!totalQuotaStats.level3[level3Code]) {
          totalQuotaStats.level3[level3Code] = { code: level3Code, name: level3Name, quota: 0, pending_approval: 0 };
        }
        totalQuotaStats.level3[level3Code].quota += level3Value;
      }
    }

    // 5. 如果有行级错误，直接返回
    if (errorRows.length > 0) {
      return {
        success: false,
        error: "Excel文件存在格式错误",
        details: errorRows
      };
    }

    // 6. 检查 Excel 中的导师 ID 是否在数据库中存在
    const errorDetails = [];
    const teacherIds = Object.keys(teacherData);
    
    // 如果没有有效的导师数据，返回错误
    if (teacherIds.length === 0) {
      return {
        success: false,
        error: "Excel文件中没有有效的导师数据"
      };
    }
    
    // 用于存储从数据库查询到的导师数据（包含quota_settings）
    const teacherDbMap = {}; // teacherId -> teacher document
    
    // 解决数据库 in 查询限制，分批查询（例如每批20个）
    // 同时获取导师的完整数据，避免后续重复查询
    const batchSize = 20;
    for (let i = 0; i < teacherIds.length; i += batchSize) {
      const batch = teacherIds.slice(i, i + batchSize);
      const dbRes = await db.collection('Teacher').where({
        Id: db.command.in(batch)
      }).get();
      // 将数据库中读取的导师数据存入Map
      dbRes.data.forEach(item => {
        const idStr = (item.Id || '').toString().trim();
        teacherDbMap[idStr] = item;
      });
    }

    // 对每个 Excel 中的导师ID检查是否存在于数据库结果中
    for (let teacherId of teacherIds) {
      if (!teacherDbMap[teacherId]) {
        errorDetails.push({
          teacherId,
          name: teacherData[teacherId].name,
          error: "数据库中不存在该导师ID",
          quotas: teacherData[teacherId].quotas
        });
      }
    }

    // 7. 如果有任何错误，返回错误详情，不执行更新操作
    if (errorDetails.length > 0) {
      return {
        success: false,
        error: "上传失败，以下导师ID在数据库中不存在",
        details: errorDetails
      };
    }

    // 8. 批量更新导师数据（高效处理300+导师）
    // 策略：先在内存中计算好所有更新，然后分批并行执行
    const updateTasks = []; // 存储所有待更新的任务
    const failedUpdates = []; // 存储更新失败的记录
    const successCount = { value: 0 }; // 使用对象包装以便在闭包中修改
    
    for (let teacherId in teacherData) {
      const { quotas } = teacherData[teacherId];
      
      // 如果没有需要更新的指标，跳过
      if (Object.keys(quotas).length === 0) {
        continue;
      }

      // 从缓存中获取导师数据（已在步骤6中查询过）
      const teacher = teacherDbMap[teacherId];
      if (!teacher) {
        continue;
      }

      const quotaSettings = teacher.quota_settings || [];

      // 在内存中计算更新后的 quota_settings
      let hasUpdate = false;
      const updatedQuotaSettings = quotaSettings.map(item => {
        const code = item.code;
        if (quotas[code] && quotas[code] > 0) {
          hasUpdate = true;
          return {
            ...item,
            pending_quota: (item.pending_quota || 0) + quotas[code]
          };
        }
        return item;
      });

      // 如果有更新，创建更新任务
      if (hasUpdate) {
        updateTasks.push({
          teacherId,
          teacherName: teacherData[teacherId].name,
          updatedQuotaSettings
        });
      }
    }

    // 分批并行执行更新（每批10个，避免并发过高）
    const updateBatchSize = 10;
    for (let i = 0; i < updateTasks.length; i += updateBatchSize) {
      const batch = updateTasks.slice(i, i + updateBatchSize);
      
      // 并行执行当前批次的所有更新
      const batchPromises = batch.map(task => {
        return db.collection('Teacher').where({
          Id: task.teacherId
        }).update({
          data: {
            quota_settings: task.updatedQuotaSettings,
            approval_status: "pending",
            approval_timestamp: Date.now()
          }
        }).then(res => {
          successCount.value++;
          return { teacherId: task.teacherId, success: true };
        }).catch(err => {
          console.error(`导师更新失败, ID: ${task.teacherId}`, err);
          failedUpdates.push({
            teacherId: task.teacherId,
            teacherName: task.teacherName,
            error: err.message
          });
          return { teacherId: task.teacherId, success: false };
        });
      });

      // 等待当前批次完成后再处理下一批
      await Promise.all(batchPromises);
    }

    // 9. 更新 TotalQuota 集合（全院指标统计）
    try {
      // 先获取当前的 TotalQuota 数据
      const totalQuotaRes = await db.collection('TotalQuota').doc('totalquota').get();
      const currentTotalQuota = totalQuotaRes.data || {};
      
      // 获取现有的统计数据或初始化为空对象
      const currentLevel1 = currentTotalQuota.level1_quota || {};
      const currentLevel2 = currentTotalQuota.level2_quota || {};
      const currentLevel3 = currentTotalQuota.level3_quota || {};
      
      // 合并一级指标统计
      for (let code in totalQuotaStats.level1) {
        const stat = totalQuotaStats.level1[code];
        if (!currentLevel1[code]) {
          currentLevel1[code] = { code: stat.code, name: stat.name, quota: 0, pending_approval: 0 };
        }
        currentLevel1[code].quota = (currentLevel1[code].quota || 0) + stat.quota;
        // 保留现有的 pending_approval，如果没有则初始化为 0
        if (currentLevel1[code].pending_approval === undefined) {
          currentLevel1[code].pending_approval = 0;
        }
      }
      
      // 合并二级指标统计
      for (let code in totalQuotaStats.level2) {
        const stat = totalQuotaStats.level2[code];
        if (!currentLevel2[code]) {
          currentLevel2[code] = { code: stat.code, name: stat.name, quota: 0, pending_approval: 0 };
        }
        currentLevel2[code].quota = (currentLevel2[code].quota || 0) + stat.quota;
        // 保留现有的 pending_approval，如果没有则初始化为 0
        if (currentLevel2[code].pending_approval === undefined) {
          currentLevel2[code].pending_approval = 0;
        }
      }
      
      // 合并三级指标统计
      for (let code in totalQuotaStats.level3) {
        const stat = totalQuotaStats.level3[code];
        if (!currentLevel3[code]) {
          currentLevel3[code] = { code: stat.code, name: stat.name, quota: 0, pending_approval: 0 };
        }
        currentLevel3[code].quota = (currentLevel3[code].quota || 0) + stat.quota;
        // 保留现有的 pending_approval，如果没有则初始化为 0
        if (currentLevel3[code].pending_approval === undefined) {
          currentLevel3[code].pending_approval = 0;
        }
      }
      
      // 更新 TotalQuota 集合
      await db.collection('TotalQuota').doc('totalquota').update({
        data: {
          level1_quota: currentLevel1,
          level2_quota: currentLevel2,
          level3_quota: currentLevel3,
          last_updated: Date.now()
        }
      });
      
      console.log('TotalQuota 更新成功');
    } catch (totalQuotaErr) {
      // 如果文档不存在，则创建新文档
      if (totalQuotaErr.errCode === -1 || totalQuotaErr.message.includes('not exist')) {
        try {
          // 构建初始数据
          const level1_quota = {};
          const level2_quota = {};
          const level3_quota = {};
          
          for (let code in totalQuotaStats.level1) {
            const stat = totalQuotaStats.level1[code];
            level1_quota[code] = { code: stat.code, name: stat.name, quota: stat.quota, pending_approval: 0 };
          }
          for (let code in totalQuotaStats.level2) {
            const stat = totalQuotaStats.level2[code];
            level2_quota[code] = { code: stat.code, name: stat.name, quota: stat.quota, pending_approval: 0 };
          }
          for (let code in totalQuotaStats.level3) {
            const stat = totalQuotaStats.level3[code];
            level3_quota[code] = { code: stat.code, name: stat.name, quota: stat.quota, pending_approval: 0 };
          }
          
          await db.collection('TotalQuota').add({
            data: {
              _id: 'totalquota',
              level1_quota,
              level2_quota,
              level3_quota,
              last_updated: Date.now()
            }
          });
          console.log('TotalQuota 创建成功');
        } catch (createErr) {
          console.error('TotalQuota 创建失败:', createErr);
        }
      } else {
        console.error('TotalQuota 更新失败:', totalQuotaErr);
      }
    }

    // 10. 返回结果
    const result = { 
      success: true, 
      message: "导师名额更新完成。",
      totalProcessed: updateTasks.length,
      successCount: successCount.value,
      failedCount: failedUpdates.length,
      quotaStats: {
        level1Count: Object.keys(totalQuotaStats.level1).length,
        level2Count: Object.keys(totalQuotaStats.level2).length,
        level3Count: Object.keys(totalQuotaStats.level3).length
      }
    };

    // 如果有失败的更新，返回详情
    if (failedUpdates.length > 0) {
      result.success = false;
      result.message = `部分导师更新失败，成功${successCount.value}个，失败${failedUpdates.length}个`;
      result.failedDetails = failedUpdates;
    }

    return result;
  } catch (error) {
    console.error("更新失败：", error);
    return { success: false, error: error.message };
  }
};