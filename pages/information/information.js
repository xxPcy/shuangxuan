// pages/information/information.js
// const { console } = require("inspector");
const tabService = require("../utils/tab-service");
Page({
  data: {
    teachers: [], // 所有导师数据
    filteredTeachers: [], // 筛选后的导师数据
    page: 1, // 当前分页页码
    pageSize: 20, // 每页加载数量
    hasMore: true, // 是否还有更多数据
    searchQuery: '', // 搜索关键词
    Bigtype: '', // 学生专业类别
    announcements: [], // 公告列表
    category:'',//学生报考类别
    stu_id:'',//学生的_id
    specializedCode: '', // 学生三级专业代码
    useQuota: false, // 是否占用指标（false:占用，true:不占用）
  },

  // 加载公告
loadAnnouncements() {
  const db = wx.cloud.database();

  db.collection('Announcements')
    .where({
      category: db.command.in(['学生公告', '全体公告']), // 查询学生公告和全体公告
    })
    .orderBy('date', 'desc') // 按日期倒序排列
    .get()
    .then((res) => {
      const announcements = res.data.map((item) => ({
        id: item._id,
        content: item.content.length > 20 ? item.content.substring(0, 20) + '...' : item.content, // 限制内容显示长度
        category: item.category,
        fullContent: item.content, // 保存完整的公告内容
        date: new Date(item.date).toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }), // 格式化日期为 YYYY-MM-DD
      }));

      this.setData({
        announcements,
      });
    })
    .catch((err) => {
      console.error('加载公告失败', err);
    });
},



