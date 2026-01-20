// 云函数入口文件，导出双选表
const cloud = require('wx-server-sdk')
const xlsx = require('node-xlsx'); // 用于生成 Excel 文件

cloud.init({ env: 'cloud1-2gn42bha8f90b918' }) // 使用当前云环境

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    // 获取所有学生数据
    const studentsCollection = db.collection('Stu');
    const allData = [];

    // 分批查询，确保数据完整
    let hasMore = true;
    let skip = 0;
    const LIMIT = 100; // 每次查询 100 条

    while (hasMore) {
      const res = await studentsCollection
        .skip(skip)
        .limit(LIMIT)
        .get();

      allData.push(...res.data);

      if (res.data.length < LIMIT) {
        hasMore = false; // 没有更多数据
      } else {
        skip += LIMIT;
      }
    }

    // 生成 Excel 数据
    const data = [
      ['学生姓名', '学号', '选择导师'], // 表头
      // ['学生姓名', '学号', '选择导师', '硕士类型', '专业方向'], // 表头
    ];
    allData.forEach(student => {
      data.push([
        student.name, // 学生姓名
        student.Id, // 学号
        student.selected || '未选择导师', // 导师全名
        // student.masterType || '未填写', // 硕士类型
        // student.major || '未填写', // 专业方向
      ]);
    });

    // 生成 Excel 文件
    const buffer = xlsx.build([{ name: '学生名单', data }]);

    // 上传文件到云存储
    const uploadRes = await cloud.uploadFile({
      cloudPath: `exports/students_${Date.now()}.xlsx`,
      fileContent: buffer,
    });

    return {
      fileID: uploadRes.fileID,
    };
  } catch (error) {
    console.error('导出失败', error);
    return {
      error: '导出失败',
    };
  }
};