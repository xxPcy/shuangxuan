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

//     // 定义学生数据库默认字段
//     const defaultFields = {
//       status: 'chosing', // 学生状态默认为 "chosing"
//       preselection: [], // 默认空数组，存储学生申请的导师
//       reason: '', // 拒绝理由默认为空
//       selected: '', // 被选择导师的姓名，默认空
//       selectedTecId: '',
//       //这里可以加初始化字段
//     };

//     // 跳过标题行，从第二行开始读取数据并存储到数据库
//     const tasks = [];
//     for (let i = 1; i < sheetData.length; i++) { // 从索引 1 开始跳过标题行
//       const [name, Id, Password, Bigtype, specialized] = sheetData[i];
      
//       if (name && Id && Password && Bigtype && specialized) {
//         const task = db.collection('Stu').add({
//           data: {
//             name,
//             Id,
//             Password,
//             Bigtype,
//             specialized,
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
//     console.error('学生信息导入失败', err);
//     return { error: err };
//   }
// };



const cloud = require('wx-server-sdk');
const xlsx = require('node-xlsx');

cloud.init({ env: 'cloud1-2gn42bha8f90b918' });

exports.main = async (event, context) => {
  const { fileId } = event;
  const db = cloud.database();

  try {
    // 下载 Excel 文件
    const fileRes = await cloud.downloadFile({
      fileID: fileId,
      timeout: 5000 // 设置超时为 5 秒
    });

    if (!fileRes.fileContent) {
      return { error: '文件下载失败，内容为空' };
    }

    const fileData = fileRes.fileContent;

    // 解析 Excel 文件内容
    const sheets = xlsx.parse(fileData);
    const sheetData = sheets[0].data; // 获取第一个工作表的数据

    // 检查是否包含有效数据
    if (sheetData.length <= 1) {
      return { error: 'Excel 文件没有有效的数据' };
    }

    // 定义学生数据库默认字段
    const defaultFields = {
      status: 'chosing', // 学生状态默认为 "chosing"
      preselection: [], // 默认空数组，存储学生申请的导师
      reason: [], // 拒绝理由默认为空
      selected: '', // 被选择导师的姓名，默认空
      selectedTecId: '',
      // 这里可以加初始化字段
    };

    // 获取 Logic 表中的所有数据，用于匹配专业代码
    const logicDataRes = await db.collection('Logic').limit(1000).get();
    const logicData = logicDataRes.data;

    // 构建专业代码映射表：三级代码 -> {一级代码, 二级代码, 一级名称, 二级名称, 三级名称}
    const logicMap = {};
    logicData.forEach(item => {
      logicMap[item.level3_code] = {
        level1_code: item.level1_code,
        level1_name: item.level1_name,
        level2_code: item.level2_code,
        level2_name: item.level2_name,
        level3_code: item.level3_code,
        level3_name: item.level3_name
      };
    });

    // 获取所有学生Id，减少数据库查询次数
    const existingStudentsQuery = await db.collection('Stu')
      .field('Id') // 只获取学生的 Id 字段
      .get();

    const existingIds = existingStudentsQuery.data.map(student => student.Id);

    const tasks = [];
    const existingStudents = []; // 用于存储已存在学生的名字和Id
    const unmatchedStudents = []; // 用于存储专业代码匹配失败的学生

    // 跳过标题行，从第二行开始读取数据并存储到数据库
    // Excel列顺序: 学生姓名(name), 账号(Id), 密码(Password), 类别(Bigtype), 专业(specialized), 专业代码, 学制
    for (let i = 1; i < sheetData.length; i++) { // 从索引 1 开始跳过标题行
      const [name, Id, Password, Bigtype, specialized, specializedCode, studySystem] = sheetData[i];

      if (name && Id && Password && Bigtype && specialized) {
        if (existingIds.includes(String(Id))) {
          existingStudents.push({ name, Id }); // 如果 Id 存在，则记录学生姓名和Id
        } else {
          // 根据专业代码查找 Logic 表中的一级、二级代码
          const codeStr = String(specializedCode || '').trim();
          const logicInfo = logicMap[codeStr];

          // 构建学生数据
          const studentData = {
            name: String(name).trim(),
            Id: String(Id).trim(),
            Password: String(Password).trim(),
            Bigtype: String(Bigtype).trim(),
            specialized: String(specialized).trim(),
            specializedCode: codeStr, // 三级专业代码
            studySystem: String(studySystem || '').trim(), // 学制
            ...defaultFields // 自动填充默认字段
          };

          // 如果找到了对应的逻辑表数据，添加一级、二级代码和名称
          if (logicInfo) {
            studentData.level1_code = logicInfo.level1_code;
            studentData.level1_name = logicInfo.level1_name;
            studentData.level2_code = logicInfo.level2_code;
            studentData.level2_name = logicInfo.level2_name;
            studentData.level3_code = logicInfo.level3_code;
            studentData.level3_name = logicInfo.level3_name;
          } else {
            // 专业代码未匹配到，记录下来
            unmatchedStudents.push({ name, Id, specializedCode: codeStr });
          }

          const task = db.collection('Stu').add({
            data: studentData
          });
          tasks.push(task);
        }
      }
    }

    // 执行所有数据库插入操作
    await Promise.all(tasks);

    // 构建返回结果
    const result = { success: true };

    // 如果存在重复的学生，返回相关信息
    if (existingStudents.length > 0) {
      result.existingStudents = existingStudents;
    }

    // 如果有专业代码未匹配的学生，也返回提示
    if (unmatchedStudents.length > 0) {
      result.unmatchedStudents = unmatchedStudents;
      result.warning = `有 ${unmatchedStudents.length} 名学生的专业代码未在Logic表中找到匹配`;
    }

    return result;
  } catch (err) {
    console.error('学生信息导入失败', err);
    return { error: '导入失败，详细错误：' + err.message };
  }
};