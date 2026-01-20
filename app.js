// app.js
App({
  onLaunch() {
    wx.cloud.init({
      env:'cloud1-2gn42bha8f90b918', //粘贴自己的环境ID
    })
  },
 
  globalData: {
    userInfo: null
  }
})