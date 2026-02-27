// pages/land/land.js
const tabService = require("../utils/tab-service");
const db=wx.cloud.database();
Page({

    /**
     * 页面的初始数据
     */

    data: {
      identity: '学生',  // 默认选择学生  
      selectedIdentity: '学生',  // 默认显示选择的身份 
      loginbtnstate:'true',
      strloginUser:'',
      strloginpassword:'',
      passwordVisible: false, // 默认密码不可见
    },
    identityChange: function(e) {
      const index = e.detail.value;
      const identities = ['学生', '导师','管理员'];
      this.setData({
        // identity: identities[index],
        selectedIdentity: identities[index]  // 更新显示选择的身份

      })
      
    },

    // test:function(){
    //   db.collection("Stu").get().then(res=>{console.log(res.data)})
    // },

    //根据选择的身份来实现登录
    land: function() {
      const selectedIdentity = this.data.selectedIdentity;
      const strloginUser = this.data.strloginUser;
      const strloginpassword = this.data.strloginpassword;
      const strloginName=this.data.strloginName;
      console.log("Selected identity:", selectedIdentity); // 调试输出选定的身份
      console.log("姓名",this.data.strloginName);
      console.log("id",this.data.strloginUser);
      console.log("密码",this.data.strloginpassword)
      // 检查是否有选择身份
      if (!selectedIdentity) {
        console.error("No identity selected!");
        return;
      }
    
      // 根据选择的身份进行页面跳转
      if(selectedIdentity==='学生'){
        wx.cloud.callFunction({
          name:'identifying',
          data:{
            strloginName,
            strloginUser,
            strloginpassword
          },
          success:res=>{
            //console.log(res.result.data)//测试否传入
            const uq=res.result.data;
            // console.log(uq.name);
            if(res.result.success){  
              wx.showToast({
                title: '登录成功',
                icon:'success'
              });
              //将用户的数据存储到本地中，用于显示在个人界面
            wx.setStorageSync(
              'user', 
              {
                _id:uq._id,
                ID:uq.Id,
                // phoneNumber:uq.phoneNumber,
                // name:uq.name,
                specialized:uq.specialized,
                specializedCode: uq.specializedCode || '',  // 三级专业代码
                level1_code: uq.level1_code || '',  // 一级专业代码
                level2_code: uq.level2_code || '',  // 二级专业代码
                level3_code: uq.level3_code || '',  // 三级专业代码
                useQuota: !!uq.useQuota, // true: 占用指标；false: 不占用指标
                // description:uq.description,
                // preselection:uq.preselection,
                // Bigtype:uq.Bigtype,
                status:uq.status,
              });
              tabService.updateRole(this,'0')
              wx.switchTab({
                url: '/pages/information/information',
              });
            } else{
              wx.showToast({
                title: '输入信息或密码错误',
                icon:'none'
              })
            }
          },
          fail:err=>{
            wx.showToast({
              title:'调用失败',
              icon:'none'
            });
            console.error(err);
          }
        })
        // tabService.updateRole(this, '0')
        // wx.switchTab({
        //   url: '/pages/information/information',
        // });

          }else if(selectedIdentity==='导师'){
            wx.cloud.callFunction({
              name:'Tecindentifying',
              data:{
                strloginName,
                strloginUser,
                strloginpassword

              },
              success:res=>{
                const uq=res.result.data;
                if(res.result.success){
                  wx.showToast({
                    title: '登录成功',
                    icon:'success'
                  });
                  wx.setStorageSync(
                    'user', 
                    {   
                      _id:uq._id,
                      Id:uq.Id,
                      name:uq.name,
                      picture:uq.picture,
                      prestudent:uq.prestudent
                    });
                  tabService.updateRole(this,'1')
                  wx.switchTab({
                    url: '/pages/Tec/Tec',
                  });
                } else{
                  wx.showToast({
                    title: '输入信息或密码错误',
                    icon:'none'
                  })
                }
              },
              fail:err=>{
                wx.showToast({
                  title:'调用失败',
                  icon:'none'
                });
                console.error(err);
              }
            })
          //   tabService.updateRole(this, '1')
          // wx.switchTab({
          //   url: '/pages/Tec/Tec',
          // }) ;
        } else if(selectedIdentity==='管理员'){

          wx.cloud.callFunction({
            name:'Administrator',
            data:{
              strloginName,
              strloginUser,
              strloginpassword
            },
            success:res=>{
              if(res.result.success){
                wx.showToast({
                  title: '登录成功',
                  icon:'success'
                });
                tabService.updateRole(this,'2')
                wx.switchTab({
                  url: '/pages/admin/admin',
                });
              } else{
                wx.showToast({
                  title: '输入信息或密码错误',
                  icon:'none'
                })
              }
            },
            fail:err=>{
              wx.showToast({
                title:'调用失败',
                icon:'none'
              });
              console.error(err);
            }
          })
          // tabService.updateRole(this, '2')
          //   wx.switchTab({
          //     url: '/pages/admin/admin',
          //   });
      }else{
        console.log('错误');
      }
    },

    //输入工号判断
   inputiphone1: function(e) {
  console.log(e.detail.value);
  const inputValue = e.detail.value;

  // 更新用户名
  this.setData({
    strloginUser: inputValue
  });

  // 根据用户名和密码字段来判断按钮状态
  this.updateLoginButtonState();
},

//输入名字判断
inputiName:function(e){
  console.log(e.detail.value);
  const inputValue = e.detail.value;

  //更新名字
  this.setData({
    strloginName: inputValue
  });

  //判断按钮状态
  this.updateLoginButtonState();
},

//输入密码判断
password1: function(e) {
  console.log(e.detail.value);
  const inputValue = e.detail.value;

  // 更新密码
  this.setData({
    strloginpassword: inputValue
  });

  
  // 根据用户名和密码字段来判断按钮状态
  this.updateLoginButtonState();
},
  // 控制密码的显示与隐藏
  togglePasswordVisibility: function() {
    this.setData({
      passwordVisible: !this.data.passwordVisible // 切换密码显示状态
    });
  },
// 更新登录按钮状态的函数
updateLoginButtonState: function() {
  const { strloginUser, strloginpassword } = this.data;

  if (strloginUser && strloginpassword) {
    this.setData({
      loginbtnstate: false
    });
  } else {
    this.setData({
      loginbtnstate: true
    });
  }
},
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
      // tabService.updateRole(this, '0')
      // wx.switchTab({
      //   url:'/pages/information/information.'
      // })
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