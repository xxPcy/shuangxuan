// pages/Stu/Stu.js
Page({

    /**
     * 页面的初始数据
     */
    data: {
   
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad:function() {
      this.setTabBar();
    },
    getCurrentTabBar: function () {
      const identity = wx.getStorageSync('identities');
      switch (identity) {
        case '学生':
          return 'studentTabBar'; // 学生版tabbar模板名称
        case '导师':
          return 'teacherTabBar'; // 导师版tabbar模板名称
        case '管理员':
          return 'adminTabBar'; // 管理员版tabbar模板名称
        default:
          return 'studentTabBar'; // 默认为学生版
      }
    },
     // 设置当前页面的tabbar
  setTabBar: function () {
    const tabBar = this.getCurrentTabBar();
    this.setData({
      currentTabBar: {
        name: tabBar, // 设置模板名称
        data: {} // 传递给模板的数据，这里一般为空对象，根据需要设置
      },
    });
  },
    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {

    }
})