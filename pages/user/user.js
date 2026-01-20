// pages/user/user.js
const tabService = require("../utils/tab-service");
const db=wx.cloud.database();
Page({

    /**
     * 页面的初始数据
     */
    data: {
      Stu:{},
      Landmention:'',
      _id:'',
      selected:'',
      Totalsum:'',
      updatedPhoneNumber: '',  // 用于存储用户输入的手机号
      updatedDescription: '',  // 用于存储用户输入的个人简介
      updatedPassword:'',//用于存储用户输入的密码修改
      confirmPassword: false,//用于显示修改密码页面
      newPassword:'',//验证新密码
      confirmNewPassword:'',//验证新密码
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
      const data=wx.getStorageSync('user');

      this.setData({
        _id:data._id,
        ID:data.ID
      })
      db.collection('Stu')
      .doc(data._id)
      .get()
      .then(res => {
        this.setData({
          Stu:res.data,
          selected:res.data.selected,
          updatedPhoneNumber:res.data.phoneNumber,
          updatedDescription:res.data.description,
        })
      })
    },
  
    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },
    //输入密码
    onPasswordInput(e){
      this.setData({
        updatedPassword: e.detail.value
      });
    },
    // 确认密码输入的处理函数
    // onConfirmPasswordInput: function (e) {
    //   this.setData({
    //     confirmPassword: e.detail.value // 更新确认密码值
    //   });
    // },

    //输入手机号
    onPhoneInput(e) {
      this.setData({
        updatedPhoneNumber: e.detail.value
      });
    },
    // 输入个人简介
    onDescriptionInput(e) {
    this.setData({
      updatedDescription: e.detail.value
      });
    },
     // 提交表单
  submitForm() {
    const { updatedPhoneNumber, updatedDescription } = this.data;

  wx.showModal({
    title: '是否修改个人信息',
    content: '',
    complete: (res) => {
      if (res.confirm) {
         //获取缓存数据
      // let data=wx.getStorageSync('user');
      let data=this.data.Stu
      //如果缓存数据中存在数据
      if(data){
        data.phoneNumber=updatedPhoneNumber;//更新
        data.description=updatedDescription;
        wx.setStorageSync('user', data)
      }else{
        console.log('没有找到缓存数据');
      }

        // 更新云数据库中的数据
    db.collection('Stu').doc(this.data.Stu._id).update({
      data: {
        phoneNumber: updatedPhoneNumber,
        description: updatedDescription,
        // Password:updatedPassword,
      },
      success: res => {
        wx.showToast({
          title: '修改成功',
          icon: 'success'
        });

        // 更新本地数据，显示最新的手机号和简介
        this.setData({
          'Stu.phoneNumber': updatedPhoneNumber,
          'Stu.description': updatedDescription
        });
      },
      fail: err => {
        console.error('更新失败', err);
        wx.showToast({
          title: '修改失败，请稍后再试',
          icon: 'none'
        });
      }
    });
      }
    }
  }) 
  },
   // 提交密码修改
   submitPassword: function () {
    // const { updatedPassword, confirmPassword } = this.data;
    // console.log("updatedPassword",updatedPassword)
    // wx.showModal({
    //   title: '确认修改密码吗？',
    //   content: '',
    //   complete: (res) => {
    //     if (res.confirm) {
    //        // 检查两次密码是否相同
    // if (updatedPassword === confirmPassword) {
    //   // 密码相同，进行修改操作
    //   // wx.showToast({
    //   //   title: '密码修改成功！',
    //   //   icon: 'success',
    //   //   duration: 2000
    //   // });
    //   db.collection('Stu').doc(this.data.Stu._id).update({
    //     data:{
    //       Password:updatedPassword
    //     },
    //     success:res=>{
    //       wx.showToast({
    //         title: '修改成功',
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
   const _id=this.data._id;
   const password=this.data.Stu.Password;
   const updatedPassword=this.data.updatedPassword;
   //console.log("_id,password",_id,password);
    if(updatedPassword==password){
      this.setData({
        confirmPassword:true
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
      // newPassword:'',//清空输入的新密码
      // confirmNewPassword:'',//清空输入的新密码
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
  confirmNewPassword:function(){
    const newPassword=this.data.newPassword;
    const confirmNewPassword=this.data.confirmNewPassword;
    const _id=this.data._id;
    console.log("newPassword,confirmPassword",newPassword,confirmNewPassword);
    console.log("_id",this.data._id);
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

      db.collection('Stu').doc(_id)
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
                  'Stu.Password':confirmNewPassword,
                  newPassword:'',
                  confirmNewPassword:'',
                  confirmPassword:false,//关闭修改密码页面
                  updatedPassword:'',
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
      this.onLoad();
      wx.stopPullDownRefresh();
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