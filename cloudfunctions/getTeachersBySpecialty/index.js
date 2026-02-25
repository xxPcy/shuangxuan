// 云函数入口文件
// 根据学生三级专业代码从 QuotaHolders 中获取有名额的导师列表

const cloud = require('wx-server-sdk');

cloud.init({ env: 'cloud1-2gn42bha8f90b918' });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { 
    specializedCode,  // 三级专业代码
    page = 1, 
    pageSize = 20 
  } = event;

  console.log('收到参数:', { specializedCode, page, pageSize });

  if (!specializedCode) {
    return {
      success: false,
      message: '缺少三级专业代码',
      data: []
    };
  }

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
    const level3Holders = quotaHolders.level3_holders || {};
    
    console.log('level3_holders 中的所有专业代码:', Object.keys(level3Holders));
    console.log('查找专业代码:', specializedCode);
    
    // 查找该三级专业代码下的导师
    const teacherList = level3Holders[specializedCode] || [];
    console.log('找到的导师列表:', teacherList);
    
    if (teacherList.length === 0) {
      return {
        success: true,
        message: '该专业暂无有名额的导师',
        data: [],
        total: 0,
        hasMore: false
      };
    }

    // 提取导师ID列表
    const teacherIds = teacherList.map(t => t.teacherId);
    console.log('导师ID列表:', teacherIds);

    // 2. 分页
    const skip = (page - 1) * pageSize;
    const paginatedIds = teacherIds.slice(skip, skip + pageSize);
    
    if (paginatedIds.length === 0) {
      return {
        success: true,
        data: [],
        total: teacherIds.length,
        hasMore: false
      };
    }

    // 3. 查询导师详细信息
    console.log('查询导师ID:', paginatedIds);
    const teacherRes = await db.collection('Teacher')
      .where({
        Id: _.in(paginatedIds)
      })
      .get();
    
    console.log('从Teacher表查到的导师数量:', teacherRes.data.length);

    // 4. 合并导师信息和名额（按 code 前缀统计：已确认未使用 + 待审批）
    const teachersWithQuota = teacherRes.data.map((teacher) => {
      const quotaSettings = Array.isArray(teacher.quota_settings) ? teacher.quota_settings : [];
      const matchedEntries = quotaSettings.filter((item) => {
        if (!['level1', 'level2', 'level3'].includes(item.type)) return false;
        const code = String(item.code || '');
        return code && String(specializedCode).startsWith(code);
      });

      const confirmedRemainingQuota = matchedEntries.reduce((sum, item) => {
        const maxQuota = Number(item.max_quota || 0);
        const usedQuota = Number(item.used_quota || 0);
        return sum + Math.max(maxQuota - usedQuota, 0);
      }, 0);

      const pendingQuota = matchedEntries.reduce((sum, item) => {
        return sum + Number(item.pending_quota || 0);
      }, 0);

      return {
        ...teacher,
        matchedCode: specializedCode,
        matchedConfirmedQuota: confirmedRemainingQuota,
        matchedPendingQuota: pendingQuota,
        matchedQuota: confirmedRemainingQuota + pendingQuota
      };
    });

    // 按可用总名额从大到小排序
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
