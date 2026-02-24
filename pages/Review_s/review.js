const db = wx.cloud.database();
const tabService = require("../utils/tab-service");

Page({
  data: {
    teacher: {}, // 当前导师信息
    prestudent: [], // 待审核学生
    selectedStudent: {}, // 当前选中的学生信息
    index:'',
    showModal: false, // 控制学生详情窗口
    showRejectReasonInput: false, // 控制拒绝理由输入窗口
    rejectReason: '', // 拒绝理由
    studentIds:'',//全部退回学生操作中的退回学生_id
    acceptstate:false,//选择完按钮就设置禁用状态（初始状态为可选）
    student:[],//存放已选择的学生
    showchosedstudent:false,//显示已经确认学生的详细窗口
  },

  // 页面加载时触发
  onLoad: function () {
    // console.log('onLoad 被触发'); // 确认页面是否加载
  },

  // 页面显示时触发
  onShow: function () {
    console.log('onShow 被触发'); // 确认是否进入 onShow
 //更新底部高亮
    tabService.updateIndex(this, 1);
    const userInfo = wx.getStorageSync('user'); // 获取存储的用户信息
    console.log('获取的用户信息:', userInfo);

    if (!userInfo || !userInfo._id) {
      wx.showToast({
        title: '未获取到导师信息，请登录后重试',
        icon: 'none',
        duration: 2000
      });
      console.error('未找到导师 _id，请检查登录逻辑');
      return;
    }

    const teacherID = userInfo._id; // 从缓存中获取导师 ID
    console.log('导师 ID:', teacherID);

    // 加载数据
    this.loadTeacherDetails(teacherID);
    this.loadPendingStudents(teacherID);
  },

  //查看确定双选关系的学生
  showStuinfomation:function(){
    console.log("teacher",this.data.teacher);
    db.collection('Teacher')
        .doc(this.data.teacher._id)
        .get()
        .then(res=>{
          this.setData({
            student:res.data.student,
            showchosedstudent:true,
          })
          console.log("student:",res.data.student);
        })
  },
  //关闭显示确定双选学生的页面
  closeStudentinformation:function(){
    console.log('关闭学生详情窗口'); // 调试日志

  this.setData({
    showchosedstudent: false,
    // selectedStudent: {}
  });
  },
  // 加载导师详情
  loadTeacherDetails: function (teacherID) {
    console.log('加载导师信息，ID:', teacherID); // 调试日志

    wx.showLoading({ title: '加载导师信息...' });

    db.collection('Teacher').doc(teacherID).get()
      .then((res) => {
        wx.hideLoading();

        if (res.data) {
          console.log('导师数据:', res.data);
          this.setData({
            teacher: res.data,
          });
        } else {
          wx.showToast({
            title: '导师信息不存在',
            icon: 'none'
          });
          console.error('未找到导师数据，teacherID:', teacherID);
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('加载导师信息失败:', err);
        wx.showToast({
          title: '加载失败，请稍后再试',
          icon: 'none'
        });
      });
  },

  // 加载待审核学生信息
  loadPendingStudents: function (teacherID) {
    console.log('加载待审核学生，导师 ID:', teacherID); // 调试日志

    wx.showLoading({ title: '加载申请学生...' });

    db.collection('Teacher').doc(teacherID).get()
      .then((res) => {
        wx.hideLoading();

        if (res.data && res.data.prestudent) {
          console.log('待审核学生列表:', res.data.prestudent);
          this.setData({
            prestudent: res.data.prestudent
          });
        } else {
          console.warn('导师没有待审核学生');
          this.setData({ prestudent: [] });
          wx.showToast({
            title: '暂无申请学生',
            icon: 'none'
          });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('加载申请学生失败:', err);
      });
  },

  // 显示学生详细信息
  showStudentDetails: function (e) {
    const studentId = e.currentTarget.dataset.studentId;
    const index=e.currentTarget.dataset.index;
    console.log('查看学生详情，学生 ID:', studentId); // 调试日志
    console.log("学生index：",index);
    const student = this.data.prestudent.find((item) => item.studentId === studentId);
    console.log("student",student);
    if (student) {
      this.setData({
        selectedStudent: student,
        showModal: true,
        index:index,
        acceptstate:false,//点击了查看学生，就将按钮设置为可选
      });
    } else {
      wx.showToast({
        title: '学生信息加载失败',
        icon: 'none'
      });
    }
  },

  // 关闭学生详情窗口
  closeStudentDetails: function () {
    console.log('关闭学生详情窗口'); // 调试日志

    this.setData({
      showModal: false,
      selectedStudent: {}
    });
  },

  // 接受学生申请
  acceptStudent: async function (event) {
    console.log("点击测试")
    const { selectedStudent, teacher, index } = this.data;
    const _ = db.command;
    const that = this;
    const Tec = teacher;
    const Tec_id = Tec._id;
    const item = this.data.prestudent[index];
    this.setData({ acceptstate: true });//选择完就将按钮设置为禁用状态
    if (!selectedStudent.studentId || !Tec._id) {
      wx.showToast({
        title: '数据异常，请稍后重试',
        icon: 'none',
      });
      this.setData({ acceptstate: false });//异常再将按钮设置为可用状态
      console.error('接受学生申请时数据异常');
      return;
    }
  
    wx.showLoading({ title: '处理中...' });
  
    try {
      // **查询学生的最新信息，防止并发导致数据不同步**
      const studentRes = await db.collection('Stu').doc(selectedStudent.studentId).get();
      const latestStudent = studentRes.data;
  
      if (latestStudent.selected) {
        wx.hideLoading();
        this.setData({ showModal: false });//关闭详细窗口
        wx.showModal({
          title: `该学生已被 ${latestStudent.selected} 选中，申请作废`,
          content: '',
          showCancel:false,
          complete: (res) => {
            if (res.confirm) {
              this.setData({ acceptstate: false });//将按钮设置为可用状态
            }
          }
        })
        // **从导师的待审核列表中删除该学生**
        await db.collection('Teacher').doc(Tec_id).update({
          data: {
            prestudent: _.pull({
              studentId: selectedStudent.studentId,
            }),
          },
        });
        // **刷新待审核学生列表**
        that.loadPendingStudents(Tec_id);
        return;
      }
  
      // 显示确认模态框
      const modalRes = await new Promise((resolve, reject) => {
        wx.showModal({
          title: '确认接受',
          content: `是否接受学生 ${selectedStudent.studentName} 的申请？`,
          success: resolve,
          fail: reject,
        });
      });
  
      if (!modalRes.confirm) {
        this.setData({ acceptstate: false });//将按钮设置为可用状态
       wx.hideLoading();
        return;
      }
  
  
      const selectedField = latestStudent.selectedField;
      const level3Code = latestStudent.level3_code || latestStudent.specializedCode || '';

      // **事务更新学生和导师信息**
      const studentUpdate = db.collection('Stu').doc(selectedStudent.studentId).update({
        data: {
          status: 'chosed',
          selected: Tec.name,
          selectedTecId: Tec.Id,
        },
      });

      let teacherUpdate;

      // 新版：优先按 quota_settings(level3_code) 扣减
      if (Array.isArray(Tec.quota_settings) && Tec.quota_settings.length > 0 && level3Code) {
        const quotaIndex = Tec.quota_settings.findIndex((item) =>
          item.type === 'level3' && String(item.code) === String(level3Code)
        );

        if (quotaIndex < 0) {
          wx.hideLoading();
          this.setData({ acceptstate: false });
          wx.showToast({
            title: '未匹配到该学生专业对应指标',
            icon: 'none'
          });
          return;
        }

        const matchedQuota = Tec.quota_settings[quotaIndex];
        const total = Number(matchedQuota.max_quota || 0);
        const used = Number(matchedQuota.used_quota || 0);
        if (total - used <= 0) {
          wx.hideLoading();
          this.setData({ acceptstate: false });
          wx.showToast({
            title: '招生名额不足',
            icon: 'none',
          });
          return;
        }

        teacherUpdate = db.collection('Teacher').doc(Tec._id).update({
          data: {
            prestudent: _.pull({
              studentId: selectedStudent.studentId,
            }),
            [`quota_settings.${quotaIndex}.used_quota`]: _.inc(1),
            student: _.push({
              studentId: selectedStudent.studentId,
              specialized: selectedStudent.specialized,
              studentName: selectedStudent.studentName,
              phoneNumber: selectedStudent.phoneNumber,
              Id: selectedStudent.Id,
              categoryKey: matchedQuota.code,
            }),
          },
        });
      } else {
        // 兼容旧版字段
        const legacyField = selectedField || null;
        if (!legacyField || Tec[legacyField] <= 0) {
          wx.hideLoading();
          this.setData({ acceptstate: false });
          wx.showToast({
            title: '招生名额不足',
            icon: 'none',
          });
          return;
        }

        teacherUpdate = db.collection('Teacher').doc(Tec._id).update({
          data: {
            prestudent: _.pull({
              studentId: selectedStudent.studentId,
            }),
            [legacyField]: _.inc(-1),
            [`used_${legacyField}`]: _.inc(1),
            student: _.push({
              studentId: selectedStudent.studentId,
              specialized: selectedStudent.specialized,
              studentName: selectedStudent.studentName,
              phoneNumber: selectedStudent.phoneNumber,
              Id: selectedStudent.Id,
              categoryKey: legacyField,
            }),
          },
        });
      }
  
      await Promise.all([studentUpdate, teacherUpdate]);
  
      // **检查招生名额**
      const teacherData = await db.collection('Teacher').doc(Tec_id).get();
      let quotaExhausted = false;
      if (Array.isArray(teacherData.data.quota_settings) && level3Code) {
        const currentQuota = teacherData.data.quota_settings.find((item) =>
          item.type === 'level3' && String(item.code) === String(level3Code)
        );
        quotaExhausted = !!currentQuota && Number(currentQuota.max_quota || 0) - Number(currentQuota.used_quota || 0) <= 0;
      } else if (selectedField) {
        quotaExhausted = Number(teacherData.data[selectedField] || 0) <= 0;
      }

      if (quotaExhausted) {
        const studentsToReturn = this.data.prestudent
          .filter((s) => s.specialized === item.specialized && s.studentId !== item.studentId)
          .map((s) => s.studentId);
  
        if (studentsToReturn.length > 0) {
          await wx.cloud.callFunction({
            name: 'SelectUpdate',
            data: {
              tecId: Tec_id,
              tecName: Tec.name,
              studentIds: studentsToReturn,
              reason: '由于导师名额已满，被自动退回。',
              timestamp: new Date().getTime(),
            },
          });
        }
      }
  
      wx.hideLoading();
      wx.showToast({
        title: '操作成功',
        icon: 'success',
      });
  
      // **刷新待审核学生列表**
      this.setData({ showModal: false });
      that.loadPendingStudents(Tec_id);
  
    } catch (err) {
      wx.hideLoading();
      console.error('操作失败:', err);
      wx.showToast({
        title: '操作失败，请稍后再试',
        icon: 'none',
      });
    }
  },

  //         // 更新学生状态和导师信息
  //         db.collection('Stu').doc(selectedStudent.studentId).update({
  //           data: {
  //             status: 'chosed',
  //             selected: teacher.name // 记录导师姓名,到时候可以存导师头像啥的，在学生端的use中显示
  //           }
  //         })
  //         .then(() => {
  //           return db.collection('Teacher').doc(teacher._id).update({
  //             data: {
  //               prestudent: db.command.pull({ studentId: selectedStudent.studentId }), // 从待审核列表移除
                
  //               [field]: db.command.inc(-1), // 扣减招生名额，这里到时候下面需要添加对老师的招生名额表中的已使用进行修改
  //               [usedField]: db.command.inc(1), // 增加已使用名额
  //               student: db.command.push({ // 将学生信息追加到 student 字段
  //                 studentId: selectedStudent.studentId,
  //                 studentName: selectedStudent.studentName,
  //                 specialized: selectedStudent.specialized,
  //                 type: selectedStudent.Type
  //               })
  //             }
  //           });
  //         })
  //         .then(() => {
  //           wx.hideLoading();
  //           wx.showToast({
  //             title: '接受成功',
  //             icon: 'success'
  //           });
  //           this.setData({ showModal: false });
  //           this.loadPendingStudents(teacher._id); // 刷新学生列表
   
  //         })
  //         .catch((err) => {
  //           wx.hideLoading();
  //           console.error('操作失败:', err);
  //           wx.showToast({
  //             title: '操作失败，请稍后再试',
  //             icon: 'none'
  //           });
  //         });
  //       }
  //     }
  //   });
  // },

  // 拒绝学生申请
  rejectStudent: function () {
    console.log('准备拒绝学生申请'); // 调试日志
    this.setData({ showRejectReasonInput: true });
  },

  // 关闭拒绝理由输入框
  closeRejectReasonInput: function () {
    console.log('关闭拒绝理由输入框'); // 调试日志

    this.setData({
      showRejectReasonInput: false,
      rejectReason: ''
    });
  },

// 实时更新拒绝理由
onRejectReasonChange: function (e) {
  this.setData({
    rejectReason: e.detail.value
  });
  console.log('用户输入的拒绝理由:', e.detail.value); // 调试日志
},



  // 确认拒绝学生申请
  confirmRejectStudent: function () {
    const { selectedStudent, rejectReason, teacher } = this.data;
    console.log('确认拒绝学生申请:', selectedStudent); // 调试日志

    const rejectionDetails = {
        teacherName: teacher.name, // 导师姓名
        teacherId: teacher._id, // 导师ID
        reason: rejectReason ? rejectReason.trim() : '导师没有填写拒绝理由', // 拒绝理由
        timestamp: new Date().getTime() // 时间戳
    };

    wx.showLoading({ title: '处理中...' });

    db.collection('Stu').doc(selectedStudent.studentId).update({
        data: {
            status: 'chosing', // 状态回到待选择
            preselection: [], // 清空申请导师信息
            reason: db.command.push(rejectionDetails) // 将拒绝理由存入数组
        }
    })
    .then(() => {
        return db.collection('Teacher').doc(teacher._id).update({
            data: {
                prestudent: db.command.pull({ studentId: selectedStudent.studentId }) // 从待审核列表移除
            }
        });
    })
    .then(() => {
        wx.hideLoading();
        wx.showToast({
            title: '拒绝成功',
            icon: 'success'
        });
        this.setData({
            showRejectReasonInput: false, // 隐藏输入框
            showModal: false, // 隐藏学生详情框
            rejectReason: '', // 清空输入框内容
            selectedStudent: {} // 清空选中学生数据
        });
        this.loadPendingStudents(teacher._id); // 刷新学生列表
    })
    .catch((err) => {
        wx.hideLoading();
        console.error('操作失败:', err);
        wx.showToast({
            title: '操作失败，请稍后重试',
            icon: 'none'
        });
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
      const userInfo = wx.getStorageSync('user'); // 获取存储的用户信息
      console.log('获取的用户信息:', userInfo);
  
      if (!userInfo || !userInfo._id) {
        wx.showToast({
          title: '未获取到导师信息，请登录后重试',
          icon: 'none',
          duration: 2000
        });
        console.error('未找到导师 _id，请检查登录逻辑');
        return;
      }
  
      const teacherID = userInfo._id; // 从缓存中获取导师 ID
      console.log('导师 ID:', teacherID);
  
      // 加载数据
      this.loadTeacherDetails(teacherID);
      this.loadPendingStudents(teacherID);

      wx.stopPullDownRefresh();  // 立即停止下拉刷新
      console.log('下拉刷新');
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

});
