

const db = wx.cloud.database();
const tabService = require("../utils/tab-service");

Page({
  data: {
    categories: ['学生公告', '导师公告', '全体公告'], // 公告类别列表
    category: '全体公告', // 默认选择全体公告
    announcements: [], // 公告列表
    announcementContent: '', // 发布公告的内容
    currentAnnouncement: null, // 当前正在编辑的公告
    isEditing: false, // 控制模态框的显示
    students: [], // 学生数据
    teachers: [], // 导师数据
    studentQuery: '', // 学生搜索条件
    teacherQuery: '', // 导师搜索条件
    showErrorPopupFlag: false, // 控制错误信息弹窗的显示
    errorMessage: '', // 存储错误信息
    filteredStudents: [], // 筛选后的学生数据
    filteredTeachers: [], // 筛选后的导师数据
    searchedStudent: null, // 存储搜索到的学生
    searchedTeacher: null, // 存储搜索到的导师
    studentListVisible: true, // 控制学生列表的显示/隐藏
    teacherListVisible: true, // 控制导师列表的显示/隐藏
    showUnbindDialog: false,  // 控制解绑弹框的显示
    showPopupFlag: false,  // 控制弹窗显示与否
    searchedshow:false,//教师信息的显示,
    modify:false,//修改名额显示
    acceptstate:false,//用于保存修改指标的按钮状态（初始状态为可选）
    unbind:false,//用于解绑导师按钮的状态设置（初始状态为可选）
    availableQuotas: [], // 存放有 pending_quota 的专业列表
    editableQuotas: [], // 存放可编辑的名额列表（用于编辑弹窗）
    quotaTreeList: [], // 存放处理后的折叠树数据
    // 招生名额类别定义
    quotaCategories: [
      { label: '电子信息（专硕）', key: 'dzxxzs' },
      { label: '控制科学与工程（学硕）', key: 'kongzhiX' },
      { label: '电气工程（专硕）', key: 'dqgczs' },
      { label: '电气工程（学硕）', key: 'dqgcxs' },
      { label: '电子信息（联培）', key: 'dzxxlp' },
      { label: '电气工程（联培）', key: 'dqgclp' },
      { label: '电气工程（非全）', key: 'dqgcpartTime' },
      { label: '电气工程（士兵）', key: 'dqgcsoldier' },
      { label: '电子信息（非全）', key: 'dzxxpartTime' },
      { label: '电子信息（士兵）', key: 'dzxxsoldier' }

    ],
    quotaList: [], // 招生名额列表
    quotaChanges: {} // 保存调整的变更值
  },

  onLoad() {
    this.loadStudents();
    this.loadTeachers();
    this.loadAnnouncements(); // 加载公告
    this.loadQuotaData();// 加载可分配的名额总表
    this.loadQuotaData(); // 加载表格数据
  },

  // 公告类别选择事件
onCategoryChange(e) {
  this.setData({
    category: this.data.categories[e.detail.value], // 更新选中的公告类别
  });
},

// 加载招生名额总表
loadQuotaData() {
  const db = wx.cloud.database();

  db.collection('TotalQuota').doc('totalquota')
    .get()
    .then(res => {
      const quotaList = this.data.quotaCategories.map(category => ({
        label: category.label,
        key: category.key,
        current: res.data[`${category.key}_current`] || 0,
        total: res.data[`${category.key}_total`] || 0
      }));
      this.setData({ quotaList });
    })
    .catch(err => {
      console.error('加载名额总表失败:', err);
      wx.showToast({
        title: '加载失败，请检查数据库或权限',
        icon: 'none'
      });
    });
},

// 手动输入调整值
onQuotaInputChange(e) {
  const { type } = e.currentTarget.dataset;
  const value = Number(e.detail.value);

  if (isNaN(value)) {
    wx.showToast({
      title: '请输入有效数字',
      icon: 'none'
    });
    return;
  }

  this.setData({
    quotaChanges: {
      ...this.data.quotaChanges,
      [type]: value
    }
  });
},

// 保存修改到数据库
saveQuotaChanges() {
  const db = wx.cloud.database();
  const updateData = {};

  // 构造更新数据
  Object.keys(this.data.quotaChanges).forEach(type => {
    const change = this.data.quotaChanges[type];
    if (change !== 0) {  // 仅有变动才进行更新
      updateData[`${type}_current`] = db.command.inc(change); // 更新当前名额
      if (change > 0) {
        updateData[`${type}_total`] = db.command.inc(change); // 增加时更新历史总量
      } else {
        updateData[`${type}_total`] = db.command.inc(change); // 减少时同时减少历史总量
      }
    }
  });

  if (Object.keys(updateData).length === 0) {
    wx.showToast({
      title: '没有修改的内容',
      icon: 'none'
    });
    return;
  }

  // 校验逻辑：防止当前名额或历史总量变成负数
  db.collection('TotalQuota')
    .doc('totalquota')
    .get()
    .then(res => {
      const totalQuotaData = res.data;
      const invalidChanges = [];

      // 检查修改是否导致字段变成负数
      Object.keys(this.data.quotaChanges).forEach(type => {
        const currentChange = this.data.quotaChanges[type];
        const newCurrent = (totalQuotaData[`${type}_current`] || 0) + currentChange;
        const newTotal = (totalQuotaData[`${type}_total`] || 0) + currentChange;

        // 校验当前名额是否足够
        if (newCurrent < 0) {
          invalidChanges.push(`${type} 当前名额不足`);
        }

        // 校验历史总量是否足够
        if (newTotal < 0) {
          invalidChanges.push(`${type} 历史总量不足`);
        }
      });

      if (invalidChanges.length > 0) {
        throw new Error(`以下字段修改后会导致值变为负数：${invalidChanges.join(', ')}`);
      }

      // 如果没有违规，更新数据库
      return db.collection('TotalQuota').doc('totalquota').update({
        data: updateData
      });
    })
    .then(() => {
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      // 清空 quotaChanges 并刷新视图
      this.setData({ quotaChanges: {} }, () => {
        this.loadQuotaData(); // 重新加载数据
      });
    })
    .catch(err => {
      console.error('保存失败:', err);
      wx.showToast({
        title: err.message || '保存失败，请重试',
        icon: 'none'
      });
    });
},

// // 动态调整名额（+1 或 -1）
// adjustQuota(e) {
//   const { type, action } = e.currentTarget.dataset;
//   const quotaList = [...this.data.quotaList];
//   const index = quotaList.findIndex(item => item.key === type);

//   if (index !== -1) {
//     if (action === 'add') {
//       quotaList[index].value++; // 增加名额
//     } else if (action === 'subtract') {
//       if (quotaList[index].value > 0) {
//         quotaList[index].value--; // 减少名额
//       } else {
//         wx.showToast({
//           title: '名额不足，无法减少',
//           icon: 'none'
//         });
//         return;
//       }
//     }
//     this.setData({
//       [`quotaList[${index}]`]: quotaList[index] // 仅更新被修改的项
//     });
//   }
// },






  // 加载学生信息
  loadStudents() {
    db.collection('Stu').get().then(res => {
      this.setData({
        students: res.data
      });
    }).catch(err => {
      console.error('Failed to load students', err);
    });
  },

  // 加载导师信息
  // 加载所有导师数据
loadTeachers(page = 1, allTeachers = []) {
  const pageSize = 20; // 每次加载 20 条
  db.collection('Teacher')
    .skip((page - 1) * pageSize) // 跳过已经加载的数据
    .limit(pageSize)
    .get()
    .then(res => {
      const newTeachers = res.data;
      const updatedTeachers = allTeachers.concat(newTeachers); // 合并数据

      // 如果获取的数据不足 pageSize 说明数据加载完成，否则继续加载
      if (newTeachers.length === pageSize) {
        this.loadTeachers(page + 1, updatedTeachers); // 递归加载下一页
      } else {
        // 全部数据加载完成
        this.setData({
          teachers: updatedTeachers
        });
        console.log('所有导师数据:', updatedTeachers);
      }
    })
    .catch(err => {
      console.error('Failed to load teachers', err);
    });
},


  // 搜索学生方法
  // searchStudent() {
  //   const query = this.data.studentQuery ? this.data.studentQuery.toLowerCase().trim() : ''; // 确保查询条件是字符串
  //   const foundStudent = this.data.students.find(student => {
  //     // 确保 student.name 和 student.ID 都是字符串，如果是 undefined 或 null，设置为空字符串
  //     const studentName = student.name ? student.name.toLowerCase().trim() : '';
  //     const studentID = student.ID ? student.ID.toLowerCase().trim() : '';

  //     return studentName === query || studentID === query;
  //   });

  //   this.setData({
  //     searchedStudent: foundStudent || null
  //   });

  //   if (!foundStudent) {
  //     wx.showToast({
  //       title: '没有找到该学生',
  //       icon: 'none'
  //     });
  //   }
  // },

// // 搜索（姓名或ID）
// searchStudent() {
//   const query = this.data.studentQuery ? this.data.studentQuery.toLowerCase().trim() : ''; // 确保查询条件是字符串
//   if (!query) {
//     // 如果查询框为空，直接清空搜索结果
//     this.setData({
//       searchedStudent: null,
//     });
//     return;
//   }

//   // 查找匹配的学生（姓名或ID）
//   const foundStudent = this.data.students.find(student => {
//     // 确保 student.name 和 student.Id 都是字符串，如果是 undefined 或 null，设置为空字符串
//     const studentName = student.name ? student.name.toLowerCase().trim() : '';
//     const studentID = student.Id ? student.Id.toLowerCase().trim() : '';  // 使用 Id 字段

//     return studentName === query || studentID === query;
//   });

//   this.setData({
//     searchedStudent: foundStudent || null,
//     showUnbindDialog: true, // 显示解绑弹框
    
//   });

//   if (!foundStudent) {
//     wx.showToast({
//       title: '没有找到该学生',
//       icon: 'none'
//     });
//   }
// },



// // 关闭弹框
// closeDialog() {
//   this.setData({
//     showUnbindDialog: false, // 关闭弹框
//   });
// },

// // 解绑学生和导师关系
// unbindStudent() {
//   const { searchedStudent } = this.data;
//   if (!searchedStudent) return;

//   const teacherId = searchedStudent.selectedTecId;  // 学生选择的导师ID（如果是ID）

//   // 查找导师的ID（确保导师的ID是唯一的）
//   const teacher = this.data.teachers.find(t => t.Id === teacherId); // 使用导师的ID来查找
//   if (!teacher) {
//     wx.showToast({
//       title: '找不到该导师',
//       icon: 'none'
//     });
//     return;
//   }

//   // 调用云函数解除绑定关系
//   wx.cloud.callFunction({
//     name: 'unbindStudentTeacher',
//     data: {
//       studentId: searchedStudent.Id,  // 学生的ID
//       teacherId: teacherId  // 学生选择的导师ID
//     },
//     success: (res) => {
//       if (res.result.success) {
//         wx.showToast({
//           title: '解绑成功',
//           icon: 'success'
//         });
//         this.setData({
//           searchedStudent: null, // 清空搜索结果
//           studentQuery: '',  // 清空搜索框
//           showUnbindDialog: false  // 隐藏弹框
//         });
//       } else {
//         wx.showToast({
//           title: '解绑失败',
//           icon: 'none'
//         });
//       }
//     },
//     fail: (err) => {
//       wx.showToast({
//         title: '解绑失败',
//         icon: 'none'
//       });
//       console.error('云函数调用失败', err);
//     }
//   });
// },




// 搜索（姓名或ID）
searchStudent() {
  const query = this.data.studentQuery ? this.data.studentQuery.toLowerCase().trim() : ''; // 确保查询条件为字符串
  if (!query) {
    this.setData({
      searchedStudent: null,
    });
    return;
  }

  const db = wx.cloud.database();
  // 直接对整个 'Stu' 集合进行查询，保证能找到所有符合条件的记录
  db.collection('Stu')
    .where({
      $or: [
        { name: query }, // 假设数据库中存储的名字已全部小写或需要转为小写后比较
        { Id: query }    // 使用 Id 字段进行匹配
      ]
    })
    .get()
    .then(res => {
      if (res.data && res.data.length > 0) {
        // 这里选择第一个匹配结果，也可以根据需要显示多个结果
        this.setData({
          searchedStudent: res.data[0],
          showUnbindDialog: true,  // 显示解绑弹框
          showResetPasswordDialog: false,  // 隐藏重置密码弹框
        });
      } else {
        this.setData({
          searchedStudent: null,
        });
        wx.showToast({
          title: '没有找到该学生',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('搜索失败：', err);
      wx.showToast({
        title: '搜索失败',
        icon: 'none'
      });
    });
},

// 关闭弹框
closeDialog() {
  this.setData({
    showUnbindDialog: false, // 关闭解绑弹框
    showResetPasswordDialog: false, // 关闭重置密码弹框
  });
},
//关闭重置密码弹框
closeSturesertPasswprd:function(){
  this.setData({
      showResetPasswordDialog: false, // 关闭重置密码弹框
  })
},
// 解绑学生和导师关系
unbindStudent() {
  const { searchedStudent } = this.data;
  if (!searchedStudent) return;
  console.log(searchedStudent)
  this.setData({unbind:true})//点击解绑导师之后就让按钮变为禁用状态
  const teacherId = searchedStudent.selectedTecId;  // 学生选择的导师ID
  console.log(this.data.teachers)
  // 查找导师的ID
  const teacher = this.data.teachers.find(t => t.Id === teacherId);
  if (!teacher) {
    wx.showToast({
      title: '找不到该导师',
      icon: 'none'
    });
    this.setData({
      unbind:false,//恢复为可选状态
    })
    return;
  }
  wx.showModal({
    title: '是否解绑该学生？',
    content: '',
    complete: (res) => {
      if (res.cancel) {
        this.setData({
          unbind:false,//如果点击取消，解绑按钮又恢复为可选状态
        })
      }
  
      if (res.confirm) {
            // 调用云函数解除绑定关系
      wx.cloud.callFunction({
        name: 'unbindStudentTeacher',
        data: {
          studentId: searchedStudent.Id,  // 学生的ID
          teacherId: teacherId  // 学生选择的导师ID
        },
        success: (res) => {
          if (res.result.success) {
            wx.showToast({
              title: '解绑成功',
              icon: 'success'
            });
            this.setData({
              searchedStudent: null, // 清空搜索结果
              studentQuery: '',  // 清空搜索框
              showUnbindDialog: false , // 隐藏弹框
              unbind:false,//恢复为可选状态
            });
          } else {
            wx.showToast({
              title: '解绑失败',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          wx.showToast({
            title: '解绑失败',
            icon: 'none'
          });
          console.error('云函数调用失败', err);
        }
      });
      }
    }
  })
  
},

// 点击重置密码按钮
resetPassword() {
  this.setData({
    showResetPasswordDialog: true, // 显示重置密码弹框
  });
},

// 输入新密码并提交
submitNewPassword() {
  const { searchedStudent, newPassword } = this.data;
  if (!newPassword) {
    wx.showToast({
      title: '请输入新密码',
      icon: 'none'
    });
    return;
  }
wx.showModal({
  title: '是否重置密码',
  content: '',
  complete: (res) => {
    if (res.cancel) {
      
    }

    if (res.confirm) {
      // 调用数据库直接更新密码
  const db = wx.cloud.database();
  db.collection('Stu').where({
    Id: searchedStudent.Id  // 根据学生ID查找
  }).update({
    data: {
      Password: newPassword  // 更新密码
    },
    success: (res) => {
      if (res.stats.updated === 1) {
        wx.showToast({
          title: '密码重置成功',
          icon: 'success'
        });
        this.setData({
          showResetPasswordDialog: false, // 隐藏重置密码弹框
          newPassword: ''  // 清空新密码输入框
        });
      } else {
        wx.showToast({
          title: '不可于上一次的密码相同',
          icon: 'none'
        });
      }
    },
    fail: (err) => {
      wx.showToast({
        title: '密码重置失败',
        icon: 'none'
      });
      console.error('数据库操作失败', err);
    }
  });
    }
  }
})
  
},

// 处理输入的新密码
handlePasswordInput(e) {
  this.setData({
    newPassword: e.detail.value  // 获取输入的密码
  });
},





// 处理输入框的输入事件
onStudentSearchInput(e) {
  this.setData({
    studentQuery: e.detail.value
  });
},




  // 搜索导师方法
searchTeacher() {
  const query = this.data.teacherQuery ? this.data.teacherQuery.toLowerCase() : ''; // 确保查询条件是字符串
  if (!query) {
    this.setData({
      searchedTeacher: null,
    });
    return;
  }

  const db = wx.cloud.database();
  // 直接查询云数据库，确保能找到所有符合条件的导师
  db.collection('Teacher')
    .where({
      $or: [
        { name: query }, // 匹配导师姓名
        { Id: query }    // 匹配导师ID
      ]
    })
    .get()
    .then(res => {
      if (res.data && res.data.length > 0) {
        const teacher = res.data[0];
        
        // 从 quota_settings 中获取所有专业，显示：已确认未使用 + 待审批
        let availableQuotas = [];
        if (teacher.quota_settings && Array.isArray(teacher.quota_settings)) {
          availableQuotas = teacher.quota_settings
            .filter(item => ['level1', 'level2', 'level3'].includes(item.type))
            .map(item => {
              const maxQuota = Number(item.max_quota || 0);
              const usedQuota = Number(item.used_quota || 0);
              const pendingQuota = Number(item.pending_quota || 0);
              const confirmedRemaining = Math.max(maxQuota - usedQuota, 0);
              return {
                code: item.code,
                name: item.name,
                type: item.type,
                confirmed_remaining: confirmedRemaining,
                pending_quota: pendingQuota,
                total_available: confirmedRemaining + pendingQuota,
              };
            });
          
          // 按专业代码排序：先按代码长度（一级2位、二级4位、三级6位），再按代码字母顺序
          availableQuotas.sort((a, b) => {
            // 先按代码长度排序（短的在前，即一级->二级->三级）
            const aCode = String(a.code || '');
            const bCode = String(b.code || '');
            if (aCode.length !== bCode.length) {
              return aCode.length - bCode.length;
            }
            // 同级别按代码字母顺序排序
            return aCode.localeCompare(bCode);
          });
        }
        
        this.setData({
          searchedTeacher: teacher,
          availableQuotas: availableQuotas,  // 排序后的专业列表
          searchedshow: true,  // 显示导师的信息
        });
      } else {
        this.setData({
          searchedTeacher: null,
          availableQuotas: [],
        });
        wx.showToast({
          title: '没有找到该导师',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('搜索失败：', err);
      wx.showToast({
        title: '搜索失败',
        icon: 'none'
      });
    });
},

/// 弹出修改导师信息窗口
showTeacherEditPopup(event) {
  // 直接使用搜索返回的导师数据
  const teacher = this.data.searchedTeacher;
  console.log("searchedTeacher", teacher);
  if (teacher) {
    // 先获取 TotalQuota 中的被退回指标数据
    const db = wx.cloud.database();
    db.collection('TotalQuota').doc('totalquota').get()
      .then(totalQuotaRes => {
        const totalQuotaData = totalQuotaRes.data || {};
        
        // 构建被退回指标的 Map（专业代码 -> 被退回数量）
        const rejectedQuotaMap = {};
        
        // 处理一级专业
        if (totalQuotaData.level1_quota) {
          Object.values(totalQuotaData.level1_quota).forEach(item => {
            rejectedQuotaMap[item.code] = item.pending_approval || 0;
          });
        }
        // 处理二级专业
        if (totalQuotaData.level2_quota) {
          Object.values(totalQuotaData.level2_quota).forEach(item => {
            rejectedQuotaMap[item.code] = item.pending_approval || 0;
          });
        }
        // 处理三级专业
        if (totalQuotaData.level3_quota) {
          Object.values(totalQuotaData.level3_quota).forEach(item => {
            rejectedQuotaMap[item.code] = item.pending_approval || 0;
          });
        }
        
        // 从 quota_settings 构建可编辑的名额列表
        let editableQuotas = [];
        if (teacher.quota_settings && Array.isArray(teacher.quota_settings)) {
          editableQuotas = teacher.quota_settings.map(item => ({
            code: item.code,
            name: item.name,
            pending_quota: item.pending_quota || 0,  // 已导入指标（未确认）
            max_quota: item.max_quota || 0,
            used_quota: item.used_quota || 0,  // 已确认指标
            confirmed_remaining: Math.max((item.max_quota || 0) - (item.used_quota || 0), 0), // 已确认未使用
            rejected_quota: rejectedQuotaMap[item.code] || 0,  // 被退回指标（来自TotalQuota）
            pendingChange: 0,  // 暂存的变更值（加的数量）
            subtractFromPending: 0,  // 从pending_quota减的数量
            subtractFromConfirmed: 0  // 从已确认未使用减的数量（通过减少max_quota实现）
          }));
          
          // 按专业代码排序：先按代码长度（一级->二级->三级），再按代码字母顺序
          editableQuotas.sort((a, b) => {
            if (a.code.length !== b.code.length) {
              return a.code.length - b.code.length;
            }
            return a.code.localeCompare(b.code);
          });
        }
        
        this.setData({
          selectedTeacher: teacher,
          editableQuotas: editableQuotas,
          modify: true,
          acceptstate: false,  // 进入页面之后，就让按钮变为可用
        });
      })
      .catch(err => {
        console.error('获取TotalQuota失败:', err);
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        });
      });
  } else {
    console.error('未找到对应导师信息');
    wx.showToast({
      title: '未找到对应导师信息',
      icon: 'none'
    });
  }
},
  //关闭导师信息窗口
  closeTeachermention:function(){
    this.setData({
      searchedshow:false,
      showTeacherPasswordDialog:false,//关闭导师重置密码窗口
      modify:false,//关闭导师名额信息窗口
    })
  },
  //关闭导师名额信息修改窗口
  closeTeachermodify:function(){
    this.setData({
      modify:false,//关闭导师的信息
    })
  },

  //关闭修改名额窗口
  closeTeacherEditPopup:function(){
      this.setData({
        showTeacherPasswordDialog:false
      })
  },

  // 点击重置密码按钮
  resetTeacherPassword() {
    this.setData({
      showTeacherPasswordDialog: true, // 显示重置密码弹框
    });
  },

  // 输入新密码并提交
  submitNewTeacherPassword() {
    const { searchedTeacher, newTeacherPassword } = this.data;
    if (!newTeacherPassword) {
      wx.showToast({
        title: '请输入新密码',
        icon: 'none'
      });
      return;
    }
    wx.showModal({
      title: '是否重置密码',
      content: '',
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          // 调用数据库直接更新导师密码
    const db = wx.cloud.database();
    db.collection('Teacher').where({
      Id: searchedTeacher.Id  // 根据导师ID查找
    }).update({
      data: {
        Password: newTeacherPassword  // 更新密码
      },
      success: (res) => {
        if (res.stats.updated === 1) {
          wx.showToast({
            title: '密码重置成功',
            icon: 'success'
          });
          this.setData({
            showTeacherPasswordDialog: false, // 隐藏重置密码弹框
            newTeacherPassword: ''  // 清空新密码输入框
          });
        } else {
          wx.showToast({
            title: '不可与上一次的密码相同',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '密码重置失败',
          icon: 'none'
        });
        console.error('数据库操作失败', err);
      }
    });
        }
      }
    })
    
  },

// 处理输入的新密码
handleTeacherPasswordInput(e) {
  this.setData({
    newTeacherPassword: e.detail.value  // 获取输入的密码
  });
},

// 修改暂存字段的值（基于 quota_settings）
// 加一：从被退回指标中分配；减一：从已导入指标中扣除
modifyQuota(e) {
  const { code, action } = e.currentTarget.dataset; // 获取专业代码和动作
  const editableQuotas = [...this.data.editableQuotas];
  
  // 找到对应的专业
  const index = editableQuotas.findIndex(item => item.code === code);
  if (index === -1) return;
  
  const quota = editableQuotas[index];
  
  if (action === 'add') {
    // 增加：从被退回指标中分配
    // 检查被退回指标是否足够（rejected_quota - 已经分配的变更）
    const availableRejected = (quota.rejected_quota || 0) - (quota.pendingChange > 0 ? quota.pendingChange : 0);
    if (availableRejected > 0) {
      quota.pendingChange = (quota.pendingChange || 0) + 1;
    } else {
      wx.showToast({
        title: `${quota.name}没有多余被退回指标`,
        icon: 'none'
      });
      return;
    }
  } else if (action === 'subtract') {
    // 减少指标逻辑：
    // 1. 先从 pending_quota（未确认指标）中减
    // 2. 如果 pending_quota 不够，再从已确认未使用名额中减
    
    // 计算当前可减的数量
    const currentPendingAvailable = (quota.pending_quota || 0) - (quota.subtractFromPending || 0);
    const currentConfirmedAvailable = (quota.confirmed_remaining || 0) - (quota.subtractFromConfirmed || 0);
    
    if (currentPendingAvailable > 0) {
      // 优先从pending_quota减
      quota.subtractFromPending = (quota.subtractFromPending || 0) + 1;
    } else if (currentConfirmedAvailable > 0) {
      // pending_quota不够，从已确认未使用减
      quota.subtractFromConfirmed = (quota.subtractFromConfirmed || 0) + 1;
    } else {
      wx.showToast({
        title: `${quota.name}没有可减的指标`,
        icon: 'none'
      });
      return;
    }
  }

  // 更新页面数据
  this.setData({
    editableQuotas: editableQuotas
  });
},










// 保存变更到数据库并更新名额（基于 quota_settings）
// 加一：从被退回指标(pending_approval)分配到导师的pending_quota
// 减一：先从pending_quota减，不够再从used_quota减，返还到TotalQuota的pending_approval
saveTeacherChanges() {
  const updatedTeacher = this.data.selectedTeacher;
  const editableQuotas = this.data.editableQuotas;

  // 筛选有变更的项目（加指标或减指标）
  const changedQuotas = editableQuotas.filter(item => 
    (item.pendingChange && item.pendingChange > 0) || 
    (item.subtractFromPending && item.subtractFromPending > 0) ||
    (item.subtractFromConfirmed && item.subtractFromConfirmed > 0)
  );
  
  if (changedQuotas.length === 0) {
    wx.showToast({
      title: '没有需要保存的变更',
      icon: 'none'
    });
    return;
  }
  
  this.setData({
    acceptstate: true,  // 一点击保存就设置为禁用状态
  });

  const db = wx.cloud.database();
  const currentTimestamp = new Date().getTime();
  
  // 分离增加和减少的变更
  const addChanges = changedQuotas.filter(item => item.pendingChange > 0);
  const subtractChanges = changedQuotas.filter(item => 
    (item.subtractFromPending > 0) || (item.subtractFromConfirmed > 0)
  );
  
  // 格式化变更内容用于显示
  let formatContent = '';
  if (addChanges.length > 0) {
    formatContent += '从被退回指标新增：\n' + addChanges.map(item => 
      `${item.name}（${item.code}）：+${item.pendingChange}`
    ).join('\n');
  }
  if (subtractChanges.length > 0) {
    if (formatContent) formatContent += '\n\n';
    formatContent += '减少指标：\n' + subtractChanges.map(item => {
      let detail = `${item.name}（${item.code}）：`;
      const parts = [];
      if (item.subtractFromPending > 0) {
        parts.push(`从未确认减${item.subtractFromPending}`);
      }
      if (item.subtractFromConfirmed > 0) {
        parts.push(`从已确认未使用减${item.subtractFromConfirmed}`);
      }
      return detail + parts.join('，');
    }).join('\n');
  }
  
  wx.showModal({
    title: '是否保存',
    content: formatContent,
    complete: (res) => {
      if (res.cancel) {
        this.setData({
          acceptstate: false,  // 点击取消恢复可选状态
        });
        return;
      }

      if (res.confirm) {
        // 获取当前导师的最新数据
        db.collection('Teacher').doc(updatedTeacher._id).get()
          .then(teacherRes => {
            const currentTeacher = teacherRes.data;
            const currentQuotaSettings = currentTeacher.quota_settings || [];
            
            // 更新 quota_settings 中对应专业的 pending_quota 和 max_quota
            const updatedQuotaSettings = currentQuotaSettings.map(setting => {
              const change = changedQuotas.find(c => c.code === setting.code);
              if (change) {
                let newPendingQuota = setting.pending_quota || 0;
                let newMaxQuota = setting.max_quota || 0;
                
                // 加一：增加 pending_quota
                if (change.pendingChange > 0) {
                  newPendingQuota += change.pendingChange;
                }
                
                // 减一：先从 pending_quota 减，再从已确认未使用(max_quota - used_quota)减
                if (change.subtractFromPending > 0) {
                  newPendingQuota -= change.subtractFromPending;
                }
                if (change.subtractFromConfirmed > 0) {
                  newMaxQuota -= change.subtractFromConfirmed;
                }
                
                return {
                  ...setting,
                  pending_quota: newPendingQuota,
                  max_quota: newMaxQuota
                };
              }
              return setting;
            });
            
            // 更新导师数据
            return db.collection('Teacher').doc(updatedTeacher._id).update({
              data: {
                quota_settings: updatedQuotaSettings,
                approval_status: 'pending',
                approval_timestamp: currentTimestamp
              }
            });
          })
          .then(() => {
            // 同时更新 TotalQuota 集合
            return db.collection('TotalQuota').doc('totalquota').get();
          })
          .then(totalQuotaRes => {
            const totalQuotaData = totalQuotaRes.data;
            const updateData = {};
            
            // 根据代码长度判断是哪个级别
            changedQuotas.forEach(change => {
              const code = change.code;
              let levelKey;
              if (code.length <= 2) {
                levelKey = 'level1_quota';
              } else if (code.length <= 4) {
                levelKey = 'level2_quota';
              } else {
                levelKey = 'level3_quota';
              }
              
              // 构建更新路径
              const currentLevel = totalQuotaData[levelKey] || {};
              if (currentLevel[code]) {
                if (!updateData[levelKey]) {
                  updateData[levelKey] = { ...currentLevel };
                }
                
                let pendingApprovalChange = 0;
                
                // 加一：从被退回指标(pending_approval)分配，减少pending_approval
                if (change.pendingChange > 0) {
                  pendingApprovalChange -= change.pendingChange;
                }
                
                // 减一：返还到被退回指标(pending_approval)，增加pending_approval
                if (change.subtractFromPending > 0) {
                  pendingApprovalChange += change.subtractFromPending;
                }
                if (change.subtractFromConfirmed > 0) {
                  pendingApprovalChange += change.subtractFromConfirmed;
                }
                
                updateData[levelKey][code] = {
                  ...currentLevel[code],
                  pending_approval: (currentLevel[code].pending_approval || 0) + pendingApprovalChange
                };
              }
            });
            
            if (Object.keys(updateData).length > 0) {
              updateData.last_updated = currentTimestamp;
              return db.collection('TotalQuota').doc('totalquota').update({
                data: updateData
              });
            }
            return Promise.resolve();
          })
          .then(() => {
            wx.showToast({
              title: '保存成功',
              icon: 'success'
            });
            this.setData({
              selectedTeacher: null,
              modify: false,
              editableQuotas: [],
              searchedshow: false  // 关闭导师信息显示
            });
            this.loadTeachers();  // 刷新导师数据
            this.loadQuotaData();  // 刷新招生名额总表
            
            // 重新搜索导师以更新前端显示的数据
            if (this.data.teacherQuery) {
              this.searchTeacher();
            }
          })
          .catch(err => {
            console.error('保存失败:', err);
            this.setData({
              acceptstate: false
            });
            wx.showToast({
              title: '保存失败，请重试',
              icon: 'none'
            });
          });
      }
    }
  });
},

  // 处理学生搜索输入
  onStudentSearchInput(e) {
    this.setData({
      studentQuery: e.detail.value
    });
  },

  // 处理导师搜索输入
  onTeacherSearchInput(e) {
    this.setData({
      teacherQuery: e.detail.value
    });
  },



  // // 发布公告
  // publishAnnouncement(event) {
  //   const content = event.detail.value.content; // 获取公告内容
  //   const category = event.detail.value.category; // 获取公告类别

  //   db.collection('Announcements').add({
  //     data: {
  //       content: content,
  //       category: category,
  //       date: new Date()
  //     }
  //   }).then(res => {
  //     wx.showToast({
  //       title: '公告发布成功',
  //       icon: 'success'
  //     });
  //     this.setData({
  //       announcementContent: ''
  //     });
  //     this.loadAnnouncements(); // 刷新公告列表
  //   }).catch(err => {
  //     console.error('公告发布失败', err);
  //   });
  // },

  // // 加载公告
  // loadAnnouncements() {
  //   db.collection('Announcements').get().then(res => {
  //     const announcements = res.data.map(item => ({
  //       id: item._id,
  //       content: item.content.substring(0, 20) + '...', // 只显示前20个字符
  //       category: item.category,
  //       fullContent: item.content, // 保存完整的公告内容
  //       date: item.date
  //     }));

  //     this.setData({
  //       announcements: announcements
  //     });
  //   }).catch(err => {
  //     console.error('加载公告失败', err);
  //   });
  // },

  // // 点击公告打开编辑窗口
  // editAnnouncement(event) {
  //   const announcementId = event.currentTarget.dataset.id;
  //   const announcement = this.data.announcements.find(item => item.id === announcementId);

  //   this.setData({
  //     currentAnnouncement: announcement, // 设置当前公告信息
  //     isEditing: true, // 显示编辑窗口
  //   });
  // },

  // // 保存公告修改
  // saveAnnouncement(event) {
  //   const content = event.detail.value.content;
  //   const { currentAnnouncement } = this.data;

  //   db.collection('Announcements').doc(currentAnnouncement.id).update({
  //     data: {
  //       content: content,
  //       date: new Date() // 更新日期
  //     }
  //   }).then(res => {
  //     wx.showToast({
  //       title: '修改成功',
  //       icon: 'success'
  //     });
  //     this.setData({
  //       isEditing: false,
  //       currentAnnouncement: null
  //     });
  //     this.loadAnnouncements(); // 刷新公告列表
  //   }).catch(err => {
  //     console.error('修改公告失败', err);
  //   });
  // },

  // // 删除公告
  // deleteAnnouncement() {
  //   const { currentAnnouncement } = this.data;

  //   db.collection('Announcements').doc(currentAnnouncement.id).remove().then(res => {
  //     wx.showToast({
  //       title: '删除成功',
  //       icon: 'success'
  //     });
  //     this.setData({
  //       isEditing: false,
  //       currentAnnouncement: null
  //     });
  //     this.loadAnnouncements(); // 重新加载公告列表
  //   }).catch(err => {
  //     console.error('删除公告失败', err);
  //   });
  // },

  // // 关闭编辑窗口
  // closeModal() {
  //   this.setData({
  //     isEditing: false,
  //     currentAnnouncement: null,
  //   });
  // },



// 发布公告
publishAnnouncement(event) {
  const content = event.detail.value.content; // 获取公告内容
  const category = this.data.category; // 获取公告类别

  if (!content) {
    wx.showToast({
      title: '请输入公告内容',
      icon: 'none',
    });
    return;
  }

  db.collection('Announcements').add({
    data: {
      content: content,
      category: category,
      date: new Date(), // 保存公告发布时间
    },
  })
    .then((res) => {
      wx.showToast({
        title: '公告发布成功',
        icon: 'success',
      });
      this.setData({
        announcementContent: '', // 清空输入框
      });
      this.loadAnnouncements(); // 刷新公告列表
    })
    .catch((err) => {
      console.error('公告发布失败', err);
    });
},

// 加载公告列表
loadAnnouncements() {
  db.collection('Announcements')
    .orderBy('date', 'desc') // 按时间倒序排列
    .get()
    .then((res) => {
      const announcements = res.data.map((item) => ({
        id: item._id,
        content: item.content.substring(0, 20) + '...', // 只显示前20个字符
        category: item.category,
        fullContent: item.content, // 完整公告内容
        date: new Date(item.date).toLocaleString(), // 格式化时间
      }));

      this.setData({
        announcements: announcements,
      });
    })
    .catch((err) => {
      console.error('加载公告失败', err);
    });
},

// 点击公告打开编辑窗口
editAnnouncement(event) {
  const announcementId = event.currentTarget.dataset.id;
  const announcement = this.data.announcements.find((item) => item.id === announcementId);

  this.setData({
    currentAnnouncement: { ...announcement }, // 设置当前公告信息
    isEditing: true, // 显示编辑窗口
  });
},

// 保存公告修改
saveAnnouncement(event) {
  const content = event.detail.value.content;
  const category = this.data.currentAnnouncement.category; // 当前选择的类别
  const { currentAnnouncement } = this.data;

  if (!content) {
    wx.showToast({
      title: '公告内容不能为空',
      icon: 'none',
    });
    return;
  }

  db.collection('Announcements')
    .doc(currentAnnouncement.id)
    .update({
      data: {
        content: content,
        category: category,
        date: new Date(), // 更新修改时间
      },
    })
    .then((res) => {
      wx.showToast({
        title: '修改成功',
        icon: 'success',
      });
      this.setData({
        isEditing: false,
        currentAnnouncement: null,
      });
      this.loadAnnouncements(); // 刷新公告列表
    })
    .catch((err) => {
      console.error('修改公告失败', err);
    });
},

// 删除公告
deleteAnnouncement() {
  const { currentAnnouncement } = this.data;
  console.log("currentAnnouncement",currentAnnouncement);
  db.collection('Announcements')
    .doc(currentAnnouncement.id)
    .remove()
    .then((res) => {
      wx.showToast({
        title: '删除成功',
        icon: 'success',
      });
      this.setData({
        isEditing: false,
        currentAnnouncement: null,
      });
      this.loadAnnouncements(); // 重新加载公告列表
    })
    .catch((err) => {
      console.error('删除公告失败', err);
    });
},

// 编辑时更改公告类别
onEditCategoryChange(e) {
  this.setData({
    'currentAnnouncement.category': this.data.categories[e.detail.value], // 更新类别
  });
},

// 关闭编辑窗口
closeModal() {
  this.setData({
    isEditing: false,
    currentAnnouncement: null,
  });
},





//   // 上传 Excel 文件并更新导师的招生名额
// chooseTeacherzhaoshengExcel() {
//   wx.chooseMessageFile({
//     count: 1,
//     type: 'file',
//     extension: ['xlsx', 'xls'],
//     success: res => {
//       const filePath = res.tempFiles[0].path;
//       wx.cloud.uploadFile({
//         cloudPath: 'uploads/excel/' + Date.now() + '-' + Math.random() + '.xlsx',
//         filePath: filePath,
//         success: uploadRes => {
//           wx.cloud.callFunction({
//             name: 'parseExcel', // 调用云函数解析 Excel 并更新数据库
//             data: {
//               fileId: uploadRes.fileID
//             },
//             success: () => {
//               wx.showToast({
//                 title: '更新成功',
//                 icon: 'success'
//               });
//             },
//             fail: err => {
//               console.error('更新失败', err);
//               wx.showToast({
//                 title: '更新失败，请重试',
//                 icon: 'none'
//               });
//             }
//           });
//         },
//         fail: uploadErr => {
//           console.error('文件上传失败', uploadErr);
//           wx.showToast({
//             title: '文件上传失败',
//             icon: 'none'
//           });
//         }
//       });
//     },
//     fail: fileErr => {
//       console.error('文件选择失败', fileErr);
//       wx.showToast({
//         title: '文件选择失败',
//         icon: 'none'
//       });
//     }
//   });
// },


// 上传 Excel 文件并更新导师的招生名额
chooseTeacherzhaoshengExcel() {
  wx.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['xlsx', 'xls'],
    success: res => {
      const filePath = res.tempFiles[0].path;
      wx.cloud.uploadFile({
        cloudPath: 'uploads/excel/' + Date.now() + '-' + Math.random() + '.xlsx',
        filePath: filePath,
        success: uploadRes => {
          wx.cloud.callFunction({
            name: 'parseExcel', // 调用云函数解析 Excel 并更新数据库
            data: {
              fileId: uploadRes.fileID
            },
            success: res => {
              console.log('云函数返回数据:', res);
              const result = res.result;
              if (result.success === true) {
                wx.showToast({
                  title: '更新成功',
                  icon: 'success'
                });
                this.loadQuotaData();
              } else {
                // 拼接错误信息，result.error 为错误描述，result.details 为详细错误数组
                const errorMsg = result.error || '上传失败，存在错误';
                let errorDetails = '';
                if (result.details && Array.isArray(result.details)) {
                  errorDetails = result.details.map(item => {
                    // 如果返回的详情中没有导师姓名，则使用'未知'
                    return `导师ID: ${item.teacherId}\n导师姓名: ${item.name || '未知'}\n错误: ${item.error}\n分配指标: ${JSON.stringify(item.rows)}`;
                  }).join('\n\n');
                }
                let allErrorInfo = errorMsg + "\n\n" + errorDetails;
                // 调试输出完整错误信息
                console.log("即将显示弹窗, 错误信息:", allErrorInfo);
                // 如果内容过长，可以暂时截断测试
                if (allErrorInfo.length > 500) {
                  allErrorInfo = allErrorInfo.substring(0, 500) + '...';
                }
                wx.showModal({
                  title: '上传失败',
                  content: allErrorInfo,
                  showCancel: true,
                  cancelText: '取消',
                  confirmText: '复制信息',
                  success: modalRes => {
                    if (modalRes.confirm) {
                      wx.setClipboardData({
                        data: allErrorInfo,
                        success: () => {
                          wx.showToast({
                            title: '错误信息已复制',
                            icon: 'success'
                          });
                        }
                      });
                    }
                  },
                  fail: err => {
                    console.error("wx.showModal 调用失败:", err);
                  }
                });
              }
            },
            fail: err => {
              console.error('云函数调用失败', err);
              wx.showToast({
                title: '更新失败，请重试',
                icon: 'none'
              });
            }
          });
        },
        fail: uploadErr => {
          console.error('文件上传失败', uploadErr);
          wx.showToast({
            title: '文件上传失败',
            icon: 'none'
          });
        }
      });
    },
    fail: fileErr => {
      console.error('文件选择失败', fileErr);
      wx.showToast({
        title: '文件选择失败',
        icon: 'none'
      });
    }
  });
},


  // 导出 Excel 文件
 // 导出 Excel 文件导出双选名单
exportExcel() {
  wx.cloud.callFunction({
    name: 'exportExcel',
    success: res => {
      const fileID = res.result.fileID;
      if (fileID) {
        wx.cloud.downloadFile({
          fileID: fileID,
          success: downloadRes => {
            wx.openDocument({
              filePath: downloadRes.tempFilePath,
              showMenu: true,
              success: () => {
                console.log('文件打开成功');
              },
              fail: err => {
                console.error('文件打开失败', err);
              },
            });
          },
          fail: err => {
            console.error('文件下载失败', err);
          },
        });
      } else {
        wx.showToast({
          title: '导出失败，请重试',
          icon: 'none',
        });
      }
    },
    fail: err => {
      console.error('云函数调用失败', err);
      wx.showToast({
        title: '导出失败，请重试',
        icon: 'none',
      });
    },
  });
},

detailmention:function(){
  wx.cloud.callFunction({
    name: 'exportTeachermention', // 云函数名
    success: res => {
      const fileID = res.result.fileID;
      wx.cloud.downloadFile({
        fileID: fileID,
        success: downloadRes => {
          wx.openDocument({
            filePath: downloadRes.tempFilePath,
            showMenu: true,
            success: () => {
              console.log('文件打开成功');
            },
          });
        },
        fail: err => {
          console.error('文件下载失败', err);
          wx.showToast({
            title: '文件下载失败',
            icon: 'none',
          });
        },
      });
    },
    fail: err => {
      console.error('导出失败', err);
      wx.showToast({
        title: '导出失败，请重试',
        icon: 'none',
      });
    },
  });
},

exportTeacherQuota() {
  wx.cloud.callFunction({
    name: 'exportTeacherQuota', // 云函数名
    success: res => {
      const fileID = res.result.fileID;
      wx.cloud.downloadFile({
        fileID: fileID,
        success: downloadRes => {
          wx.openDocument({
            filePath: downloadRes.tempFilePath,
            showMenu: true,
            success: () => {
              console.log('文件打开成功');
            },
          });
        },
        fail: err => {
          console.error('文件下载失败', err);
          wx.showToast({
            title: '文件下载失败',
            icon: 'none',
          });
        },
      });
    },
    fail: err => {
      console.error('导出失败', err);
      wx.showToast({
        title: '导出失败，请重试',
        icon: 'none',
      });
    },
  });
},

// 导出指标新增表模板
outPutexample() {
  wx.showLoading({
    title: '正在生成模板...',
  });
  
  wx.cloud.callFunction({
    name: 'exportQuotaTemplate',
    success: res => {
      wx.hideLoading();
      if (res.result.success) {
        const fileID = res.result.fileID;
        wx.cloud.downloadFile({
          fileID: fileID,
          success: downloadRes => {
            wx.openDocument({
              filePath: downloadRes.tempFilePath,
              showMenu: true,
              success: () => {
                console.log('指标模板文件打开成功');
              },
              fail: err => {
                console.error('文件打开失败', err);
                wx.showToast({
                  title: '文件打开失败',
                  icon: 'none',
                });
              }
            });
          },
          fail: err => {
            console.error('文件下载失败', err);
            wx.showToast({
              title: '文件下载失败',
              icon: 'none',
            });
          },
        });
      } else {
        wx.showToast({
          title: res.result.error || '导出失败',
          icon: 'none',
        });
      }
    },
    fail: err => {
      wx.hideLoading();
      console.error('导出指标模板失败', err);
      wx.showToast({
        title: '导出失败，请重试',
        icon: 'none',
      });
    },
  });
},


 

  // chooseStudentExcel() {
  //   wx.chooseMessageFile({
  //     count: 1,
  //     type: 'file',
  //     extension: ['xlsx', 'xls'],
  //     success: res => {
  //       const filePath = res.tempFiles[0].path;
        
  //       // 上传文件到云存储
  //       wx.cloud.uploadFile({
  //         cloudPath: 'uploads/students_info_' + Date.now() + '.xlsx',
  //         filePath: filePath,
  //         success: uploadRes => {
  //           // 调用云函数解析 Excel 文件并导入数据
  //           wx.cloud.callFunction({
  //             name: 'importStudents',
  //             data: { fileId: uploadRes.fileID },
  //             success: () => {
  //               wx.showToast({
  //                 title: '学生信息导入成功',
  //                 icon: 'success'
  //               });
  //             },
  //             fail: err => {
  //               console.error('导入失败', err);
  //               wx.showToast({
  //                 title: '导入失败，请重试',
  //                 icon: 'none'
  //               });
  //             }
  //           });
  //         }
  //       });
  //     }
  //   });
  // },


  chooseStudentExcel() {
    wx.showLoading({
      title: '正在创建学生...',
    });
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls'],
      success: res => {
        const filePath = res.tempFiles[0].path;
  
        // 上传文件到云存储
        wx.cloud.uploadFile({
          cloudPath: 'uploads/students_info_' + Date.now() + '.xlsx',
          filePath: filePath,
          success: uploadRes => {
            // 上传成功后，获取上传文件的 fileID
            const fileID = uploadRes.fileID;
  
            // 调用云函数解析 Excel 文件并导入数据
            wx.cloud.callFunction({
              name: 'importStudents',
              data: { fileId: fileID },
              success: res => {
                wx.hideLoading();
                // 如果导入过程中有已存在的学生信息
                if (res.result.existingStudents && res.result.existingStudents.length > 0) {
                  // 构建一个字符串，显示已存在学生的名字和Id
                  const existingStudentsStr = res.result.existingStudents
                    .map(student => `姓名: ${student.name} 学号: ${student.Id}`)
                    .join('\n'); // 每个学生信息用换行符分隔
  
                  wx.showModal({
                    title: '已存在学生',
                    content: existingStudentsStr,
                    showCancel: false,
                    confirmText: '复制信息',
                    success: function (response) {
                      if (response.confirm) {
                        // 用户点击了确认按钮，将信息复制到剪贴板
                        wx.setClipboardData({
                          data: existingStudentsStr,
                          success: () => {
                            wx.showToast({
                              title: '已复制学生信息',
                              icon: 'success',
                            });
                          }
                        });
                      }
                    }
                  });
                } else {
                  wx.hideLoading();
                  // 如果没有重复的学生信息，显示导入成功
                  wx.showToast({
                    title: '学生信息导入成功',
                    icon: 'success'
                  });
                }
              },
              fail: err => {
                wx.hideLoading();
                console.error('导入失败', err);
                wx.showToast({
                  title: '导入失败，请重试',
                  icon: 'none'
                });
              }
            });
          },
          fail: err => {
            console.error('文件上传失败', err);
            wx.showToast({
              title: '文件上传失败，请重试',
              icon: 'none'
            });
          }
        });
      }
    });
  },



  // chooseTeacherExcel() {
  //   wx.chooseMessageFile({
  //     count: 1,
  //     type: 'file',
  //     extension: ['xlsx', 'xls'],
  //     success: res => {
  //       const filePath = res.tempFiles[0].path;
        
  //       // 上传文件到云存储
  //       wx.cloud.uploadFile({
  //         cloudPath: 'uploads/students_info_' + Date.now() + '.xlsx',
  //         filePath: filePath,
  //         success: uploadRes => {
  //           // 调用云函数解析 Excel 文件并导入数据
  //           wx.cloud.callFunction({
  //             name: 'importTeacher',
  //             data: { fileId: uploadRes.fileID },
  //             success: () => {
  //               wx.showToast({
  //                 title: '导师信息导入成功',
  //                 icon: 'success'
  //               });
  //             },
  //             fail: err => {
  //               console.error('导入失败', err);
  //               wx.showToast({
  //                 title: '导入失败，请重试',
  //                 icon: 'none'
  //               });
  //             }
  //           });
  //         }
  //       });
  //     }
  //   });
  // },




  chooseTeacherExcel() {
    wx.showLoading({
      title: '正在创建导师...',
    })
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls'],
      success: res => {
        const filePath = res.tempFiles[0].path;
        
        // 上传文件到云存储
        wx.cloud.uploadFile({
          cloudPath: 'uploads/teachers_info_' + Date.now() + '.xlsx',
          filePath: filePath,
          success: uploadRes => {
            // 调用云函数解析 Excel 文件并导入数据
            wx.cloud.callFunction({
              name: 'importTeacher',
              data: { fileId: uploadRes.fileID },
              success: res => {
                wx.hideLoading();
                if (res.result.existingTeachers && res.result.existingTeachers.length > 0) {
                  // 构建一个字符串，显示已存在导师的名字和Id
                  const existingTeachersStr = res.result.existingTeachers
                    .map(teacher => `姓名: ${teacher.name} 导师ID: ${teacher.Id}`)  // 确保格式正确，使用换行符
                    .join('\n'); // 每个导师信息用空行分隔
  
                  wx.showModal({
                    title: '已存在导师',
                    content: existingTeachersStr,
                    showCancel: false,
                    confirmText: '复制信息',
                    success: function (response) {
                      if (response.confirm) {
                        // 用户点击了确认按钮，可以继续处理
                        wx.setClipboardData({
                          data: existingTeachersStr, // 将导师信息设置到剪贴板
                          success: () => {
                            wx.showToast({
                              title: '已复制导师信息',
                              icon: 'success',
                            });
                          }
                        });
                      }
                    }
                  });
                } else {
                  wx.hideLoading();
                  wx.showToast({
                    title: '导师信息导入成功',
                    icon: 'success'
                  });
                }
              },
              fail: err => {
                wx.hideLoading();
                console.error('导入失败', err);
                wx.showToast({
                  title: '导入失败，请重试',
                  icon: 'none'
                });
              }
            });
          }
        });
      }
    });
  },
  
  
// 1. 从 TotalQuota 集合和教师汇总获取数据
loadQuotaData() {
  wx.showLoading({ title: '统计数据中...' });
  const db = wx.cloud.database();
  
  // 只从 TotalQuota 获取数据
  db.collection('TotalQuota').doc('totalquota').get()
    .then(res => {
      wx.hideLoading();
      const totalQuotaData = res.data || {};
    
    // 将 level1_quota, level2_quota, level3_quota 转换为列表格式
    const list = [];
    
    // 处理一级专业
    if (totalQuotaData.level1_quota) {
      Object.values(totalQuotaData.level1_quota).forEach(item => {
        list.push({
          code: item.code,
          name: item.name,
          type: 'level1',
          max_total: item.quota || 0,              // 总指标（来自 TotalQuota.quota）
          pending_total: item.pending_approval || 0  // 待发指标（来自 TotalQuota.pending_approval）
        });
      });
    }
    
    // 处理二级专业
    if (totalQuotaData.level2_quota) {
      Object.values(totalQuotaData.level2_quota).forEach(item => {
        list.push({
          code: item.code,
          name: item.name,
          type: 'level2',
          max_total: item.quota || 0,
          pending_total: item.pending_approval || 0
        });
      });
    }
    
    // 处理三级专业
    if (totalQuotaData.level3_quota) {
      Object.values(totalQuotaData.level3_quota).forEach(item => {
        list.push({
          code: item.code,
          name: item.name,
          type: 'level3',
          max_total: item.quota || 0,
          pending_total: item.pending_approval || 0
        });
      });
    }
    
    // 拿到数据后，进行前端处理（计算层级、父子关系）
    const processed = this.processTreeData(list);
    this.setData({ quotaTreeList: processed });
  }).catch(err => {
    wx.hideLoading();
    console.error('加载数据失败:', err);
    wx.showToast({ title: '获取失败', icon: 'none' });
  });
},

// 2. 前端处理：添加折叠控制字段
processTreeData(list) {
  // 确保按代码排序
  list.sort((a, b) => a.code.localeCompare(b.code));

  return list.map((item, index) => {
    // 计算层级 (简单判断：type 或者 code长度)
    let level = 1;
    if (item.type === 'level2') level = 2;
    if (item.type === 'level3') level = 3;

    // 判断是否有子节点
    // 逻辑：如果列表中下一个元素的 code 是以当前 code 开头的，那它就是我的孩子
    let hasChildren = false;
    if (index < list.length - 1) {
      const nextItem = list[index + 1];
      // 比如 0854 startsWith 08
      if (nextItem.code.startsWith(item.code)) {
        hasChildren = true;
      }
    }

    return {
      ...item,
      level: level,
      expanded: true, // 默认全部展开，方便查看
      show: true,     // 默认显示
      hasChildren: hasChildren
    };
  });
},

// 3. 点击折叠/展开
toggleRow(e) {
  const idx = e.currentTarget.dataset.index;
  const list = this.data.quotaTreeList;
  const item = list[idx];

  if (!item.hasChildren) return; // 没有子节点不用折叠

  // 切换状态
  item.expanded = !item.expanded;
  
  // 递归控制子元素的显示/隐藏
  for (let i = idx + 1; i < list.length; i++) {
    const child = list[i];
    
    // 如果不再以当前 code 开头，说明已经出了这个层级，停止循环
    if (!child.code.startsWith(item.code)) {
      break;
    }

    // 核心逻辑：
    // 如果是收起：所有子孙都隐藏
    if (!item.expanded) {
      child.show = false;
    } 
    // 如果是展开：只展开直接下一级？或者恢复之前的状态？
    // 简单做法：如果是直接下级，就显示。
    else {
       // 这里为了简单，我们采用“级联展开”：
       // 只要父级展开了，我们判断它是否应该显示（取决于它自己的父级是否展开）
       // 简易版：直接把所有子孙设为显示，或者只显示下一层。
       
       // 推荐逻辑：只控制直接下一层，或者全开。
       // 这里使用：只要是它的子孙，且该子孙的父级是展开的，就显示。
       // 但为了代码简单，我们重置：点击父级展开时，默认展开直接子级
       if (child.level === item.level + 1) {
         child.show = true;
         child.expanded = false; // 子级默认收起
       }
    }
  }

  this.setData({ quotaTreeList: list });
},




// 前端调用云函数清空系统
clearSystem() {
  wx.showModal({
    title: '是否清空',
    content: '',
    complete: (res) => {
      if (res.confirm) {
        wx.cloud.callFunction({
    name: 'clearSystem',
    success: res => {
      if (res.result.success) {
        wx.showToast({
          title: res.result.message,
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res.result.message,
          icon: 'none'
        });
      }
    },
    fail: err => {
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
      console.error('云函数调用失败', err);
    }
  });
      }
    }
  })
  
},


// 点击按钮显示弹窗
showPopup() {
  this.setData({
    showPopupFlag: true,  // 显示弹窗
  });
},

// 关闭弹窗
closePopup() {
  this.setData({
    showPopupFlag: false,  // 隐藏弹窗
  });
},

// 导出退回记录
exportRejectedRecords() {
  wx.cloud.callFunction({
    name: 'generateRejectedNomineeExcel',  // 云函数名称
    data: {},
    success: res => {
      const fileID = res.result.fileID;
      wx.cloud.downloadFile({
        fileID: fileID,
        success: function (downloadRes) {
          const filePath = downloadRes.tempFilePath;
          // 使用 wx.openDocument 打开 Excel 文件
          wx.openDocument({
            filePath: filePath,
            success: function () {
              wx.showToast({
                title: '文件已打开',
                icon: 'success',
              });
            },
            fail: function (error) {
              console.error('打开文件失败', error);
              wx.showToast({
                title: '打开失败',
                icon: 'none',
              });
            }
          });
        },
        fail: function () {
          wx.showToast({
            title: '下载失败',
            icon: 'none',
          });
        }
      });
    },
    fail: err => {
      wx.showToast({
        title: '调用失败',
        icon: 'none',
      });
    }
  });

  // 关闭弹窗
  this.closePopup();
},

// 清空退回记录
clearRejectedRecords() {
  const db = wx.cloud.database();
  const _ = db.command;
  wx.showModal({
    title: '是否清空退回记录',
    content: '',
    complete: (res) => {
      if (res.cancel) {
        
      }
  
      if (res.confirm) {
         // 删除所有记录，添加查询条件确保合法性
  db.collection('RejectedQuota').where({
    _id: _.exists(true)
  }).remove()
    .then(res => {
      wx.showToast({
        title: '退回记录已清空',
        icon: 'success',
      });
    })
    .catch(err => {
      console.error('删除失败', err);
      wx.showToast({
        title: `操作失败: ${err.errMsg}`,
        icon: 'none',
      });
    });

  // 关闭弹窗
  this.closePopup();
      }
    }
  })
 
},

logic() {
  wx.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['xlsx', 'xls'],
    success: res => {
      const filePath = res.tempFiles[0].path;
      
      wx.showLoading({
        title: '正在导入...',
        mask: true // 防止触摸穿透
      });

      // 1. 上传文件到云存储
      // 建议：文件名加个时间戳防止覆盖，虽然你的代码里已经加了 random，很稳
      const cloudPath = 'uploads/logic/' + Date.now() + '-' + Math.floor(Math.random() * 1000) + '.xlsx';
      
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: uploadRes => {
          
          // 2. 调用云函数解析并导入数据
          wx.cloud.callFunction({
            name: 'importLogic', // 确保你的云函数名字叫这个
            data: {
              fileId: uploadRes.fileID
            },
            success: res => {
              wx.hideLoading();
              console.log('云函数返回:', res);
              
              const { success, message, error, errors } = res.result;

              // 3. 处理返回结果
              if (success) {
                // 成功：展示后端返回的详细信息（例如：成功 100 条，失败 0 条）
                wx.showToast({
                  title: '导入成功', // 或者直接用 message 但字数可能超
                  icon: 'success',
                  duration: 2000
                });
                
                // 【重要】如果你的页面上有展示专业列表，这里需要调用刷新方法
                // 例如：this.loadMajorData(); 
                
                // 如果有部分失败（但整体标记为成功），可以弹窗告知
                if (errors && errors.length > 0) {
                   wx.showModal({
                     title: '导入完成但有部分错误',
                     content: `部分行导入失败，请查看控制台或后端日志。\n${message}`,
                     showCancel: false
                   });
                }

              } else {
                // 失败
                wx.showModal({
                  title: '导入失败',
                  content: error || message || '请检查Excel格式',
                  showCancel: false
                });
              }
            },
            fail: err => {
              wx.hideLoading();
              console.error('云函数调用失败:', err);
              wx.showModal({
                title: '系统错误',
                content: '云函数调用失败，请检查网络或云环境配置',
                showCancel: false
              });
            }
          });
        },
        fail: err => {
          wx.hideLoading();
          console.error('文件上传失败:', err);
          wx.showToast({
            title: '文件上传失败',
            icon: 'none'
          });
        }
      });
    },
    fail: err => {
      // 用户取消选择，通常不需要报错，但也打印一下日志
      console.log('用户取消选择文件', err);
    }
  });
},


  onShow() {
    // 更新底部导航栏高亮状态
    tabService.updateIndex(this, 2);

  },



  // 下拉刷新事件
onPullDownRefresh() {
  // 重新加载数据
  this.loadStudents();
  this.loadTeachers();
  this.loadAnnouncements();
  this.loadQuotaData();

  // 停止下拉刷新动画
  wx.stopPullDownRefresh();
},


});

