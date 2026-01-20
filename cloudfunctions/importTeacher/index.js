// const cloud = require('wx-server-sdk');
// const xlsx = require('node-xlsx');

// cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// exports.main = async (event, context) => {
//   const { fileId } = event;
//   const db = cloud.database();

//   try {
//     // 下载 Excel 文件
//     const fileRes = await cloud.downloadFile({
//       fileID: fileId
//     });
//     const fileData = fileRes.fileContent;

//     // 解析 Excel 文件内容
//     const sheets = xlsx.parse(fileData);
//     const sheetData = sheets[0].data; // 获取第一个工作表的数据

//     // 检查是否包含有效数据
//     if (sheetData.length <= 1) {
//       return { error: 'Excel 文件没有有效的数据' };
//     }

//     // 定义导师数据库默认字段
//     const defaultFields = {

//       prestudent: [], // 默认空数组，存储导师的预选学生
//       student: [], // 存储被选择的学生名单
//       dqgczs:0,
//       dqgcxs:0,
//       dqgclp:0,
//       dzxxzs:0,
//       dzxxlp:0,
//       kongzhiX:0,
//       dzxxpartTime:100,
//       dqgcpartTime:100,
//       dzxxsoldier:100,
//       dqgcsoldier:100,
//       // 可以根据需求添加更多字段
//     };

//     // 跳过标题行，从第二行开始读取数据并存储到数据库
//     const tasks = [];
//     for (let i = 1; i < sheetData.length; i++) { // 从索引 1 开始跳过标题行
//       const [name, Id, Password] = sheetData[i];
      
//       if (name && Id && Password) {
//         const task = db.collection('Teacher').add({
//           data: {
//             name,
//             Id,
//             Password,
//             ...defaultFields // 自动填充默认字段
//           }
//         });
//         tasks.push(task);
//       }
//     }

//     // 执行所有数据库插入操作
//     await Promise.all(tasks);

//     return { success: true };
//   } catch (err) {
//     console.error('导师信息导入失败', err);
//     return { error: err };
//   }
// };

// cloudfunctions/importTeacher/index.js
const cloud = require('wx-server-sdk');
const xlsx = require('node-xlsx');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 辅助工具：深度克隆对象（防止所有导师共用一个内存地址）
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

exports.main = async (event, context) => {
  const { fileId } = event;
  const db = cloud.database();
  const _ = db.command;

  try {
    // ==========================================
    // 第一步：准备指标模板 (从 Logic 表提取)
    // ==========================================
    
    // 1. 获取所有 Logic 数据 (假设不超过 1000 条，如果超过需分批，但学院专业通常很少)
    const logicRes = await db.collection('Logic').limit(1000).get();
    const logicList = logicRes.data;

    // 2. 提取去重的所有代码 (使用 Map 保证代码唯一)
    // 结构：Code -> { code, name, type }
    const quotaMap = new Map();

    logicList.forEach(item => {
      // 提取一级
      if (item.level1_code && !quotaMap.has(item.level1_code)) {
        quotaMap.set(item.level1_code, {
          code: String(item.level1_code).trim(),
          name: String(item.level1_name).trim(),
          type: 'level1'
        });
      }
      // 提取二级
      if (item.level2_code && !quotaMap.has(item.level2_code)) {
        quotaMap.set(item.level2_code, {
          code: String(item.level2_code).trim(),
          name: String(item.level2_name).trim(),
          type: 'level2'
        });
      }
      // 提取三级
      if (item.level3_code && !quotaMap.has(item.level3_code)) {
        quotaMap.set(item.level3_code, {
          code: String(item.level3_code).trim(),
          name: String(item.level3_name).trim(),
          type: 'level3'
        });
      }
    });

    // 3. 生成标准的初始化模板数组
    // 排序：按代码长度和数值排序，让 08 排在 0854 前面
    const quotaTemplate = Array.from(quotaMap.values())
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(item => ({
        ...item,
        max_quota: 0,      // 总分配名额
        pending_quota: 0,  // 待审核名额 (初始为0，管理员分配后增加)
        used_quota: 0      // 已招收名额
      }));

    console.log('生成的指标模板:', quotaTemplate); // 调试用

    // ==========================================
    // 第二步：解析 Excel 并导入导师
    // ==========================================

    const fileRes = await cloud.downloadFile({ fileID: fileId });
    const sheets = xlsx.parse(fileRes.fileContent);
    const sheetData = sheets[0].data;

    if (!sheetData || sheetData.length <= 1) {
      return { success: false, error: 'Excel 无有效数据' };
    }

    const defaultFields = {
      prestudent: [],
      student: [],
      // quota_settings 不在这里写死，后面动态赋值
      dzxxpartTime: 999,
      dqgcpartTime: 999,
      picture: 'https://ts1.cn.mm.bing.net/th/id/R-C.65a7cf49062527574b46dc6ba3edbb6a?rik=B6%2f9blOWJLCK1A&riu=http%3a%2f%2fpic43.photophoto.cn%2f20170506%2f0470102348231008_b.jpg&ehk=E2MSZL%2bfE%2bsf2JxuC8F4OaYE%2b6icJ8k6bKgwWQnPRV4%3d&risl=&pid=ImgRaw&r=0',
      createTime: new Date()
    };

    const teachersToInsert = [];
    const teacherIdsInSheet = [];

    // 从 Excel 第 2 行开始读取
    for (let i = 1; i < sheetData.length; i++) {
      const row = sheetData[i];
      if (!row[0] || !row[1]) continue;

      const idStr = String(row[1]).trim();
      teacherIdsInSheet.push(idStr);

      teachersToInsert.push({
        name: String(row[0]).trim(),
        Id: idStr,
        Password: String(row[2] || '123456').trim(),
        Jobposition: String(row[3] || '导师').trim(),
        
        ...defaultFields,
        // 【核心】注入初始化好的指标数组
        // 必须使用深拷贝，确保每个老师的数据是独立的
        quota_settings: deepClone(quotaTemplate) 
      });
    }

    // ==========================================
    // 第三步：查重与入库
    // ==========================================

    if (teachersToInsert.length === 0) return { success: false, error: '无有效数据' };

    // 查重 (只查 Excel 里有的 ID)
    const duplicateRes = await db.collection('Teacher').where({
      Id: _.in(teacherIdsInSheet)
    }).field({ Id: 1 }).get();
    
    const duplicateIds = duplicateRes.data.map(t => t.Id);
    
    // 过滤
    const finalData = teachersToInsert.filter(t => !duplicateIds.includes(t.Id));

    // 批量插入
    if (finalData.length > 0) {
      const batchSize = 20;
      for (let i = 0; i < finalData.length; i += batchSize) {
        const batch = finalData.slice(i, i + batchSize);
        await Promise.all(batch.map(t => db.collection('Teacher').add({ data: t })));
      }
    }

    // 清理文件
    try { await cloud.deleteFile({ fileList: [fileId] }); } catch (e) {}

    return {
      success: true,
      added: finalData.length,
      skipped: duplicateIds.length,
      // 返回模板长度告诉前端生成了多少个指标项
      templateSize: quotaTemplate.length 
    };

  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};