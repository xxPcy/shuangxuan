// 云函数入口文件
// 根据学生专业代码从 QuotaHolders 中获取有名额的导师列表

const cloud = require('wx-server-sdk');

cloud.init({ env: 'cloud1-2gn42bha8f90b918' });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { 
    specializedCode,  // 三级专业代码
    level2Code,       // 二级专业代码
    level1Code,       // 一级专业代码
    page = 1, 
    pageSize = 20 
  } = event;

  console.log('收到参数:', { specializedCode, level2Code, level1Code, page, pageSize });

  try {
    // 1. 从 QuotaHolders 获取有名额的导师列表
    const quotaHoldersRes = await db.collection('QuotaHolders').doc('quotaholder').get();
    
    if (!quotaHoldersRes.data) {
      console.log('QuotaHolders 数据不存在');
      return {
        success: false,
        message: 'QuotaHolders 数据不存在',
        data: []
      };
    }

    const quotaHolders = quotaHoldersRes.data;
    console.log('QuotaHolders level3_holders keys:', Object.keys(quotaHolders.level3_holders || {}));
    
    const teacherIdsSet = new Set(); // 用于去重
    const teacherQuotaMap = {}; // 导师ID -> 名额信息

    // 按优先级查找：三级 > 二级 > 一级
    // 三级专业代码匹配
    if (specializedCode && quotaHolders.level3_holders && quotaHolders.level3_holders[specializedCode]) {
      console.log('找到三级专业匹配:', specializedCode, quotaHolders.level3_holders[specializedCode]);
      quotaHolders.level3_holders[specializedCode].forEach(teacher => {
        teacherIdsSet.add(teacher.teacherId);
        if (!teacherQuotaMap[teacher.teacherId]) {
          teacherQuotaMap[teacher.teacherId] = {
            totalQuota: 0,
            codes: []
          };
        }
        teacherQuotaMap[teacher.teacherId].totalQuota += teacher.quota;
        teacherQuotaMap[teacher.teacherId].codes.push({
          code: specializedCode,
          level: 3,
          quota: teacher.quota
        });
      });
    }

    // 二级专业代码匹配
    if (level2Code && quotaHolders.level2_holders && quotaHolders.level2_holders[level2Code]) {
      quotaHolders.level2_holders[level2Code].forEach(teacher => {
        teacherIdsSet.add(teacher.teacherId);
        if (!teacherQuotaMap[teacher.teacherId]) {
          teacherQuotaMap[teacher.teacherId] = {
            totalQuota: 0,
            codes: []
          };
        }
        teacherQuotaMap[teacher.teacherId].totalQuota += teacher.quota;
        teacherQuotaMap[teacher.teacherId].codes.push({
          code: level2Code,
          level: 2,
          quota: teacher.quota
        });
      });
    }

    // 一级专业代码匹配
    if (level1Code && quotaHolders.level1_holders && quotaHolders.level1_holders[level1Code]) {
      quotaHolders.level1_holders[level1Code].forEach(teacher => {
        teacherIdsSet.add(teacher.teacherId);
        if (!teacherQuotaMap[teacher.teacherId]) {
          teacherQuotaMap[teacher.teacherId] = {
            totalQuota: 0,
            codes: []
          };
        }
        teacherQuotaMap[teacher.teacherId].totalQuota += teacher.quota;
        teacherQuotaMap[teacher.teacherId].codes.push({
          code: level1Code,
          level: 1,
          quota: teacher.quota
        });
      });
    }

    const teacherIds = Array.from(teacherIdsSet);
    console.log('匹配到的导师ID列表:', teacherIds);
    
    if (teacherIds.length === 0) {
      console.log('没有匹配到任何导师');
      return {
        success: true,
        message: '没有找到匹配该专业的导师',
        data: [],
        total: 0,
        hasMore: false
      };
    }

    // 2. 分页获取导师详细信息
    const skip = (page - 1) * pageSize;
    const paginatedIds = teacherIds.slice(skip, skip + pageSize);
    console.log('分页后的导师ID:', paginatedIds);
    
    if (paginatedIds.length === 0) {
      return {
        success: true,
        data: [],
        total: teacherIds.length,
        hasMore: false
      };
    }

    // 查询导师详细信息
    const teacherRes = await db.collection('Teacher')
      .where({
        Id: _.in(paginatedIds)
      })
      .get();
    
    console.log('从Teacher表查到的导师数量:', teacherRes.data.length);

    // 3. 合并导师信息和名额信息
    const teachersWithQuota = teacherRes.data.map(teacher => {
      const quotaInfo = teacherQuotaMap[teacher.Id] || { totalQuota: 0, codes: [] };
      return {
        ...teacher,
        matchedQuota: quotaInfo.totalQuota,
        matchedCodes: quotaInfo.codes
      };
    });

    // 按名额从大到小排序
    teachersWithQuota.sort((a, b) => b.matchedQuota - a.matchedQuota);

    return {
      success: true,
      data: teachersWithQuota,
      total: teacherIds.length,
      hasMore: (skip + pageSize) < teacherIds.length,
      page: page,
      pageSize: pageSize
    };

  } catch (err) {
    console.error('获取导师列表失败:', err);
    return {
      success: false,
      message: '获取导师列表失败',
      error: err.message || err
    };
  }
};
