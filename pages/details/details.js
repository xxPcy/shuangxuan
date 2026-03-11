const db = wx.cloud.database();

Page({
  data: {
    status: '',
    teacher: {},
    Stu: {},
    StuID: '',
    teacherID: '',
    quotaButtons: []
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
        teacher
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

  buildQuotaButtons(logicRows, teacher, student, status) {
    const quotaSettings = Array.isArray(teacher.quota_settings) ? teacher.quota_settings : [];
    const studentCode = String(student.specializedCode || student.level3_code || '').trim();
    const studentTrack = student.track || 'regular'; // 学生的 track

    console.log('=== buildQuotaButtons 调试 ===');
    console.log('学生专业代码:', studentCode);
    console.log('学生 track:', studentTrack);
    console.log('学生状态:', status);
    console.log('导师 quota_settings 条目数:', quotaSettings.length);
    
    // 打印导师有名额的条目
    const nonZeroQuotas = quotaSettings.filter(q => (q.max_quota || 0) > 0 || (q.pending_quota || 0) > 0);
    console.log('导师有名额的条目:', nonZeroQuotas.map(q => 
      `${q.code}|${q.track || 'regular'} max=${q.max_quota} used=${q.used_quota} pending=${q.pending_quota}`
    ));

    const level3Map = new Map();
    logicRows.forEach((row) => {
      const code = String(row.level3_code || '').trim();
      const name = String(row.level3_name || '').trim();
      if (!code || !name || level3Map.has(code)) return;
      level3Map.set(code, { code, name });
    });

    const list = Array.from(level3Map.values()).sort((a, b) => a.code.localeCompare(b.code));

    return list.map((item) => {
      const studentUseQuota = student.useQuota !== false; // 默认占用指标

      // 不占用指标的学生：不限制 track，只要导师有该专业代码的任意配置即可
      // 占用指标的学生：只匹配与学生 track 相同的 quota_settings 条目
      const matchedEntries = quotaSettings.filter((quota) => {
        if (!['level1', 'level2', 'level3'].includes(quota.type)) return false;
        const quotaCode = String(quota.code || '').trim();
        if (!quotaCode || !item.code.startsWith(quotaCode)) return false;
        // 占用指标的学生需要 track 匹配；不占用指标的学生不限制 track
        if (studentUseQuota) {
          const quotaTrack = quota.track || 'regular';
          return quotaTrack === studentTrack;
        }
        return true;
      });

      const approvedRemaining = matchedEntries.reduce((sum, quota) => {
        const maxQuota = Number(quota.max_quota || 0);
        const usedQuota = Number(quota.used_quota || 0);
        return sum + Math.max(maxQuota - usedQuota, 0);
      }, 0);

      const isOwnMajor = studentCode && item.code === studentCode;
      // 不占用指标的学生：只要是自己的专业且导师有该专业配置就可以选
      // 占用指标的学生：还需要 approvedRemaining > 0
      const canSelect = status === 'chosing' && isOwnMajor && (studentUseQuota ? approvedRemaining > 0 : matchedEntries.length > 0);

      return {
        code: item.code,
        name: item.name,
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
          this.submitSelection(student, teacher, selectedCode, selectedName);
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

  submitSelection(student, teacher, selectedCode, selectedName) {
    const _ = db.command;
    const studentTrack = student.track || 'regular'; // 学生的 track

    db.collection('Stu').doc(student._id).update({
      data: {
        preselection: [teacher.name, teacher._id,selectedName,selectedCode],
        status: 'pending',
        selectedField: selectedCode
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
            track: studentTrack, // 传递学生的 track
            useQuota: student.useQuota !== false, // 是否占用指标（默认占用）
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
