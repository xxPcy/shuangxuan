const cloud = require('wx-server-sdk');
const xlsx = require('node-xlsx');

cloud.init({ env: 'cloud1-2gn42bha8f90b918' });

// 获取Logic表中所有数据并构建层级结构
async function getHierarchicalDataFromLogic(db) {
  const allData = [];

  // 分批获取Logic表数据
  const countRes = await db.collection('Logic').count();
  const total = countRes.total;
  const batchSize = 100;
  const batchTimes = Math.ceil(total / batchSize);

  for (let i = 0; i < batchTimes; i++) {
    const res = await db.collection('Logic')
      .skip(i * batchSize)
      .limit(batchSize)
      .get();
    allData.push(...res.data);
  }

  // 构建层级结构：一级 -> 二级 -> 三级
  // 使用Map保持插入顺序
  const level1Map = new Map(); // level1_code -> { name, code, level2Map }

  allData.forEach(item => {
    const l1Code = item.level1_code ? item.level1_code.trim() : '';
    const l1Name = item.level1_name ? item.level1_name.trim() : '';
    const l2Code = item.level2_code ? item.level2_code.trim() : '';
    const l2Name = item.level2_name ? item.level2_name.trim() : '';
    const l3Code = item.level3_code ? item.level3_code.trim() : '';
    const l3Name = item.level3_name ? item.level3_name.trim() : '';

    if (!l1Code) return;

    // 初始化一级
    if (!level1Map.has(l1Code)) {
      level1Map.set(l1Code, {
        code: l1Code,
        name: l1Name,
        level2Map: new Map()
      });
    }

    const level1 = level1Map.get(l1Code);

    // 初始化二级
    if (l2Code && !level1.level2Map.has(l2Code)) {
      level1.level2Map.set(l2Code, {
        code: l2Code,
        name: l2Name,
        level3List: []
      });
    }

    // 添加三级
    if (l2Code && l3Code) {
      const level2 = level1.level2Map.get(l2Code);
      // 避免重复添加三级
      if (!level2.level3List.find(l3 => l3.code === l3Code)) {
        level2.level3List.push({
          code: l3Code,
          name: l3Name
        });
      }
    }
  });

  return level1Map;
}

// 分批获取所有导师数据
async function getAllTeachers(db) {
  const teachers = [];
  const countRes = await db.collection('Teacher').count();
  const total = countRes.total;
  const batchSize = 100;
  const batchTimes = Math.ceil(total / batchSize);

  for (let i = 0; i < batchTimes; i++) {
    const res = await db.collection('Teacher')
      .skip(i * batchSize)
      .limit(batchSize)
      .get();
    teachers.push(...res.data);
  }

  return teachers;
}

// 构建单个导师的层级数据行（带合并信息）
function buildTeacherRows(teacher, level1Map) {
  const rows = [];
  const teacherId = teacher.Id || ''; // 导师ID
  const teacherName = teacher.name || '';

  // 遍历一级分类
  level1Map.forEach((level1Data, l1Code) => {
    const level1Name = level1Data.name; // 如：工学
    const level1Code = level1Data.code; // 如：08
    const level1Value = teacher[`level1_${l1Code}`] || 0;

    let isFirstLevel1Row = true;

    // 遍历该一级下的二级分类
    level1Data.level2Map.forEach((level2Data, l2Code) => {
      const level2Name = level2Data.name; // 如：控制科学与工程
      const level2Code = level2Data.code; // 如：0811
      const level2Value = teacher[`level2_${l2Code}`] || 0;

      let isFirstLevel2Row = true;

      // 遍历该二级下的三级分类
      if (level2Data.level3List.length > 0) {
        level2Data.level3List.forEach(level3Data => {
          const level3Name = level3Data.name; // 如：控制理论与控制工程
          const level3Code = level3Data.code; // 如：081101
          const level3Value = teacher[`level3_${level3Data.code}`] || 0;

          rows.push({
            teacherId: isFirstLevel1Row ? teacherId : '',
            teacherName: isFirstLevel1Row ? teacherName : '',
            level1Name: isFirstLevel1Row ? level1Name : '',
            level1Code: isFirstLevel1Row ? level1Code : '',
            level1Value: isFirstLevel1Row ? level1Value : '',
            level2Name: isFirstLevel2Row ? level2Name : '',
            level2Code: isFirstLevel2Row ? level2Code : '',
            level2Value: isFirstLevel2Row ? level2Value : '',
            level3Name: level3Name,
            level3Code: level3Code,
            level3Value: level3Value,
            xuezhi: ''
          });

          isFirstLevel1Row = false;
          isFirstLevel2Row = false;
        });
      } else {
        // 如果没有三级，也要输出一行
        rows.push({
          teacherId: isFirstLevel1Row ? teacherId : '',
          teacherName: isFirstLevel1Row ? teacherName : '',
          level1Name: isFirstLevel1Row ? level1Name : '',
          level1Code: isFirstLevel1Row ? level1Code : '',
          level1Value: isFirstLevel1Row ? level1Value : '',
          level2Name: isFirstLevel2Row ? level2Name : '',
          level2Code: isFirstLevel2Row ? level2Code : '',
          level2Value: isFirstLevel2Row ? level2Value : '',
          level3Name: '',
          level3Code: '',
          level3Value: '',
          xuezhi: ''
        });

        isFirstLevel1Row = false;
        isFirstLevel2Row = false;
      }
    });

    // 如果一级下没有二级
    if (level1Data.level2Map.size === 0) {
      rows.push({
        teacherId: isFirstLevel1Row ? teacherId : '',
        teacherName: isFirstLevel1Row ? teacherName : '',
        level1Name: isFirstLevel1Row ? level1Name : '',
        level1Code: isFirstLevel1Row ? level1Code : '',
        level1Value: isFirstLevel1Row ? level1Value : '',
        level2Name: '',
        level2Code: '',
        level2Value: '',
        level3Name: '',
        level3Code: '',
        level3Value: '',
        xuezhi: ''
      });
    }
  });

  return rows;
}

