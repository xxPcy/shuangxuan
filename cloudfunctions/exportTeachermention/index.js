// 云函数入口文件
const cloud = require('wx-server-sdk')
const xlsx = require('xlsx');
cloud.init({ env: 'cloud1-2gn42bha8f90b918' }) // 使用当前云环境


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
      const result = await db.collection('Teacher')
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
      return {
        '导师姓名': item.name,
        '账号': item.Id,
        '密码': item.Password,
        '研究方向': item.ezresearch,
        '招生说明': item.description, // 使用调整后的时间
      };
    });

    // 设置列标题
    const header = ['导师姓名', '账号', '密码', '研究方向', '招生说明'];

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
  // const MAX_LIMIT = 30
  // const countRes = await db.collection('Teacher').count()
  // const total = countRes.total
  // const batchTimes = Math.ceil(total / MAX_LIMIT)
  // let allTeachers = []

  // for (let i = 0; i < batchTimes; i++) {
  //   const res = await db.collection('Teacher')
  //     .skip(i * MAX_LIMIT)
  //     .limit(MAX_LIMIT)
  //     .get()
  //   allTeachers = allTeachers.concat(res.data)
  // }

  // // 生成 Excel 表格数据
  // const data = [
  //   ['姓名', '账号', '邮箱', '研究方向', '招生说明'] // 表头
  // ]
  // allTeachers.forEach(item => {
  //   data.push([
  //     item.name || '',
  //     item.Id || '',
  //     item.email || '',
  //     item.ezresearch || '',
  //     item.description || ''
  //   ])
  // })

  // const buffer = xlsx.build([{ name: "TeacherList", data }])
  // const uploadRes = await cloud.uploadFile({
  //   cloudPath: `excel/TeacherList_${Date.now()}.xlsx`,
  //   fileContent: buffer,
  // })

  // return {
  //   fileID: uploadRes.fileID,
  //   total
  // }
}