const db = wx.cloud.database();
Page({

  /**
   * 页面的初始数据
   */
  data: {
    status:'',
    teacher: "",
    Stu: "",
    StuID: "",
    teacherID:"",
    buttonStates: {
      kongzhiX: false,
      dqgcxs: false,
      dzxxzs: false,
      dzxxlp: false,
      dqgczs: false,
      dqgclp: false,
      dzxxsoldier: false,
      dqgcsoldier: false,
      dzxxpartTime: false,
      dqgcpartTime: false
    },
    buttonColors: {}, // 按钮颜色（绿色/黄色/灰色）
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const teacherID = options._id;
    this.setData({
      teacherID:teacherID
    });
    console.log("teacherID",teacherID)
    const data = wx.getStorageSync('user'); // 获取学生数据
    console.log("学生信息", data); // 打印学生信息，确保包含 specialized 字段
    const stu_id=data._id;
    console.log("stu_id",stu_id)
    db.collection('Stu').doc(stu_id).get()
    .then(res=>{
      const status=res.data.status
      this.setData({
        status:res.data.status,
        Stu:res.data,
        StuID:res.data.Id
      });
      db.collection('Teacher').doc(teacherID)
      .get()
      .then(res => {
        this.setData({
          teacher: res.data
        });
        console.log("导师信息:", res.data);
        // 更新按钮状态和颜色
        this.updateButtonStates(this.data.Stu.specialized, res.data, status);
      })
      .catch(error => {
        console.error('无法加载老师详细信息', error);
      });
    })

    // 根据学生类别和导师名额设置按钮状态和颜色
    // this.loadTeacherDetails(teacherID);
    
  },

  // 加载导师详情
  loadTeacherDetails: function (id) {
    db.collection('Teacher').doc(id)
      .get()
      .then(res => {
        this.setData({
          teacher: res.data
        });
        console.log("导师信息:", res.data);
        console.log('status',this.data.status)
        // 更新按钮状态和颜色
        this.updateButtonStates(this.data.Stu.specialized, res.data,this.data.status);
      })
      .catch(error => {
        console.error('无法加载老师详细信息', error);
      });
  },

  // 更新按钮状态和颜色，根据学生专业和导师名额动态显示
  updateButtonStates: function (specialized, teacher,status) {
    const buttonStates = {
      kongzhiX: true,
      dqgcxs: true,
      dzxxzs: true,
      dzxxlp: true,
      dqgczs: true,
      dqgclp: true,
      dzxxsoldier: true,
      dqgcsoldier: true,
      dzxxpartTime: true,
      dqgcpartTime: true
    };

    const buttonColors = {
      kongzhiX: '#d3d3d3', // 默认灰色
      dqgcxs: '#d3d3d3',
      dzxxzs: '#d3d3d3',
      dzxxlp: '#d3d3d3',
      dqgczs: '#d3d3d3',
      dqgclp: '#d3d3d3',
      dzxxsoldier: '#d3d3d3',
      dqgcsoldier: '#d3d3d3',
      dzxxpartTime: '#d3d3d3',
      dqgcpartTime: '#d3d3d3'
    };
    if(status=="chosing"){
      // 根据学生专业设置按钮状态和颜色
    switch (specialized) {
      case '人工智能专硕':
      case '控制工程专硕':
        buttonStates.dzxxzs = false; // 人工智能/控制工程专硕
        buttonStates.dzxxlp = false; // 人工智能/控制工程联培
        buttonColors.dzxxzs = teacher.dzxxzs > 0 ? '#90ee90' : '#f0e68c';
        buttonColors.dzxxlp = teacher.dzxxlp > 0 ? '#90ee90' : '#f0e68c';
        break;
      case '人工智能联培':
      case '控制工程联培':
        buttonStates.dzxxzs = false; // 人工智能/控制工程专硕
        buttonStates.dzxxlp = false; // 人工智能/控制工程联培
        buttonColors.dzxxzs = teacher.dzxxzs > 0 ? '#90ee90' : '#f0e68c';
        buttonColors.dzxxlp = teacher.dzxxlp > 0 ? '#90ee90' : '#f0e68c';    
        break;
      case '电气工程专硕':
        buttonStates.dqgczs = false; // 电气工程专硕
        buttonStates.dqgclp = false; // 电气工程联培        
        buttonColors.dqgczs = teacher.dqgczs > 0 ? '#90ee90' : '#f0e68c';
        buttonColors.dqgclp = teacher.dqgclp > 0 ? '#90ee90' : '#f0e68c';     
        break;
      case '电气工程联培':
        buttonStates.dqgczs = false; // 电气工程专硕
        buttonStates.dqgclp = false; // 电气工程联培        
        buttonColors.dqgczs = teacher.dqgczs > 0 ? '#90ee90' : '#f0e68c';
        buttonColors.dqgclp = teacher.dqgclp > 0 ? '#90ee90' : '#f0e68c';     
        break;
      case '控制科学与工程':
        buttonStates.kongzhiX = false; // 控制科学与工程
        buttonColors.kongzhiX = teacher.kongzhiX > 0 ? '#90ee90' : '#f0e68c';
        break;
      case '电气工程学硕':
        buttonStates.dqgcxs = false; // 电气工程（学硕）
        buttonColors.dqgcxs = teacher.dqgcxs > 0 ? '#90ee90' : '#f0e68c';
        break;
      case '人工智能士兵计划':
        buttonStates.dzxxsoldier = false; // 人工智能/控制工程士兵计划
        buttonColors.dzxxsoldier = teacher.dzxxsoldier > 0 ? '#90ee90' : '#f0e68c';
        break;
      case '控制工程士兵计划':
        buttonStates.dzxxsoldier = false; // 人工智能/控制工程士兵计划
        buttonColors.dzxxsoldier = teacher.dzxxsoldier > 0 ? '#90ee90' : '#f0e68c';
        break;
      case '电气工程士兵计划':
        buttonStates.dqgcsoldier = false; // 电气工程士兵计划
        buttonColors.dqgcsoldier = teacher.dqgcsoldier > 0 ? '#90ee90' : '#f0e68c';  
        break;
      case '控制工程非全日制':
        buttonStates.dzxxpartTime = false; // 人工智能/控制工程非全日制
        buttonColors.dzxxpartTime = teacher.dzxxpartTime > 0 ? '#90ee90' : '#f0e68c';
        break;
      case '人工智能非全日制':
        buttonStates.dzxxpartTime = false; // 人工智能/控制工程非全日制
        buttonColors.dzxxpartTime = teacher.dzxxpartTime > 0 ? '#90ee90' : '#f0e68c';
        break;
      case '电气工程非全日制':
        buttonStates.dqgcpartTime = false; // 电气工程非全日制
        buttonColors.dqgcpartTime = teacher.dqgcpartTime > 0 ? '#90ee90' : '#f0e68c';
        break;
      default:
        console.warn('未知的学生专业');
    }
    }else if(status=="pending"||status=="chosed"){
      wx.showToast({
        title: '您已选择过导师',
      })
    }else{
      wx.showToast({
        title: '未知状态',
      })
    }
    

    this.setData({ buttonStates, buttonColors });
  },

  // 点击选择导师按钮
  selectTeacherByCategory: function (e) {
    const { category } = e.currentTarget.dataset; // 获取学生点击的类别
    console.log("category",category);
    const fieldMapping = {
      '控制科学与工程': 'kongzhiX',//有
      '电气工程学硕': 'dqgcxs',//有
      '电子信息专硕': 'dzxxzs',//有
      // '人工智能专硕': 'dzxxzs',//有
      '电子信息联培': 'dzxxlp',//有
      // '控制工程联培': 'dzxxlp',//有
      '电气工程专硕': 'dqgczs',//有
      '电气工程联培': 'dqgclp',//有
      '电子信息士兵计划': 'dzxxsoldier',
      '电气工程士兵计划': 'dqgcsoldier',
      '电子信息非全日制': 'dzxxpartTime',
      '电气工程非全日制': 'dqgcpartTime'
    };

    const field = fieldMapping[category];
    if (!field) {
      wx.showToast({
        title: '未知的类别',
        icon: 'none'
      });
      return;
    }

    const teacher = this.data.teacher;
    const student = this.data.Stu;

    // 判断按钮颜色并执行相应逻辑
    if (this.data.buttonColors[field] === '#f0e68c') {
      wx.showModal({
        title: '名额已满',
        content: '该导师对应的招生名额已满，请选择其他导师。',
        showCancel: false
      });
    } else if (this.data.buttonColors[field] === '#90ee90') {
      wx.showModal({
        title: '确认选择',
        content: `确定申请导师 ${teacher.name} 的 ${category} 名额吗？`,
        success: (res) => {
          if (res.confirm) {
            this.setData({
              status:'pending'
            })
            this.submitSelection(student, teacher, field,category);
            this.loadTeacherDetails(this.data.teacherID);
          }
        }
      });
    }
  },

  /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {
      wx.stopPullDownRefresh();  // 立即停止下拉刷新
      console.log('禁止下拉刷新');
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
  submitSelection: function (student, teacher, field,category) {
    const _ = db.command;
    console.log('提交选择，学生信息:', student, '导师信息:', teacher);

    // // 判断学生是否已经申请了导师
    // if (student.preselection && student.preselection.length > 0) {
    //   wx.showToast({
    //     title: '您已经申请过导师',
    //     icon: 'none'
    //   });
    //   return;  // 如果已经申请过，直接返回
    // }

    // 更新学生信息，保存学生选择的导师信息
    db.collection('Stu').doc(student._id).update({
      data: {
        preselection: [teacher.name, teacher._id], // 保存导师信息
        status: 'pending', // 状态为待审核
        selectedField: field // 学生选择的专业
      }
    })
    .then(() => {
      wx.showToast({
        title: '申请成功，等待导师审核',
        icon: 'success'
      });
      // //获取缓存数据
      // let data=wx.getStorageSync('user');
      // //如果缓存数据中存在数据
      // if(data){
      //   data.status='pending';//更新status值
      //   wx.setStorageSync('user', data)
      // }else{
      //   console.log('没有找到缓存数据');
      // }

      // 更新导师的学生申请列表
      db.collection('Teacher').doc(teacher._id).update({
        data: {
          prestudent: _.push({
            studentId: student._id,//数据库中一长串的id
            studentName: student.name,
            specialized: category,//学生选择导师的类别
            status: 'pending', // 学生状态为待审核
            phoneNumber:student.phoneNumber,
            description:student.description,
            Id:student.Id,//学生的准考证号
          })
        }
      }).catch(err=>{
        console.error('导师信息更新失败',err);
      });
    }).catch(err=>{
      console.error('学生信息更新失败',err);
    });
  }
});
