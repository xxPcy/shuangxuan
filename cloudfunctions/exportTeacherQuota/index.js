




// const cloud = require('wx-server-sdk');
// const xlsx = require('node-xlsx');

// cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// const quotaCategories = [
//   { label: '电子信息（专硕）', key: 'dzxxzs', usedKey: 'used_dzxxzs' },
//   { label: '控制科学与工程（学硕）', key: 'kongzhiX', usedKey: 'used_kongzhiX' },
//   { label: '电气工程（专硕）', key: 'dqgczs', usedKey: 'used_dqgczs' },
//   { label: '电气工程（学硕）', key: 'dqgcxs', usedKey: 'used_dqgcxs' },
//   { label: '电子信息（联培）', key: 'dzxxlp', usedKey: 'used_dzxxlp' },
//   { label: '电气工程（联培）', key: 'dqgclp', usedKey: 'used_dqgclp' },
//   { label: '电气工程（非全）', key: 'dqgcpartTime', usedKey: 'used_dqgcpartTime' },
//   { label: '电气工程（士兵）', key: 'dqgcsoldier', usedKey: 'used_dqgcsoldier' },
//   { label: '电子信息（非全）', key: 'dzxxpartTime', usedKey: 'used_dzxxpartTime' },
//   { label: '电子信息（士兵）', key: 'dzxxsoldier', usedKey: 'used_dzxxsoldier' }
// ];

// exports.main = async (event, context) => {
//   try {
//     const db = cloud.database();

//     // 获取所有导师数据
//     const teachersRes = await db.collection('Teacher').get();
//     const teachers = teachersRes.data;

//     // 构建 Excel 数据
//     const data = [[
//       '导师姓名', '导师ID', '专业类别', '总名额', '已招生人数', '剩余名额', '已招学生姓名'
//     ]];

//     // 用于记录合并单元格的范围
//     const merges = [];

//     // 遍历每个导师
//     teachers.forEach((teacher, teacherIndex) => {
//       const teacherName = teacher.name;
//       const teacherId = teacher.Id;
//       const startRow = data.length; // 记录当前导师数据起始行

//       // 遍历所有专业类别
//       quotaCategories.forEach(category => {
//         const totalQuota = teacher[category.key] || 0;
//         const usedQuota = teacher[category.usedKey] || 0; // 直接读取 used_xxx 字段
//         const remaining = Math.max(totalQuota - usedQuota, 0);

//         // 获取该专业已招学生姓名（假设 students 字段包含学生列表）
//         const students = (teacher.students || [])
//           .filter(s => s.categoryKey === category.key)
//           .map(s => s.name || '未知姓名')
//           .join(', ') || '无';

//         data.push([
//           teacherName,
//           teacherId,
//           category.label,
//           totalQuota,
//           usedQuota, // 使用 used_xxx 字段值
//           remaining,
//           students
//         ]);
//       });

//       // 记录合并范围（合并导师姓名和ID）
//       const endRow = data.length - 1;
//       if (endRow > startRow) {
//         merges.push(
//           { s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } }, // 合并姓名列
//           { s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } }  // 合并ID列
//         );
//       }
//     });

//     // 检查数据有效性
//     if (data.length <= 1) throw new Error('无有效数据可导出');

//     // 生成 Excel 文件（添加 merges 配置）
//     const buffer = xlsx.build([{
//       name: '导师招生详情',
//       data: data,
//       options: { '!merges': merges } // 关键：设置合并单元格范围
//     }]);

//     // 上传云存储
//     const uploadRes = await cloud.uploadFile({
//       cloudPath: `enrollment_stats/teacher_quota_${Date.now()}.xlsx`,
//       fileContent: buffer
//     });

//     return { fileID: uploadRes.fileID };

//   } catch (err) {
//     console.error('导出失败:', err);
//     return { error: err.message };
//   }
// };

// const cloud = require('wx-server-sdk');
// const xlsx = require('node-xlsx');

// cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// const quotaCategories = [
//   { label: '电子信息（专硕）', key: 'dzxxzs', usedKey: 'used_dzxxzs' },
//   { label: '控制科学与工程（学硕）', key: 'kongzhiX', usedKey: 'used_kongzhiX' },
//   { label: '电气工程（专硕）', key: 'dqgczs', usedKey: 'used_dqgczs' },
//   { label: '电气工程（学硕）', key: 'dqgcxs', usedKey: 'used_dqgcxs' },
//   { label: '电子信息（联培）', key: 'dzxxlp', usedKey: 'used_dzxxlp' },
//   { label: '电气工程（联培）', key: 'dqgclp', usedKey: 'used_dqgclp' },
//   { label: '电气工程（非全）', key: 'dqgcpartTime', usedKey: 'used_dqgcpartTime' },
//   { label: '电气工程（士兵）', key: 'dqgcsoldier', usedKey: 'used_dqgcsoldier' },
//   { label: '电子信息（非全）', key: 'dzxxpartTime', usedKey: 'used_dzxxpartTime' },
//   { label: '电子信息（士兵）', key: 'dzxxsoldier', usedKey: 'used_dzxxsoldier' }
// ];

// exports.main = async (event, context) => {
//   try {
//     const db = cloud.database();
//     const teachersRes = await db.collection('Teacher').get();
//     const teachers = teachersRes.data;

//     const data = [[
//       '导师姓名', '导师ID', '专业类别', '总名额', '已招生人数', '剩余名额', '已招学生姓名'
//     ]];
//     const merges = [];

//     teachers.forEach((teacher, teacherIndex) => {
//       const teacherName = teacher.name;
//       const teacherId = teacher.Id;
//       const startRow = data.length;

