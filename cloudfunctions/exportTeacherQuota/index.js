// 云函数入口文件，导出双选结果（导师维度，按 Logic 的 level3+track 动态生成专业列）
const cloud = require('wx-server-sdk');
const xlsx = require('node-xlsx');

cloud.init({ env: 'cloud1-2gn42bha8f90b918' });

const normalizeTrackValue = (value) => {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();
  if (!raw) return '全日制';
  if (['regular', '普通', '全日制'].includes(lower) || raw === '普通' || raw === '全日制') return '全日制';
  if (['joint', '联培'].includes(lower) || raw === '联培') return '联培';
  if (['parttime', '非全', '非全日制'].includes(lower) || raw === '非全' || raw === '非全日制') return '非全日制';
  if (['soldier', '士兵'].includes(lower) || raw === '士兵') return '士兵';
  return raw;
};

const getTrackOrder = (track) => {
  const t = normalizeTrackValue(track);
  const order = { '全日制': 1, '联培': 2, '非全日制': 3, '士兵': 4 };
  return order[t] || 99;
};

const getAllRows = async (collection) => {
  const rows = [];
  const pageSize = 100;
  let skip = 0;
  while (true) {
    const res = await collection.skip(skip).limit(pageSize).get();
    const chunk = (res && res.data) || [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    skip += pageSize;
  }
  return rows;
};

const buildCategoryListFromLogic = (logicRows = []) => {
  const map = new Map();

  (logicRows || []).forEach((row) => {
    const code = String(row.level3_code || '').trim();
    const name = String(row.level3_name || '').trim();
    const track = normalizeTrackValue(row.track || '全日制');
    if (!code || !name) return;
    const key = `${code}__${track}`;
    if (map.has(key)) return;
    map.set(key, {
      key,
      code,
      track,
      name,
      label: `${name}（${track}）`
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const codeCmp = String(a.code || '').localeCompare(String(b.code || ''));
    if (codeCmp !== 0) return codeCmp;
    return getTrackOrder(a.track) - getTrackOrder(b.track);
  });
};

const buildTeacherQuotaMap = (teacher = {}) => {
  const quotaMap = new Map();
  const settings = Array.isArray(teacher.quota_settings) ? teacher.quota_settings : [];

  settings
    .filter((item) => String(item.type || '') === 'level3')
    .forEach((item) => {
      const code = String(item.code || '').trim();
      const track = normalizeTrackValue(item.track || '全日制');
      if (!code) return;
      quotaMap.set(`${code}__${track}`, {
        max_quota: Number(item.max_quota || 0),
        used_quota: Number(item.used_quota || 0)
      });
    });

  return quotaMap;
};

const buildTeacherStudentMap = (teacher = {}) => {
  const studentMap = new Map();
  const students = Array.isArray(teacher.student) ? teacher.student : [];

  students.forEach((s) => {
    const code = String(s.categoryKey || '').trim();
    const track = normalizeTrackValue(s.track || '全日制');
    if (!code) return;
    const key = `${code}__${track}`;
    if (!studentMap.has(key)) studentMap.set(key, []);
    studentMap.get(key).push(s.studentName || s.name || '未知学生');
  });

  return studentMap;
};

exports.main = async () => {
  try {
    const db = cloud.database();

    const [teachers, logicRows] = await Promise.all([
      getAllRows(db.collection('Teacher')),
      getAllRows(db.collection('Logic'))
    ]);

    const categories = buildCategoryListFromLogic(logicRows);
    if (categories.length === 0) {
      throw new Error('Logic 表无有效 level3 专业数据，无法导出');
    }

    const data = [[
      '导师姓名',
      '导师ID',
      '专业类别',
      '专业代码',
      '类型',
      '总名额',
      '已招生人数',
      '剩余名额',
      '已招学生姓名'
    ]];
    const merges = [];

    teachers.forEach((teacher) => {
      const teacherName = teacher.name || '';
      const teacherId = teacher.Id || '';
      const startRow = data.length;

      const quotaMap = buildTeacherQuotaMap(teacher);
      const studentMap = buildTeacherStudentMap(teacher);

      categories.forEach((category) => {
        const key = category.key;
        const quota = quotaMap.get(key) || { max_quota: 0, used_quota: 0 };

        const studentNames = studentMap.get(key) || [];
        const usedByStudentList = studentNames.length;
        const usedQuota = Math.max(Number(quota.used_quota || 0), usedByStudentList);
        const totalQuota = Number(quota.max_quota || 0);
        const remaining = Math.max(totalQuota - usedQuota, 0);

        data.push([
          teacherName,
          teacherId,
          category.label,
          category.code,
          category.track,
          totalQuota,
          usedQuota,
          remaining,
          studentNames.join('，') || '无'
        ]);
      });

      const endRow = data.length - 1;
      if (endRow > startRow) {
        merges.push(
          { s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } },
          { s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } }
        );
      }
    });

    const buffer = xlsx.build([
      {
        name: '导师双选结果',
        data,
        options: { '!merges': merges }
      }
    ]);

    const uploadRes = await cloud.uploadFile({
      cloudPath: `enrollment_stats/teacher_selection_${Date.now()}.xlsx`,
      fileContent: buffer
    });

    return { success: true, fileID: uploadRes.fileID };
  } catch (err) {
    console.error('导出失败:', err);
    return { success: false, error: err.message || '导出失败' };
  }
};