// 计算合并单元格信息
// 新列结构：导师ID(0)、导师姓名(1)、一级名称(2)、一级代码(3)、一级指标数(4)、二级名称(5)、二级代码(6)、二级指标数(7)、三级名称(8)、三级代码(9)、三级指标数(10)、学制(11)
function calculateMerges(sheetData) {
  const merges = [];
  const dataStartRow = 1; // 数据从第2行开始（第1行是表头，索引为0）

  let currentRow = dataStartRow;
  let teacherStartRow = currentRow;
  let level1StartRow = currentRow;
  let level2StartRow = currentRow;

  let prevTeacherId = null;
  let prevLevel1 = null;
  let prevLevel2 = null;

  for (let i = dataStartRow; i < sheetData.length; i++) {
    const row = sheetData[i];
    const teacherId = row[0];
    const level1Name = row[2];
    const level2Name = row[5];

    // 检测导师变化（通过ID判断）
    if (teacherId !== '' && teacherId !== prevTeacherId) {
      // 合并之前的导师单元格
      if (prevTeacherId !== null && i - 1 >= teacherStartRow && i - 1 > teacherStartRow) {
        merges.push({ s: { r: teacherStartRow, c: 0 }, e: { r: i - 1, c: 0 } }); // 导师ID
        merges.push({ s: { r: teacherStartRow, c: 1 }, e: { r: i - 1, c: 1 } }); // 导师姓名
      }
      teacherStartRow = i;
      prevTeacherId = teacherId;
    }

    // 检测一级变化
    if (level1Name !== '' && level1Name !== prevLevel1) {
      // 合并之前的一级单元格
      if (prevLevel1 !== null && i - 1 >= level1StartRow && i - 1 > level1StartRow) {
        merges.push({ s: { r: level1StartRow, c: 2 }, e: { r: i - 1, c: 2 } }); // 一级名称
        merges.push({ s: { r: level1StartRow, c: 3 }, e: { r: i - 1, c: 3 } }); // 一级代码
        merges.push({ s: { r: level1StartRow, c: 4 }, e: { r: i - 1, c: 4 } }); // 一级指标数
      }
      level1StartRow = i;
      prevLevel1 = level1Name;
    }

    // 检测二级变化
    if (level2Name !== '' && level2Name !== prevLevel2) {
      // 合并之前的二级单元格
      if (prevLevel2 !== null && i - 1 >= level2StartRow && i - 1 > level2StartRow) {
        merges.push({ s: { r: level2StartRow, c: 5 }, e: { r: i - 1, c: 5 } }); // 二级名称
        merges.push({ s: { r: level2StartRow, c: 6 }, e: { r: i - 1, c: 6 } }); // 二级代码
        merges.push({ s: { r: level2StartRow, c: 7 }, e: { r: i - 1, c: 7 } }); // 二级指标数
      }
      level2StartRow = i;
      prevLevel2 = level2Name;
    }
  }

  // 处理最后一组的合并
  const lastRow = sheetData.length - 1;
  if (prevTeacherId !== null && lastRow >= teacherStartRow && lastRow > teacherStartRow) {
    merges.push({ s: { r: teacherStartRow, c: 0 }, e: { r: lastRow, c: 0 } }); // 导师ID
    merges.push({ s: { r: teacherStartRow, c: 1 }, e: { r: lastRow, c: 1 } }); // 导师姓名
  }
  if (prevLevel1 !== null && lastRow >= level1StartRow && lastRow > level1StartRow) {
    merges.push({ s: { r: level1StartRow, c: 2 }, e: { r: lastRow, c: 2 } });
    merges.push({ s: { r: level1StartRow, c: 3 }, e: { r: lastRow, c: 3 } });
    merges.push({ s: { r: level1StartRow, c: 4 }, e: { r: lastRow, c: 4 } });
  }
  if (prevLevel2 !== null && lastRow >= level2StartRow && lastRow > level2StartRow) {
    merges.push({ s: { r: level2StartRow, c: 5 }, e: { r: lastRow, c: 5 } });
    merges.push({ s: { r: level2StartRow, c: 6 }, e: { r: lastRow, c: 6 } });
    merges.push({ s: { r: level2StartRow, c: 7 }, e: { r: lastRow, c: 7 } });
  }

  return merges;
}

