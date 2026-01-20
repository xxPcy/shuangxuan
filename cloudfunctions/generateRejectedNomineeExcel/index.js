// // 云函数入口文件
// const cloud = require('wx-server-sdk');
// const xlsx = require('xlsx');
// cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

// // 云函数入口函数
// exports.main = async (event, context) => {
//   try {
//     const db = cloud.database();
//     const MAX_LIMIT = 100; // 每次查询的最大记录数
//     let allData = []; // 存储所有记录
//     let hasMore = true;
//     let offset = 0;

//     // 分页查询所有记录
//     while (hasMore) {
//       const result = await db.collection('RejectedQuota')
//         .orderBy('timestamp', 'desc')
//         .skip(offset)
//         .limit(MAX_LIMIT)
//         .get();

//       allData = allData.concat(result.data); // 累积数据
//       offset += result.data.length; // 更新偏移量
//       hasMore = result.data.length === MAX_LIMIT; // 如果返回的记录数等于限制，说明还有数据
//       console.log(`已获取 ${offset} 条记录`);
//     }

//     if (allData.length === 0) {
//       throw new Error('没有退回记录');
//     }

//     // 提取数据并重新排列列顺序
//     const data = allData.map(item => ({
//       '导师姓名': item.teacherName,
//       'Id': item.teacherId,
//       '退回的专业名称': item.label,
//       '数量': item.rejectedValue,
//       '原因': item.reason,
//       '时间': new Date(item.timestamp).toLocaleString(),
//     }));

//     // 设置列标题
//     const header = ['导师姓名', 'Id', '退回的专业名称', '数量', '原因', '时间'];

//     // 创建工作表（json_to_sheet 的第二个参数用于设置列标题）
//     const ws = xlsx.utils.json_to_sheet(data, { header });

//     // 创建工作簿
//     const wb = xlsx.utils.book_new();
//     xlsx.utils.book_append_sheet(wb, ws, 'Rejected Nominees');

//     // 将工作簿转为二进制数据
//     const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });

//     // 上传文件并返回文件ID
//     const fileUploadResult = await cloud.uploadFile({
//       cloudPath: `rejected_nominees_${new Date().getTime()}.xlsx`, // 添加时间戳避免文件名冲突
//       fileContent: buffer, // 文件内容
//     });

//     // 返回文件ID，供前端下载
//     return { fileID: fileUploadResult.fileID }; // 返回文件ID
//   } catch (error) {
//     console.error('云函数执行错误:', error);
//     return { error: error.message }; // 如果出错返回错误信息
//   }
// };




// 云函数入口文件
const cloud = require('wx-server-sdk');
const xlsx = require('xlsx');
cloud.init({ env: 'cloud1-2gn42bha8f90b918' }); // 使用当前云环境

// 辅助函数：格式化时间为 YYYY-MM-DD HH:mm:ss（转换为北京时间）
function formatDate(date) {
  // 将 UTC 时间转换为北京时间（UTC+8）
  const cstDate = new Date(date.getTime() + 8 * 60 * 60 * 1000); // 加 8 小时
  const year = cstDate.getFullYear();
  const month = String(cstDate.getMonth() + 1).padStart(2, '0');
  const day = String(cstDate.getDate()).padStart(2, '0');
  const hours = String(cstDate.getHours()).padStart(2, '0');
  const minutes = String(cstDate.getMinutes()).padStart(2, '0');
  const seconds = String(cstDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const db = cloud.database();
    const MAX_LIMIT = 100; // 每次查询的最大记录数
    let allData = []; // 存储所有记录
    let hasMore = true;
    let offset = 0;

    // 分页查询所有记录
    while (hasMore) {
      const result = await db.collection('RejectedQuota')
        .orderBy('timestamp', 'desc')
        .skip(offset)
        .limit(MAX_LIMIT)
        .get();

      allData = allData.concat(result.data); // 累积数据
      offset += result.data.length; // 更新偏移量
      hasMore = result.data.length === MAX_LIMIT; // 如果返回的记录数等于限制，说明还有数据
      console.log(`已获取 ${offset} 条记录`);
    }

    if (allData.length === 0) {
      throw new Error('没有退回记录');
    }

    // 提取数据并重新排列列顺序
    const data = allData.map(item => {
      const timestampDate = new Date(item.timestamp);
      return {
        '导师姓名': item.teacherName,
        'Id': item.teacherId,
        '退回的专业名称': item.label,
        '数量': item.rejectedValue,
        '原因': item.reason,
        '时间': formatDate(timestampDate), // 使用调整后的时间
      };
    });

    // 设置列标题
    const header = ['导师姓名', 'Id', '退回的专业名称', '数量', '原因', '时间'];

    // 创建工作表
    const ws = xlsx.utils.json_to_sheet(data, { header });

    // 创建工作簿
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Rejected Nominees');

    // 将工作簿转为二进制数据
    const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // 上传文件并返回文件ID
    const fileUploadResult = await cloud.uploadFile({
      cloudPath: `rejected_nominees_${new Date().getTime()}.xlsx`,
      fileContent: buffer,
    });

    // 返回文件ID，供前端下载
    return { fileID: fileUploadResult.fileID };
  } catch (error) {
    console.error('云函数执行错误:', error);
    return { error: error.message };
  }
};