// 查看完整公告
viewAnnouncement(event) {
  const announcementId = event.currentTarget.dataset.id;
  const announcement = this.data.announcements.find((item) => item.id === announcementId);

  if (announcement) {
    wx.showModal({
      title: `公告详情`,
      content: announcement.fullContent,
      showCancel: false, // 不显示取消按钮
    });
  }
},


  onLoad() {
    //加载公告
    this.loadAnnouncements(); // 页面加载时加载公告
    // 获取学生信息并初始化页面
    const data = wx.getStorageSync('user');
    console.log("缓存数据",data);
    const stu_id=data._id;
    
    // 获取三级专业代码
    const specializedCode = data.specializedCode || data.level3_code || '';
    console.log("学生三级专业代码:", specializedCode);
    
    this.setData({
      stu_id:stu_id,
      category:data.specialized,
      specializedCode: specializedCode,
      useQuota: !!data.useQuota,
    }, () => {
      this.loadTeachers(); // 加载导师数据
    });
  },

  // 加载导师数据（根据学生三级专业代码从QuotaHolders查找有名额的导师）
  loadTeachers() {
    wx.showLoading({
      title: '数据载入中...',
    });
    
    const that = this;
    const { specializedCode, page, pageSize, useQuota } = this.data;
    
    console.log("loadTeachers - 三级专业代码:", specializedCode);
    
    // 如果有三级专业代码，使用新的基于QuotaHolders的查询方式
    if (specializedCode) {
      console.log("使用 getTeachersBySpecialty 查询导师");
      wx.cloud.callFunction({
        name: 'getTeachersBySpecialty',
        data: {
          specializedCode: specializedCode,
          page: page,
          pageSize: pageSize,
          useQuota: useQuota
        },
        success: res => {
          wx.hideLoading();
          console.log("getTeachersBySpecialty 返回结果:", res.result);
          if (res.result?.success) {
            const newTeachers = res.result.data;
            const hasMore = res.result.hasMore;
            console.log("根据专业代码获取的导师列表:", newTeachers);
            
            if (page === 1 && (!Array.isArray(newTeachers) || newTeachers.length === 0)) {
              // 防止云函数未更新/旧逻辑导致空结果，回退本地 quota_settings 计算
              that.loadTeachersByQuotaSettingsDirect();
              return;
            }

            if (page === 1) {
              // 首次加载
              that.setData({
                teachers: newTeachers,
                filteredTeachers: newTeachers,
                hasMore: hasMore
              });
            } else {
              // 加载更多
              that.setData({
                teachers: that.data.teachers.concat(newTeachers),
                filteredTeachers: that.data.filteredTeachers.concat(newTeachers),
                hasMore: hasMore
              });
            }
            
            if (!hasMore && newTeachers.length === 0 && page > 1) {
              wx.showToast({
                title: '已加载全部数据',
                icon: 'none'
              });
            }
          } else {
            console.error('获取导师数据失败:', res.result?.message);
            // 云函数返回异常时，回退到本地 quota_settings 计算，避免漏导师
            that.loadTeachersByQuotaSettingsDirect();
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('云函数调用失败:', err);
          // 云函数调用失败时，回退到本地 quota_settings 计算，避免漏导师
          that.loadTeachersByQuotaSettingsDirect();
        }
      });
    } else {
      wx.hideLoading();
      wx.showToast({
        title: '缺少专业代码，请联系管理员',
        icon: 'none'
      });
      this.setData({
        teachers: [],
        filteredTeachers: [],
        hasMore: false
      });
    }
  },


  normalizeCode(code) {
    const text = String(code || '').trim();
    if (!text) return '';
    const digits = text.replace(/\.0+$/, '');
    if (!/^\d+$/.test(digits)) return text;
    const normalized = digits.replace(/^0+/, '');
    return normalized || '0';
  },

  codeMatches(sourceCode, targetCode) {
    const sourceRaw = String(sourceCode || '').trim();
    const targetRaw = String(targetCode || '').trim();
    if (!sourceRaw || !targetRaw) return false;
    if (sourceRaw.startsWith(targetRaw)) return true;

    const sourceNormalized = this.normalizeCode(sourceRaw);
    const targetNormalized = this.normalizeCode(targetRaw);
    if (!sourceNormalized || !targetNormalized) return false;
    return sourceNormalized.startsWith(targetNormalized);
  },

  // 本地兜底：直接读取 Teacher.quota_settings 计算可见导师，避免云函数未同步导致漏显示
  loadTeachersByQuotaSettingsDirect() {
    const db = wx.cloud.database();
    const { specializedCode, page, pageSize, useQuota } = this.data;

    if (!specializedCode) {
      wx.hideLoading();
      this.setData({
        teachers: [],
        filteredTeachers: [],
        hasMore: false
      });
      return;
    }

    const buildHistoryTeacherSet = () => {
      if (!useQuota) return Promise.resolve(new Set());
      return db.collection('QuotaHolders').doc('quotaholder').get()
        .then((res) => {
          const doc = res.data || {};
          const holders = [doc.level1_holders || {}, doc.level2_holders || {}, doc.level3_holders || {}];
          const set = new Set();
          holders.forEach((holderMap) => {
            Object.keys(holderMap).forEach((code) => {
              if (!this.codeMatches(specializedCode, code)) return;
              (holderMap[code] || []).forEach((item) => {
                const teacherId = String(item.teacherId || '').trim();
                if (teacherId) set.add(teacherId);
              });
            });
          });
          return set;
        })
        .catch(() => new Set());
    };

    Promise.all([
      db.collection('Teacher').count(),
      buildHistoryTeacherSet()
    ]).then(([countRes, historyTeacherIdSet]) => {
      const totalTeachers = countRes.total || 0;
      const batchSize = 100;
      const tasks = [];
      for (let i = 0; i < totalTeachers; i += batchSize) {
        tasks.push(
          db.collection('Teacher').skip(i).limit(batchSize).get()
            .then((res) => res.data || [])
        );
      }
      return Promise.all(tasks).then((chunks) => ({
        allTeachers: chunks.flat(),
        historyTeacherIdSet
      }));
    }).then(({ allTeachers, historyTeacherIdSet }) => {
      let teachersWithQuota = allTeachers.map((teacher) => {
        const quotaSettings = Array.isArray(teacher.quota_settings) ? teacher.quota_settings : [];
        const matchedEntries = quotaSettings.filter((item) => {
          if (!['level1', 'level2', 'level3'].includes(item.type)) return false;
          return this.codeMatches(specializedCode, item.code);
        });

        const confirmedRemaining = matchedEntries.reduce((sum, item) => {
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
          matchedConfirmedQuota: confirmedRemaining,
          matchedPendingQuota: pendingQuota,
          matchedQuota: confirmedRemaining + pendingQuota
        };
      });

      if (!useQuota) {
        teachersWithQuota = teachersWithQuota.filter((item) => Number(item.matchedQuota || 0) > 0);
      } else {
        teachersWithQuota = teachersWithQuota.filter((item) => {
          const teacherId = String(item.Id || '').trim();
          return historyTeacherIdSet.has(teacherId) || Number(item.matchedQuota || 0) > 0;
        });
      }

      teachersWithQuota.sort((a, b) => {
        if (Number(b.matchedQuota || 0) !== Number(a.matchedQuota || 0)) {
          return Number(b.matchedQuota || 0) - Number(a.matchedQuota || 0);
        }
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const pagedData = teachersWithQuota.slice(start, end);

      if (page === 1) {
        this.setData({
          teachers: pagedData,
          filteredTeachers: pagedData,
          hasMore: end < teachersWithQuota.length
        });
      } else {
        this.setData({
          teachers: this.data.teachers.concat(pagedData),
          filteredTeachers: this.data.filteredTeachers.concat(pagedData),
          hasMore: end < teachersWithQuota.length
        });
      }
    }).catch((err) => {
      wx.hideLoading();
      console.error('本地 quota_settings 兜底加载失败:', err);
      wx.showToast({
        title: '加载导师失败，请稍后重试',
        icon: 'none'
      });
      this.setData({
        teachers: [],
        filteredTeachers: [],
        hasMore: false
      });
    });
  },



  // 根据输入框内容变化来搜索导师
  onSearchInput(event) {
    const searchQuery = event.detail.value; // 获取输入框中的值
    this.setData({ searchQuery });
    
    // 过滤导师列表
    const filteredTeachers = this.data.teachers.filter(teacher => {
       return teacher.name.includes(searchQuery);
       // teacher.ezresearch.includes(searchQuery);
    });

    // 更新过滤后的数据
    this.setData({ filteredTeachers:filteredTeachers });
    console.log("filiterteachers",filteredTeachers)
  },

  // 到达页面底部时加载更多数据
  onReachBottom() {
    if (this.data.hasMore) {
      // 增加页码后加载更多
      this.setData({
        page: this.data.page + 1
      }, () => {
        this.loadTeachers();
      });
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 更新底部导航栏高亮状态
    tabService.updateIndex(this, 0);

  },

  /**
   * 页面下拉刷新
   */
  onPullDownRefresh() {
    // 重新加载数据
    //公告
    this.loadAnnouncements();
    this.setData({
      teachers: [],
      filteredTeachers: [],
      page: 1,
      hasMore: true,
      searchQuery: '' // 清空搜索
    }, () => {
      this.loadTeachers(); // 加载数据
      wx.stopPullDownRefresh(); // 停止下拉刷新动画
    });
  }
});
