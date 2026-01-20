// // 云函数入口文件 - 导入逻辑表
// const cloud = require('wx-server-sdk');
// const xlsx = require('node-xlsx');

// cloud.init({ env: 'cloud1-2gn42bha8f90b918' });

// // 云函数入口函数
// exports.main = async (event, context) => {
//   const { fileId } = event;
//   const db = cloud.database();

//   try {
//     // 下载 Excel 文件
//     const fileRes = await cloud.downloadFile({
//       fileID: fileId,
//       timeout: 10000
//     });
//     const fileData = fileRes.fileContent;

//     // 解析 Excel 文件内容
//     const sheets = xlsx.parse(fileData);
//     const sheetData = sheets[0].data; // 获取第一个工作表的数据

//     // 检查是否包含有效数据（至少有表头和一行数据）
//     if (sheetData.length <= 1) {
//       return { success: false, error: 'Excel 文件没有有效的数据' };
//     }

//     // 表头：一级名称, 一级代码, 二级名称, 二级代码, 三级名称, 三级代码
//     // 索引：   0        1         2        3         4        5
//     const header = sheetData[0];
//     console.log('表头:', header);

//     // 验证表头是否正确
//     const expectedHeaders = ['一级名称', '一级代码', '二级名称', '二级代码', '三级名称', '三级代码'];
//     const headerValid = expectedHeaders.every((h, i) => {
//       const actual = String(header[i] || '').trim();
//       return actual === h;
//     });

//     if (!headerValid) {
//       return { 
//         success: false, 
//         error: 'Excel 表头格式不正确，请确保列顺序为：一级名称, 一级代码, 二级名称, 二级代码, 三级名称, 三级代码' 
//       };
//     }

//     // 准备要插入的数据
//     const dataToInsert = [];
    
//     for (let i = 1; i < sheetData.length; i++) {
//       const row = sheetData[i];
      
//       // 跳过空行
//       if (!row || row.length === 0 || !row[0]) {
//         continue;
//       }

//       // 提取数据，代码作为字段名，名称作为值
//       const record = {
//         // 一级：代码作为字段，名称作为值
//         level1_code: String(row[1] || '').trim(),
//         level1_name: String(row[0] || '').trim(),
        
//         // 二级：代码作为字段，名称作为值
//         level2_code: String(row[3] || '').trim(),
//         level2_name: String(row[2] || '').trim(),
        
//         // 三级：代码作为字段，名称作为值
//         level3_code: String(row[5] || '').trim(),
//         level3_name: String(row[4] || '').trim(),
        
//         // 添加时间戳
//         createTime: db.serverDate()
//       };

//       dataToInsert.push(record);
//     }

//     if (dataToInsert.length === 0) {
//       return { success: false, error: '没有有效的数据行可以导入' };
//     }

//     // 先清空原有的 Logic 集合数据（可选，根据需求决定）
//     // 如果需要追加数据而不是覆盖，可以注释掉下面这段代码
//     try {
//       const countRes = await db.collection('Logic').count();
//       if (countRes.total > 0) {
//         // 分批删除（云数据库每次最多删除100条）
//         const batchTimes = Math.ceil(countRes.total / 100);
//         for (let i = 0; i < batchTimes; i++) {
//           const deleteRes = await db.collection('Logic').where({
//             _id: db.command.exists(true)
//           }).limit(100).get();
          
//           const deletePromises = deleteRes.data.map(item => 
//             db.collection('Logic').doc(item._id).remove()
//           );
//           await Promise.all(deletePromises);
//         }
//       }
//     } catch (clearErr) {
//       console.log('清空集合时出错（可能集合不存在）:', clearErr);
//       // 继续执行，集合可能不存在
//     }

//     // 批量插入数据（云数据库每次最多插入20条）
//     const batchSize = 20;
//     let successCount = 0;
//     let failCount = 0;
//     const errors = [];

//     for (let i = 0; i < dataToInsert.length; i += batchSize) {
//       const batch = dataToInsert.slice(i, i + batchSize);
      
//       const insertPromises = batch.map(async (record, index) => {
//         try {
//           await db.collection('Logic').add({
//             data: record
//           });
//           return { success: true };
//         } catch (err) {
//           return { 
//             success: false, 
//             error: err.message,
//             row: i + index + 2 // Excel行号（+2因为索引从0开始且有表头）
//           };
//         }
//       });