//       quotaCategories.forEach(category => {
//         const totalQuota = teacher[category.key] || 0;
//         const usedQuota = teacher[category.usedKey] || 0;
//         const remaining = Math.max(totalQuota - usedQuota, 0);

//         // 关键修改：使用 student 字段（单数）
//         const students = (teacher.students || []) // 注意这里是 student（单数）！
//           .filter(s => s.specialized === category.key) // 按专业筛选
//           .map(s => s.studentName || '未知学生') // 提取姓名字段
//           .join(', ') || '无'; // 处理空值

//         data.push([
//           teacherName,
//           teacherId,
//           category.label,
//           totalQuota,
//           usedQuota,
//           remaining,
//           students // 显示实际学生姓名
//         ]);
//       });

//       // 合并单元格逻辑
//       const endRow = data.length - 1;
//       if (endRow > startRow) {
//         merges.push(
//           { s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } }, // 合并姓名列
//           { s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } }  // 合并ID列
//         );
//       }
//     });

//     if (data.length <= 1) throw new Error('无有效数据可导出');

//     // 生成 Excel 文件（包含合并配置）
//     const buffer = xlsx.build([{
//       name: '导师招生详情',
//       data: data,
//       options: { '!merges': merges }
//     }]);

//     // 上传云存储
//     const uploadRes = await cloud.uploadFile({
//       cloudPath: `enrollment_stats/teacher_quota_${Date.now()}.xlsx`,
//       fileContent: buffer
//     });

//     return { fileID: uploadRes.fileID };

//   } catch (err) {
//     console.error('导出失败:', err);
//     return { error: err.message };
//   }
// };



// 云函数入口文件，导出双选招生表
const cloud = require('wx-server-sdk');
const xlsx = require('node-xlsx');

cloud.init({ env: 'cloud1-2gn42bha8f90b918' });

const quotaCategories = [
  { label: '电子信息专硕', key: 'dzxxzs', usedKey: 'used_dzxxzs' },
  { label: '控制科学与工程', key: 'kongzhiX', usedKey: 'used_kongzhiX' },
  { label: '电气工程专硕', key: 'dqgczs', usedKey: 'used_dqgczs' },
  { label: '电气工程学硕', key: 'dqgcxs', usedKey: 'used_dqgcxs' },
  { label: '电子信息联培', key: 'dzxxlp', usedKey: 'used_dzxxlp' },
  { label: '电气工程联培', key: 'dqgclp', usedKey: 'used_dqgclp' },
  { label: '电气工程非全', key: 'dqgcpartTime', usedKey: 'used_dqgcpartTime' },
  { label: '电气工程士兵', key: 'dqgcsoldier', usedKey: 'used_dqgcsoldier' },
  { label: '电子信息非全', key: 'dzxxpartTime', usedKey: 'used_dzxxpartTime' },
  { label: '电子信息士兵', key: 'dzxxsoldier', usedKey: 'used_dzxxsoldier' }
];

exports.main = async (event, context) => {
  try {
    const db = cloud.database();
    const teachersCollection = db.collection('Teacher');

    // 分页查询获取所有老师数据
    let teachers = [];
    let skip = 0;
    const limit = 100; // 每次最多查询 100 条记录
    let res;
    do {
      res = await teachersCollection.skip(skip).limit(limit).get();
      teachers = teachers.concat(res.data);
      skip += limit;
    } while (res.data.length === limit);

    // 初始化 Excel 表头
    const data = [[
      '导师姓名', '导师ID', '专业类别', '总名额', '已招生人数', '剩余名额', '已招学生姓名'
    ]];
    const merges = [];

    // 遍历每位导师，生成对应的专业数据行
    teachers.forEach((teacher) => {
      const teacherName = teacher.name;
      const teacherId = teacher.Id;
      const startRow = data.length;

      quotaCategories.forEach(category => {
       // const totalQuota = teacher[category.key] || 0;
        //const usedQuota = teacher[category.usedKey] || 0;
        //const remaining = Math.max(totalQuota - usedQuota, 0);

        const usedQuota = teacher[category.usedKey] || 0; // 已使用名额
        const remaining = teacher[category.key] || 0; // 剩余名额
        const totalQuota = usedQuota + remaining; // 动态计算总名额

        const students = (teacher.student || [])
          .filter(s => {
            // 使用 .trim() 和 .toLowerCase() 确保匹配不受大小写和空格影响
            return s.categoryKey.trim().toLowerCase() === category.key.trim().toLowerCase();
          })
          .map(s => s.studentName || '未知学生')
          .join(', ') || '无';

        data.push([
          teacherName,
          teacherId,
          category.label,
          totalQuota,
          usedQuota,
          remaining,
          students
        ]);
      });

      // 对同一导师的多条数据进行合并（导师姓名和导师ID列）
      const endRow = data.length - 1;
      if (endRow > startRow) {
        merges.push(
          { s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } },
          { s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } }
        );
      }
    });

    if (data.length <= 1) throw new Error('无有效数据可导出');

    // 生成 Excel 文件
    const buffer = xlsx.build([{
      name: '导师招生详情',
      data: data,
      options: { '!merges': merges }
    }]);

    // 上传生成的 Excel 文件到云存储
    const uploadRes = await cloud.uploadFile({
      cloudPath: `enrollment_stats/teacher_quota_${Date.now()}.xlsx`,
      fileContent: buffer
    });

    return { fileID: uploadRes.fileID };
  } catch (err) {
    console.error('导出失败:', err);
    return { error: err.message };
  }
};
