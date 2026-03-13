const db = wx.cloud.database();

Page({
  data: {
    status: '',
    teacher: {},
    Stu: {},
    StuID: '',
    teacherID: '',
    quotaButtons: [],
    useQuota: true,
    studentTrack: '全日制'
  },

  onLoad(options) {
    const teacherID = options._id;
    this.setData({ teacherID });

    const user = wx.getStorageSync('user') || {};
    const stuId = user._id;
    if (!stuId || !teacherID) {
      wx.showToast({ title: '参数异常', icon: 'none' });
      return;
    }

    Promise.all([
      db.collection('Stu').doc(stuId).get(),
      db.collection('Teacher').doc(teacherID).get(),
      db.collection('Logic').get()
    ]).then(([stuRes, teacherRes, logicRes]) => {
      const student = stuRes.data || {};
      const teacher = teacherRes.data || {};
      const status = student.status || '';
      const logicRows = Array.isArray(logicRes.data) ? logicRes.data : [];

      this.setData({
        status,
        Stu: student,
        StuID: student.Id || '',
        teacher,
        useQuota: !!student.useQuota,
        studentTrack: student.track || '全日制'
      });

      const quotaButtons = this.buildQuotaButtons(logicRows, teacher, student, status);
      this.setData({ quotaButtons });

      if (status === 'pending' || status === 'chosed') {
        wx.showToast({ title: '您已选择过导师', icon: 'none' });
      }
    }).catch((error) => {
      console.error('加载详情失败', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  normalizeTrackValue(value) {
    const raw = String(value || '').trim();
    const lower = raw.toLowerCase();
    if (!raw) return '全日制';
    if (['regular', '普通', '全日制'].includes(lower) || raw === '普通' || raw === '全日制') return '全日制';
    if (['joint', '联培'].includes(lower) || raw === '联培') return '联培';
    if (['parttime', '非全', '非全日制'].includes(lower) || raw === '非全' || raw === '非全日制') return '非全日制';
    if (['soldier', '士兵'].includes(lower) || raw === '士兵') return '士兵';
    return raw;
  },

  getTrackText(track) {
    return this.normalizeTrackValue(track);
  },

  getTrackOrder(track) {
    const t = this.normalizeTrackValue(track);
    const order = { '全日制': 1, '联培': 2, '非全日制': 3, '士兵': 4 };
    return order[t] || 99;
  },

  getAllowedTracksByStudentTrack(track) {
    const t = this.normalizeTrackValue(track);
    if (t === '非全日制') return ['非全日制'];
    if (t === '全日制') return ['全日制', '联培'];
    return [t];
  },

  buildQuotaButtons(logicRows, teacher, student, status) {
    const quotaSettings = Array.isArray(teacher.quota_settings) ? teacher.quota_settings : [];
    const studentCode = String(student.specializedCode || student.level3_code || '').trim();
    const studentTrack = this.normalizeTrackValue(student.track || '全日制');
    const allowedTracks = this.getAllowedTracksByStudentTrack(studentTrack);
    const useQuota = !!student.useQuota;

    const level3Map = new Map();
    logicRows.forEach((row) => {
      const code = String(row.level3_code || '').trim();
      const name = String(row.level3_name || '').trim();
      const track = this.normalizeTrackValue(row.track || '全日制');
      if (!code || !name) return;
      const key = `${code}__${track}`;
      if (level3Map.has(key)) return;
      level3Map.set(key, {
        code,
        track,
        baseName: name,
        displayName: `${name}（${this.getTrackText(track)}）`
      });
    });

    const list = Array.from(level3Map.values()).sort((a, b) => {
      const codeCmp = String(a.code || '').localeCompare(String(b.code || ''));
      if (codeCmp !== 0) return codeCmp;
      return this.getTrackOrder(a.track) - this.getTrackOrder(b.track);
    });

    return list.map((item) => {
      const matchedEntries = quotaSettings.filter((quota) => {
        if (!['level1', 'level2', 'level3'].includes(quota.type)) return false;
        const quotaCode = String(quota.code || '').trim();
        if (!quotaCode || !item.code.startsWith(quotaCode)) return false;
        const quotaTrack = this.normalizeTrackValue(quota.track || '全日制');
        return quotaTrack === item.track;
      });

      const approvedRemaining = matchedEntries.reduce((sum, quota) => {
        const maxQuota = Number(quota.max_quota || 0);
        const usedQuota = Number(quota.used_quota || 0);
        return sum + Math.max(maxQuota - usedQuota, 0);
      }, 0);

      const recruited = matchedEntries.length > 0;
      const isOwnMajor = studentCode && item.code === studentCode && allowedTracks.includes(item.track);
      const canSelect = status === 'chosing' && isOwnMajor && (useQuota ? approvedRemaining > 0 : recruited);

      return {
        key: `${item.code}__${item.track}`,
        code: item.code,
        track: item.track,
        name: item.displayName,
        baseName: item.baseName,
        approvedRemaining,
        isOwnMajor,
        disabled: !canSelect,
        color: canSelect ? '#90ee90' : '#d3d3d3'
      };
    });
  },

  selectTeacherByCategory(e) {
    const selectedCode = String(e.currentTarget.dataset.code || '').trim();
    const selectedName = String(e.currentTarget.dataset.name || '').trim();
    const selectedTrack = this.normalizeTrackValue(e.currentTarget.dataset.track || '全日制');
    const disabled = !!e.currentTarget.dataset.disabled;

    if (!selectedCode || !selectedName) {
      wx.showToast({ title: '参数异常', icon: 'none' });
      return;
    }

    if (disabled) {
      wx.showToast({ title: '该专业暂无已审批可用名额', icon: 'none' });
      return;
    }

    const teacher = this.data.teacher;
    const student = this.data.Stu;

    wx.showModal({
      title: '确认选择',
      content: `确定申请导师 ${teacher.name} 的 ${selectedName}（${selectedCode}）名额吗？`,
      success: (res) => {
        if (res.confirm) {
          this.submitSelection(student, teacher, selectedCode, selectedName, selectedTrack);
        }
      }
    });
  },

  onPullDownRefresh() {
    wx.stopPullDownRefresh();
  },

  copyText(e) {
    wx.setClipboardData({
      data: e.currentTarget.dataset.text,
      success() {
        wx.showToast({ title: '复制成功', icon: 'success' });
      }
    });
  },

  submitSelection(student, teacher, selectedCode, selectedName, selectedTrack) {
    const _ = db.command;

    db.collection('Stu').doc(student._id).update({
      data: {
        preselection: [teacher.name, teacher._id],
        status: 'pending',
        selectedField: selectedCode,
        selectedTrack: selectedTrack
      }
    }).then(() => {
      wx.showToast({ title: '申请成功，等待导师审核', icon: 'success' });

      return db.collection('Teacher').doc(teacher._id).update({
        data: {
          prestudent: _.push({
            studentId: student._id,
            studentName: student.name,
            specialized: selectedName,
            specializedCode: selectedCode,
            track: selectedTrack,
            status: 'pending',
            phoneNumber: student.phoneNumber,
            description: student.description,
            Id: student.Id
          })
        }
      });
    }).then(() => {
      this.setData({ status: 'pending' });
      const buttons = this.data.quotaButtons.map((item) => ({
        ...item,
        disabled: true,
        color: '#d3d3d3'
      }));
      this.setData({ quotaButtons: buttons });
    }).catch((err) => {
      console.error('提交选择失败', err);
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    });
  }
});
