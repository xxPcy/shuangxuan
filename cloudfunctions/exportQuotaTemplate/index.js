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
  const teacherName = teacher.name || '';

  // 遍历一级分类
  level1Map.forEach((level1Data, l1Code) => {
    const level1Label = `${level1Data.name}${level1Data.code}`; // 如：工学08
    const level1Value = teacher[`level1_${l1Code}`] || 0;

    let isFirstLevel1Row = true;

    // 遍历该一级下的二级分类
    level1Data.level2Map.forEach((level2Data, l2Code) => {
      const level2Label = `${level2Data.name}${level2Data.code}`; // 如：控制科学与工程0811
      const level2Value = teacher[`level2_${l2Code}`] || 0;

      let isFirstLevel2Row = true;

      // 遍历该二级下的三级分类
      if (level2Data.level3List.length > 0) {
        level2Data.level3List.forEach(level3Data => {
          const level3Label = `${level3Data.name}${level3Data.code}`; // 如：控制理论与控制工程081101
          const level3Value = teacher[`level3_${level3Data.code}`] || 0;

          rows.push({
            teacherName: isFirstLevel1Row ? teacherName : '',
            level1Label: isFirstLevel1Row ? level1Label : '',
            level1Value: isFirstLevel1Row ? level1Value : '',
            level2Label: isFirstLevel2Row ? level2Label : '',
            level2Value: isFirstLevel2Row ? level2Value : '',
            level3Label: level3Label,
            level3Value: level3Value,
            xuezhi: ''
          });

          isFirstLevel1Row = false;
          isFirstLevel2Row = false;
        });
      } else {
        // 如果没有三级，也要输出一行
        rows.push({
          teacherName: isFirstLevel1Row ? teacherName : '',
          level1Label: isFirstLevel1Row ? level1Label : '',
          level1Value: isFirstLevel1Row ? level1Value : '',
          level2Label: isFirstLevel2Row ? level2Label : '',
          level2Value: isFirstLevel2Row ? level2Value : '',
          level3Label: '',
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
        teacherName: isFirstLevel1Row ? teacherName : '',
        level1Label: isFirstLevel1Row ? level1Label : '',
        level1Value: isFirstLevel1Row ? level1Value : '',
        level2Label: '',
        level2Value: '',
        level3Label: '',
        level3Value: '',
        xuezhi: ''
      });
    }
  });

  return rows;
}

// 计算合并单元格信息
function calculateMerges(sheetData) {
  const merges = [];
  const dataStartRow = 1; // 数据从第2行开始（第1行是表头，索引为0）

  let currentRow = dataStartRow;
  let teacherStartRow = currentRow;
  let level1StartRow = currentRow;
  let level2StartRow = currentRow;

  let prevTeacher = null;
  let prevLevel1 = null;
  let prevLevel2 = null;

  for (let i = dataStartRow; i < sheetData.length; i++) {
    const row = sheetData[i];
    const teacherName = row[0];
    const level1Label = row[1];
    const level2Label = row[3];

    // 检测导师变化
    if (teacherName !== '' && teacherName !== prevTeacher) {
      // 合并之前的导师单元格
      if (prevTeacher !== null && i - 1 >= teacherStartRow && i - 1 > teacherStartRow) {
        merges.push({ s: { r: teacherStartRow, c: 0 }, e: { r: i - 1, c: 0 } });
      }
      teacherStartRow = i;
      prevTeacher = teacherName;
    }

    // 检测一级变化
    if (level1Label !== '' && level1Label !== prevLevel1) {
      // 合并之前的一级单元格
      if (prevLevel1 !== null && i - 1 >= level1StartRow && i - 1 > level1StartRow) {
        merges.push({ s: { r: level1StartRow, c: 1 }, e: { r: i - 1, c: 1 } }); // 一级名称
        merges.push({ s: { r: level1StartRow, c: 2 }, e: { r: i - 1, c: 2 } }); // 一级指标
      }
      level1StartRow = i;
      prevLevel1 = level1Label;
    }

    // 检测二级变化
    if (level2Label !== '' && level2Label !== prevLevel2) {
      // 合并之前的二级单元格
      if (prevLevel2 !== null && i - 1 >= level2StartRow && i - 1 > level2StartRow) {
        merges.push({ s: { r: level2StartRow, c: 3 }, e: { r: i - 1, c: 3 } }); // 二级名称
        merges.push({ s: { r: level2StartRow, c: 4 }, e: { r: i - 1, c: 4 } }); // 二级指标
      }
      level2StartRow = i;
      prevLevel2 = level2Label;
    }
  }

  // 处理最后一组的合并
  const lastRow = sheetData.length - 1;
  if (prevTeacher !== null && lastRow >= teacherStartRow && lastRow > teacherStartRow) {
    merges.push({ s: { r: teacherStartRow, c: 0 }, e: { r: lastRow, c: 0 } });
  }
  if (prevLevel1 !== null && lastRow >= level1StartRow && lastRow > level1StartRow) {
    merges.push({ s: { r: level1StartRow, c: 1 }, e: { r: lastRow, c: 1 } });
    merges.push({ s: { r: level1StartRow, c: 2 }, e: { r: lastRow, c: 2 } });
  }
  if (prevLevel2 !== null && lastRow >= level2StartRow && lastRow > level2StartRow) {
    merges.push({ s: { r: level2StartRow, c: 3 }, e: { r: lastRow, c: 3 } });
    merges.push({ s: { r: level2StartRow, c: 4 }, e: { r: lastRow, c: 4 } });
  }

  return merges;
}

exports.main = async (event, context) => {
  const db = cloud.database();

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
    // 表头：导师姓名、一级名称和代码、新增指标数、二级名称和代码、新增指标数、三级名称和代码、新增指标数、学制
    const normalSheetData = [
      ['导师姓名', '一级名称和指标', '新增指标数', '二级名称和代码', '新增指标数', '三级名称和代码', '新增指标数', '学制']
    ];

    // 遍历每个导师，构建层级数据
    teachers.forEach(teacher => {
      const teacherRows = buildTeacherRows(teacher, level1Map);
      teacherRows.forEach(row => {
        normalSheetData.push([
          row.teacherName,
          row.level1Label,
          row.level1Value,
          row.level2Label,
          row.level2Value,
          row.level3Label,
          row.level3Value,
          row.xuezhi
        ]);
      });
    });

    // 计算合并单元格信息
    const normalMerges = calculateMerges(normalSheetData);

    // 构建基地表数据（结构相同，暂时只有表头）
    const baseSheetData = [
      ['导师姓名', '一级名称和指标', '新增指标', '二级名称和代码', '新增指标', '三级名称和代码', '指标指标', '学制']
    ];

    // 生成 Excel 文件，包含两个子表
    const buffer = xlsx.build([
      { 
        name: '普通表', 
        data: normalSheetData,
        options: { '!merges': normalMerges }
      },
      { 
        name: '基地表', 
        data: baseSheetData 
      }
    ]);

    // 上传云存储
    const uploadRes = await cloud.uploadFile({
      cloudPath: `quota_templates/指标新增表模板_${Date.now()}.xlsx`,
      fileContent: buffer
    });

    return { 
      success: true, 
      fileID: uploadRes.fileID 
    };

  } catch (err) {
    console.error('导出指标模板失败:', err);
    return { 
      success: false, 
      error: err.message || '导出失败' 
    };
  }
};