//       const results = await Promise.all(insertPromises);
//       results.forEach(r => {
//         if (r.success) {
//           successCount++;
//         } else {
//           failCount++;
//           errors.push(r);
//         }
//       });
//     }

//     // 删除云存储中的临时文件
//     try {
//       await cloud.deleteFile({
//         fileList: [fileId]
//       });
//     } catch (delErr) {
//       console.log('删除临时文件失败:', delErr);
//     }

//     return {
//       success: failCount === 0,
//       message: `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
//       total: dataToInsert.length,
//       successCount,
//       failCount,
//       errors: errors.length > 0 ? errors : undefined
//     };

//   } catch (err) {
//     console.error('逻辑表导入失败', err);
//     return { 
//       success: false, 
//       error: err.message || '导入失败，请检查文件格式'
//     };
//   }
// };


// 云函数入口文件
const cloud = require('wx-server-sdk');
const xlsx = require('node-xlsx');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { fileId } = event;
  const db = cloud.database();
  const _ = db.command;

  try {
    // 1. 下载 Excel 文件
    const fileRes = await cloud.downloadFile({ fileID: fileId });
    const fileData = fileRes.fileContent;

    // 2. 解析 Excel
    const sheets = xlsx.parse(fileData);
    const sheetData = sheets[0].data; // 获取第一个 Sheet

    // 3. 基础校验
    if (!sheetData || sheetData.length <= 1) {
      return { success: false, error: 'Excel 文件为空或无有效数据' };
    }

    // 4. 校验表头 (防止用户上传错模板)
    // 假设模板顺序：一级名称, 一级代码, 二级名称, 二级代码, 三级名称, 三级代码
    const header = sheetData[0];
    const expectedHeaders = ['一级名称', '一级代码', '二级名称', '二级代码', '三级名称', '三级代码'];
    // 简单校验前两个字段，确保模板大概率是对的
    if (String(header[0]).trim() !== expectedHeaders[0] || String(header[1]).trim() !== expectedHeaders[1]) {
      return { success: false, error: '表头格式错误，请严格按照模板上传：一级名称, 一级代码...' };
    }

    // 5. 组装数据 (准备插入)
    const dataToInsert = [];
    const now = new Date();

    for (let i = 1; i < sheetData.length; i++) {
      const row = sheetData[i];
      // 跳过空行（有些Excel看起来是空的但其实有格式）
      if (!row || row.length === 0 || !row[0]) continue;

      dataToInsert.push({
        // 【关键】必须强制转 String，否则 excel 里的 '08' 会变成数字 8，导致匹配失败
        level1_name: String(row[0] || '').trim(),
        level1_code: String(row[1] || '').trim(),
        
        level2_name: String(row[2] || '').trim(),
        level2_code: String(row[3] || '').trim(),
        
        level3_name: String(row[4] || '').trim(),
        level3_code: String(row[5] || '').trim(),
        
        createTime: now
      });
    }

    if (dataToInsert.length === 0) {
      return { success: false, error: '未解析到有效数据行' };
    }

    // 6. 【极速清空】逻辑
    // 为了保证这是一个“全新的学院逻辑”，我们需要先清空 Logic 表
    // 使用 where 匹配所有记录进行删除 (比循环删除快得多)
    try {
      await db.collection('Logic').where({
        _id: _.exists(true) // 匹配所有存在 _id 的记录（即所有记录）
      }).remove();
    } catch (clearErr) {
      // 忽略“集合为空”等非关键错误
      console.log('清空 Logic 表可能有误（初次使用可忽略）:', clearErr);
    }

    // 7. 【批量插入】逻辑
    // 微信云开发限制单次请求并发数，这里按 20 条一批进行插入
    const batchSize = 20;
    let successCount = 0;
    
    for (let i = 0; i < dataToInsert.length; i += batchSize) {
      const batch = dataToInsert.slice(i, i + batchSize);
      
      // 使用 map + Promise.all 并发处理这一批
      const tasks = batch.map(record => {
        return db.collection('Logic').add({ data: record });
      });

      await Promise.all(tasks);
      successCount += batch.length;
    }

    // 8. 清理云存储临时文件
    try {
      await cloud.deleteFile({ fileList: [fileId] });
    } catch (e) {}

    return {
      success: true,
      message: `导入成功，共重置 ${successCount} 条专业逻辑`,
      count: successCount
    };

  } catch (err) {
    console.error('Logic导入报错:', err);
    return {
      success: false,
      error: err.message || '导入过程发生未知错误'
    };
  }
};