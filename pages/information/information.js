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
    const { specializedCode, page, pageSize } = this.data;
    
    console.log("loadTeachers - 三级专业代码:", specializedCode);
    
    // 如果有三级专业代码，使用新的基于QuotaHolders的查询方式
    if (specializedCode) {
      console.log("使用 getTeachersBySpecialty 查询导师");
      wx.cloud.callFunction({
        name: 'getTeachersBySpecialty',
        data: {
          specializedCode: specializedCode,
          page: page,
          pageSize: pageSize
        },
        success: res => {
          wx.hideLoading();
          console.log("getTeachersBySpecialty 返回结果:", res.result);
          if (res.result?.success) {
            const newTeachers = res.result.data;
            const hasMore = res.result.hasMore;
            console.log("根据专业代码获取的导师列表:", newTeachers);
            
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
            // 如果新方法失败，回退到旧方法
            that.loadTeachersLegacy();
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('云函数调用失败:', err);
          // 回退到旧方法
          that.loadTeachersLegacy();
        }
      });
    } else {
      // 没有专业代码，使用旧的加载方式
      this.loadTeachersLegacy();
    }
  },

  // 旧的加载导师方式（作为备用）
  loadTeachersLegacy() {
    wx.showLoading({
      title: '数据载入中...',
    });
    const fieldMapping = {
      '控制科学与工程': ['kongzhiX'],//有
      '电气工程学硕': ['dqgcxs'],//有
      '控制工程专硕': ['dzxxzs','dzxxlp'],//有
      '人工智能专硕': ['dzxxzs','dzxxlp'],//有
      '人工智能联培': ['dzxxlp'],//有
      '控制工程联培': ['dzxxlp'],//有
      '电气工程专硕': ['dqgczs','dqgclp'],//有
      '电气工程联培': ['dqgclp'],//有
      '人工智能士兵计划': ['dzxxsoldier'],
      '控制工程士兵计划': ['dzxxsoldier'],
      '电气工程士兵计划': ['dqgcsoldier'],
      '人工智能非全日制': ['dzxxpartTime'],
      '控制工程非全日制': ['dzxxpartTime'],
      '电气工程非全日制': ['dqgcpartTime']
    };
    const that = this;
    const recursiveLoad = (currentPage) => {
      wx.cloud.callFunction({
        name: 'getTeachers',
        data: {
          page: currentPage,
          pageSize: that.data.pageSize,
          fields: fieldMapping[that.data.category]
        },
        success: res => {
          if (res.result?.success) {
            const newTeachers = res.result.data;
            const hasMore = newTeachers.length === that.data.pageSize;
            console.log("newsteacher",newTeachers);
            that.setData({
              teachers: that.data.teachers.concat(newTeachers),
              filteredTeachers: that.data.filteredTeachers.concat(newTeachers),
              page: currentPage,  // 更新当前页码
              hasMore
            }, () => {
              // 递归继续加载的条件
              if (hasMore) {
                recursiveLoad(currentPage + 1);
                
              } else {
                wx.hideLoading();
                if (currentPage > 1 && newTeachers.length === 0) {
                  
                  wx.showToast({
                    title: '已加载全部数据',
                    icon: 'none'
                  });
                }
              }
            });
          } else {
            wx.hideLoading();
            console.error('数据格式异常:', res.result);
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('加载失败:', err);
          wx.showToast({
            title: `加载失败: ${err.errMsg}`,
            icon: 'none'
          });
        }
      });
    };
  
    // 首次加载时清空旧数据
    if (this.data.page === 1) {
      this.setData({
        teachers: [],
        filteredTeachers: []
      }, () => {
        recursiveLoad(1);
      });
    } else {
      recursiveLoad(this.data.page);
    }
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
