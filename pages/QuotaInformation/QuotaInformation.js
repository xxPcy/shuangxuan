// pages/QuotaInformation/QuotaInformation.js
const tabService = require("../utils/tab-service");
const db=wx.cloud.database();

Page({

    /**
     * 页面的初始数据
     */
    data: {
      teacher:{},
      Tec_id:'',
      student:[],
      showModal:false,//用于显示导师查看以确定的双选名单
      updatedPassword:'',//用于存储用户输入的密码修改
      //confirmPassword: '',      // 存储确认密码
      confirmPassword:false,//用于显示修改密码部分，初始状态为不可显示
      //oldPassword:'',//保存原本的密码
      inputPassword:'',//保存输入的密码
      newPassword:'',//验证新密码
      confirmNewPassword:'',//验证新密码
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
      this.Tecinformation();
      
    },
    //更新登陆密码
    updatePassword:function(e){
      this.setData({
        inputPassword:e.detail.value,
      })
    },
    inputNewPassword:function(e){
      this.setData({
        newPassword:e.detail.value,
      })
    },
    inputNewPassworddouble:function(e){
      this.setData({
        confirmNewPassword:e.detail.value,
      })
    },
    // 确认密码输入的处理函数
    // onConfirmPasswordInput: function (e) {
    //   this.setData({
    //     confirmPassword: e.detail.value // 更新确认密码值
    //   });
    // },    
    //更新办公室
    updateOffice:function(e){
      this.setData({
        'teacher.office':e.detail.value,
      })
    },
    //更新邮箱
    updateEmail:function(e){
      this.setData({
        'teacher.email':e.detail.value,
      })
    },
    //更新研究方向
    updateEzResearch:function(e){
      this.setData({
        'teacher.ezresearch':e.detail.value,
      })
    },
    //更新招生说明
    updateDescription:function(e){
      this.setData({
        'teacher.description':e.detail.value,
      })
    },
    //表单提交
    btnSub: function (e) {
      const teacherData = this.data.teacher;
      wx.showModal({
        title: '提交修改',
        content: '确定提交修改个人信息吗',
        complete: (res) => {
          if (res.confirm) {
             // 提交更新后的数据
      wx.showLoading({
        title: '提交中...',
      });
  
      // 假设你使用云数据库进行更新
      db.collection('Teacher').doc(this.data.Tec_id).update({
        data: {
          name: teacherData.name,
          office: teacherData.office,
          email: teacherData.email,
          ezresearch: teacherData.ezresearch,
          description: teacherData.description,
          // Password:teacherData.Password,
        },
        success: () => {
          wx.hideLoading();
          wx.showToast({
            title: '更新成功',
            icon: 'success',
          });
        },
        fail: (err) => {
          wx.hideLoading();
          wx.showToast({
            title: '更新失败，请稍后再试',
            icon: 'none',
          });
          console.error('更新失败:', err);
        },
      });
          }
        }
      })
     
    },
    //载入老师的信息到本地存储中
    Tecinformation:function(){
      wx.getStorage({
        key:'user',
        success:(res)=>{
          console.log('缓存数据',res)
          this.setData({
            Tec_id:res.data._id
          });
          db.collection('Teacher')
          .doc(res.data._id)
          .get()
          .then(res=>{
            this.setData({
              teacher:res.data,
              //oldPassword:res.data.Password,
            })
          })
        }
      })
    },
    // 重置表单的方法
  onReset() {
    // 弹出确认框
    wx.showModal({
      title: '确认重置',
      content: '确定要重置表单内容吗？',
      success: (res) => {
        if (res.confirm) {
          // 用户点击了确定，执行重置操作
          console.log('用户确认重置');
          this.resetForm();
        } else if (res.cancel) {
          // 用户点击了取消
          console.log('用户取消重置');
        }
      }
    });
  },
    // 执行表单重置的逻辑
    resetForm() {
      // 你可以在这里清空表单数据，重置输入框等
      this.setData({
        // 示例，假设你的表单字段名是如下
        'teacher.office': '',
        'teacher.email': '',
        'teacher.ezresearch': '',
        'teacher.description': '',
      });
    },

    //修改密码函数
    submitPassword:function(){
      // const teacherData = this.data.teacher;
      // const confirmPassword=this.data.confirmPassword;
      // console.log("updatedPassword",teacherData.Password);
      // wx.showModal({
      //   title: '确定要修改密码吗？',
      //   content: '',
      //   complete: (res) => {
      //     if (res.confirm) {
      //        // 检查两次密码是否相同
      // if (teacherData.Password === confirmPassword) {
      //   // 密码相同，进行修改操作
      //   // wx.showToast({
      //   //   title: '密码修改成功！',
      //   //   icon: 'success',
      //   //   duration: 2000
      //   // });
      //   db.collection('Teacher').doc(this.data.Tec_id).update({
      //     data:{
      //       Password:teacherData.Password
      //     },
      //     success:res=>{
      //       wx.showToast({
      //         title: '密码修改成功',
      //         icon: 'success'
      //       });
      //       this.setData({
      //         confirmPassword:''
      //       })
      //     },
      //     fail:err=>{
      //       console.error('更新失败', err);
      //       wx.showToast({
      //         title: '修改失败，请稍后再试',
      //         icon: 'none'
      //       });
      //     }
      //   })
      // } else {
      //   // 密码不一致，显示错误提示
      //   wx.showToast({
      //     title: '修改密码不同，无法修改',
      //     icon: 'none',
      //     duration: 2000
      //   });
      // }
      //     }
      //   }
      // })
      const teacherData = this.data.teacher;
      const inputPassword=this.data.inputPassword;
      const oldPassword=teacherData.Password;
      //const Tec_id=this.data.Tec_id;
      console.log("oldPassword",oldPassword);
      if(inputPassword==oldPassword){
          this.setData({
            confirmPassword:true,//点击之后进入修改密码部分
          })
      }else{
        wx.showToast({
          title: '与原密码不同，请重新输入',
          icon: 'none',
          duration:2000
        })
      }
    },
    closePassWord:function(){
      this.setData({
        confirmPassword:false,//关闭修改密码的小框
        newPassword:'',//清空输入的新密码
        confirmNewPassword:'',//清空输入的新密码
      })
    },
    confirmNewPassword:function(){
      const newPassword=this.data.newPassword;
      const confirmNewPassword=this.data.confirmNewPassword;
      const Tec_id=this.data.Tec_id;
      console.log("newPassword,confirmPassword",newPassword,confirmNewPassword);
      console.log("Tec_id",this.data.Tec_id);
      if(newPassword==''||confirmNewPassword==''){
        wx.showToast({
          title: '输入为空，请输入要修改的密码',
          icon:'none',
          duration:2000,
        })
        return;
      }
      if(newPassword==confirmNewPassword){
        wx.showLoading({
          title: '修改中...',
        })

        db.collection('Teacher').doc(Tec_id)
        .update({
          data:{
            Password:confirmNewPassword
          },
          success:res=>{
                  wx.hideLoading();
                  wx.showToast({
                    title: '密码修改成功',
                    icon: 'success'
                  });
                  this.setData({
                    'teacher.Password':confirmNewPassword,
                    newPassword:'',
                    confirmNewPassword:'',
                    confirmPassword:false,//关闭修改密码页面
                    inputPassword:'',
                  })
                },
                fail:err=>{
                  console.error('更新失败', err);
                  wx.hideLoading();
                  wx.showToast({
                    title: '修改失败，请稍后再试',
                    icon: 'none'
                  });
                }
        })
      }else{
        wx.showToast({
          title: '两次密码不一致,请重新输入',
          duration:2000,
          icon:'none'
        })
      }
    },
    copyText:function(e){
      wx.setClipboardData({
        data: e.currentTarget.dataset.text,
        success() {
          wx.showToast({
            title: '复制成功',
            icon: 'success'
          });
        }
      });
    },
    //查看确定双选关系的学生
    // showStuinfomation:function(){
    //   console.log("teacher",this.data.teacher);
    //   db.collection('Teacher')
    //       .doc(this.data.Tec_id)
    //       .get()
    //       .then(res=>{
    //         this.setData({
    //           student:res.data.student,
    //           showModal:true,
    //         })
    //         console.log("student:",res.data.student);
    //       })
    // },
    // //关闭显示确定双选学生的页面
    // closeStudentinformation:function(){
    //   console.log('关闭学生详情窗口'); // 调试日志

    // this.setData({
    //   showModal: false,
    //   selectedStudent: {}
    // });
    // },
    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {
 //更新底部高亮
 tabService.updateIndex(this, 2);
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
      wx.stopPullDownRefresh();  // 立即停止下拉刷新
      console.log('禁止下拉刷新');
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