exports.main = async (event, context) => {
  const db = cloud.database();
  
  // 获取自定义文件名，默认为 "指标新增表模板"
  const customFileName = event.fileName || '指标新增表模板';
  
  try {
    // 获取Logic表中的层级结构数据
    const level1Map = await getHierarchicalDataFromLogic(db);
    
    // 获取所有导师数据
    const teachers = await getAllTeachers(db);

    if (teachers.length === 0) {
      return { success: false, error: '没有导师数据' };
    }

    if (level1Map.size === 0) {
      return { success: false, error: '没有指标分类数据' };
    }

    // 构建普通表数据
    // 表头：导师ID、导师姓名、一级名称、一级代码、新增指标数、二级名称、二级代码、新增指标数、三级名称、三级代码、新增指标数、学制
    const normalSheetData = [
      ['导师ID', '导师姓名', '一级名称', '一级代码', '新增指标数', '二级名称', '二级代码', '新增指标数', '三级名称', '三级代码', '新增指标数', '学制']
    ];

    // 遍历每个导师，构建层级数据
    teachers.forEach(teacher => {
      const teacherRows = buildTeacherRows(teacher, level1Map);
      teacherRows.forEach(row => {
        normalSheetData.push([
          String(row.teacherId),
          String(row.teacherName),
          String(row.level1Name),
          String(row.level1Code),
          String(row.level1Value),
          String(row.level2Name),
          String(row.level2Code),
          String(row.level2Value),
          String(row.level3Name),
          String(row.level3Code),
          String(row.level3Value),
          String(row.xuezhi)
        ]);
      });
    });

    // 计算合并单元格信息
    const normalMerges = calculateMerges(normalSheetData);

    // 构建基地表数据（内容与普通表相同）
    const baseSheetData = [
      ['导师ID', '导师姓名', '一级名称', '一级代码', '新增指标数', '二级名称', '二级代码', '新增指标数', '三级名称', '三级代码', '新增指标数', '学制']
    ];

    // 遍历每个导师，构建基地表层级数据
    teachers.forEach(teacher => {
      const teacherRows = buildTeacherRows(teacher, level1Map);
      teacherRows.forEach(row => {
        baseSheetData.push([
          String(row.teacherId),
          String(row.teacherName),
          String(row.level1Name),
          String(row.level1Code),
          String(row.level1Value),
          String(row.level2Name),
          String(row.level2Code),
          String(row.level2Value),
          String(row.level3Name),
          String(row.level3Code),
          String(row.level3Value),
          String(row.xuezhi)
        ]);
      });
    });

    // 计算基地表合并单元格信息
    const baseMerges = calculateMerges(baseSheetData);

    // 生成 Excel 文件，包含两个子表
    const buffer = xlsx.build([
      { 
        name: '普通表', 
        data: normalSheetData,
        options: { '!merges': normalMerges }
      },
      { 
        name: '基地表', 
        data: baseSheetData,
        options: { '!merges': baseMerges }
      }
    ]);

    // 上传云存储
    // 清理文件名中的非法字符
    const safeFileName = customFileName.replace(/[\\/:*?"<>|]/g, '_');
    const uploadRes = await cloud.uploadFile({
      cloudPath: `quota_templates/${safeFileName}_${Date.now()}.xlsx`,
      fileContent: buffer
    });

    return { 
      success: true, 
      fileID: uploadRes.fileID,
      fileName: `${safeFileName}.xlsx`
    };

  } catch (err) {
    console.error('导出指标模板失败:', err);
    return { 
      success: false, 
      error: err.message || '导出失败' 
    };
  }
};
