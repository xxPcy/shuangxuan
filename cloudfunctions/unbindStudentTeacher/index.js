const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-2gn42bha8f90b918' });

const normalizeTrackValue = (track) => {
  const raw = String(track || '全日制').trim();
  const lower = raw.toLowerCase();
  if (!raw) return '全日制';
  if (raw === '联培' || lower === 'joint') return '联培';
  if (raw === '非全日制' || raw === '非全' || lower === 'parttime') return '非全日制';
  if (raw === '士兵' || lower === 'soldier') return '士兵';
  if (raw === '全日制' || raw === '普通' || lower === 'regular') return '全日制';
  return raw;
};

exports.main = async (event) => {
  const { studentId, teacherId } = event || {};

  if (!studentId || !teacherId) {
    return { success: false, error: '学生ID或导师ID缺失' };
  }

  const db = cloud.database();

  try {
    const transaction = await db.startTransaction();

    const studentRes = await transaction.collection('Stu').where({ Id: studentId }).get();
    if (!studentRes.data || studentRes.data.length === 0) {
      throw new Error('学生信息不存在');
    }
    const student = studentRes.data[0];

    const teacherRes = await transaction.collection('Teacher').where({ Id: teacherId }).get();
    if (!teacherRes.data || teacherRes.data.length === 0) {
      throw new Error('导师信息不存在');
    }
    const teacher = teacherRes.data[0];

    const students = Array.isArray(teacher.student) ? teacher.student : [];
    const matchedStudent = students.find((s) => String(s.Id || '') === String(studentId));
    if (!matchedStudent) {
      throw new Error('导师的学生列表中找不到该学生');
    }

    const updatedStudents = students.filter((s) => String(s.Id || '') !== String(studentId));
    const useQuota = !!student.useQuota;
    const categoryKey = String(matchedStudent.categoryKey || '').trim();
    const studentTrack = normalizeTrackValue(matchedStudent.track || student.selectedTrack || student.track || '全日制');

    let updatedQuotaSettings = Array.isArray(teacher.quota_settings) ? [...teacher.quota_settings] : [];

    if (useQuota && categoryKey && updatedQuotaSettings.length > 0) {
      const matchIndexes = updatedQuotaSettings
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => ['level1', 'level2', 'level3'].includes(item.type))
        .filter(({ item }) => normalizeTrackValue(item.track) === studentTrack)
        .filter(({ item }) => categoryKey.startsWith(String(item.code || '')))
        .sort((a, b) => String(b.item.code || '').length - String(a.item.code || '').length)
        .map(({ index }) => index);

      const targetIndex = matchIndexes.find((idx) => Number(updatedQuotaSettings[idx].used_quota || 0) > 0);
      if (targetIndex !== undefined) {
        updatedQuotaSettings[targetIndex] = {
          ...updatedQuotaSettings[targetIndex],
          used_quota: Math.max(Number(updatedQuotaSettings[targetIndex].used_quota || 0) - 1, 0)
        };
      }
    }

    await transaction.collection('Stu').doc(student._id).update({
      data: {
        status: 'chosing',
        selected: '',
        selectedTecId: ''
      }
    });

    await transaction.collection('Teacher').doc(teacher._id).update({
      data: {
        student: updatedStudents,
        quota_settings: updatedQuotaSettings
      }
    });

    await transaction.commit();
    return { success: true };
  } catch (err) {
    console.error('解绑学生和导师关系失败', err);
    return { success: false, error: err.message };
  }
};
