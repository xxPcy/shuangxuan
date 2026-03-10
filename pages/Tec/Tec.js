
// 版本2
// pages/Tec/Tec.js
const tabService = require("../utils/tab-service");
const db = wx.cloud.database();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    outitems: [],
    items: [],
    Landmention: '',
    Amd: '',
    Pmd: '',

    pendingChanges: [],
    quotaInfo: [], // 保存各类别名额信息
    quotaCategories: [
      { label: '电子信息（专硕）', key: 'dzxxzs' },
      { label: '控制科学与工程（学硕）', key: 'kongzhiX' },
      { label: '电气工程（专硕）', key: 'dqgczs' },
      { label: '电气工程（学硕）', key: 'dqgcxs' },
      { label: '电子信息（联培）', key: 'dzxxlp' },
      { label: '电气工程（联培）', key: 'dqgclp' },
      {label:'电子信息(士兵计划)',key:'dzxxsoldier'},
      {label:'电子信息(非全日制)',key:'dzxxpartTime'},
      {label:'电气工程(士兵计划)',key:'dqgcsoldier'},
      {label:'电气工程(非全日制)',key:'dqgcpartTime'},
    ],
    announcements: [], // 公告列表
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.GetStorage(); // 确保登录信息加载完成后再执行其他逻辑
    this.loadAnnouncements(); // 页面加载时加载公告
    console.log("进入onload页面")
  },

  GetStorage() {
    wx.getStorage({
      key: 'user',
      success: (res) => {
        console.log('缓存数据:', res);
        this.setData(
          {
            Landmention: res.data
          },
          () => {
            // 确保数据加载完成后再调用方法
            this.loadQuotaInfo();
            this.loadPendingChanges();
            this.loadQuotaInfo();
          }
        );
      },
      fail: (err) => {
        console.error('获取用户数据失败:', err);
        wx.showToast({
          title: '用户数据加载失败',
          icon: 'none'
        });
      }
    });
  },

   // 加载公告
   loadAnnouncements() {
    const db = wx.cloud.database();
  
    db.collection('Announcements')
      .where({
        category: db.command.in(['导师公告', '全体公告']), // 查询导师公告和全体公告
      })
      .orderBy('date', 'desc') // 按日期倒序排列
      .get()
      .then((res) => {
        const announcements = res.data.map((item) => ({
          id: item._id,
          content: item.content,
          category: item.category,
          fullContent: item.content, // 完整公告内容
          date: new Date(item.date).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }), // 格式化为 "YYYY/MM/DD"
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

  loadQuotaInfo() {
    const teacherId = this.data.Landmention._id;

    if (!teacherId) {
      console.error('教师ID为空，无法加载名额信息');
      return;
    }

    db.collection('Teacher')
      .doc(teacherId)
      .get()
      .then((response) => {
        const teacherData = response.data;
        const quotaSettings = teacherData.quota_settings || [];

        // 从 quota_settings 数组生成名额信息，按 code 排序
        const sortedQuotaSettings = [...quotaSettings].sort((a, b) => {
          return (a.code || '').localeCompare(b.code || '');
        });

        const quotaInfo = sortedQuotaSettings.map((quota) => {
          const maxQuota = quota.max_quota || 0;      // 最大名额（已确认）
          const usedQuota = quota.used_quota || 0;    // 已使用名额
          const pendingQuota = quota.pending_quota || 0; // 待审批名额
          const remaining = maxQuota - usedQuota;     // 剩余可用名额

          return {
            label: quota.name,           // 类别名称
            code: quota.code,            // 专业代码
            type: quota.type,            // 级别类型
            total: maxQuota,             // 总名额（max_quota）
            used: usedQuota,             // 已使用名额
            remaining: remaining,        // 剩余名额
            pending: pendingQuota        // 待审批名额
          };
        });

        // 更新数据
        this.setData({
          quotaInfo
        });
      })
      .catch((err) => {
        console.error('加载名额数据失败:', err);
        wx.showToast({
          title: '加载名额数据失败',
          icon: 'none'
        });
      });
  },

  // loadPendingChanges() {
  //   const quotaCategories = this.data.quotaCategories;
  //   const currentTimestamp = new Date().getTime();
  //   const timeoutDuration = 24 * 60 * 60 * 1000; // 24小时

  //   const teacherId = this.data.Landmention._id;

  //   // 校验 _id 是否存在
  //   if (!teacherId) {
  //     console.error('教师ID为空，无法加载审批数据');
  //     wx.showToast({
  //       title: '教师数据加载失败，请重新登录',
  //       icon: 'none'
  //     });
  //     return;
  //   }

  //   db.collection('Teacher')
  //     .doc(teacherId) // 只获取当前导师的数据
  //     .get()
  //     .then((res) => {
  //       const teacherData = res.data;
  //       const pendingChanges = [];
  //       const autoRejectPromises = []; // 用于存储所有超时处理的 Promise

  //       quotaCategories.forEach((category) => {
  //         const pendingValue = teacherData[`pending_${category.key}`] || 0;
  //         const approvalTimestamp = teacherData.approval_timestamp || 0;

  //         // 如果 pending_xxx > 0，则添加到审批列表
  //         if (pendingValue > 0) {
  //           const elapsedTime = currentTimestamp - approvalTimestamp;
  //           const remainingTimeMs = timeoutDuration - elapsedTime;

  //           if (remainingTimeMs > 0) {
  //             const remainingHours = Math.floor(
  //               remainingTimeMs / (60 * 60 * 1000)
  //             ); // 剩余小时
  //             const remainingMinutes = Math.floor(
  //               (remainingTimeMs % (60 * 60 * 1000)) / (60 * 1000)
  //             ); // 剩余分钟

  //             pendingChanges.push({
  //               label: category.label,
  //               key: category.key,
  //               pendingValue,
  //               teacherId: teacherId,
  //               remainingTime: `${remainingHours}小时${remainingMinutes}分钟` // 格式化为小时+分钟
  //             });
  //           } else {
  //             // 如果超时，则执行自动拒绝逻辑
  //             autoRejectPromises.push(
  //               this.autoRejectApproval(teacherId, category.key, pendingValue)
  //             );
  //           }
  //         }
  //       });

  //       // 等待所有超时处理完成
  //       Promise.all(autoRejectPromises)
  //         .then(() => {
  //           console.log('所有超时审批处理完成');
  //           this.setData({ pendingChanges });
  //         })
  //         .catch((err) => {
  //           console.error('超时审批处理失败:', err);
  //         });
  //     })
  //     .catch((err) => {
  //       console.error('加载待审批数据失败:', err);
  //     });
  // },
  loadPendingChanges() {
    const teacherId = this.data.Landmention._id;
    if (!teacherId) {
      console.error('教师ID为空，无法加载审批数据');
      wx.showToast({ title: '教师数据加载失败，请重新登录', icon: 'none' });
      return;
    }
    console.log('将要传递的teacherId:', teacherId);
    wx.cloud.callFunction({
      name: 'getPendingChanges', // 调用新的前端云函数
      data: { teacherId },
      success: res => {
        console.log('云函数返回结果:', res);
        if (res.result.success) {
          const pendingChanges = res.result.pendingChanges || [];
          console.log('当前导师的待审批数据:', pendingChanges);
          this.setData({
            pendingChanges: pendingChanges
          });
          this.loadQuotaInfo();
        } else {
          console.error('加载待审批数据失败', res.result.error);
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('调用云函数失败', err);
        wx.showToast({ title: '调用云函数失败', icon: 'none' });
      }
    });
  },

  // 超时拒绝时自动记录拒绝信息（保持不变）
  autoRejectApproval(teacherId, key, pendingValue) {
    return db
      .collection('Teacher')
      .doc(teacherId)
      .get()
      .then((res) => {
        const teacherData = res.data;
        const assignedTeacherId = teacherData.Id;
        const teacherName = teacherData.name;

        if (teacherData.approval_status === 'rejected') {
          console.warn(
            `教师ID: ${assignedTeacherId}, 专业: ${key} 已被拒绝，跳过重复处理`
          );
          return Promise.resolve();
        }

        return db
          .collection('TotalQuota')
          .doc('totalquota')
          .update({
            data: {
              [`${key}_current`]: db.command.inc(pendingValue)
            }
          })
          .then(() => {
            return db.collection('Teacher').doc(teacherId).update({
              data: {
                [`pending_${key}`]: 0,
                approval_status: 'rejected'
              }
            });
          })
          .then(() => {
            return db.collection('RejectedQuota').add({
              data: {
                teacherName: teacherName,
                teacherId: assignedTeacherId,
                key,
                rejectedValue: pendingValue,
                reason: '超时',
                timestamp: new Date(),
              }
            });
          });
      })
      .then(() => {
        console.log(`超时审批自动拒绝成功，教师ID: ${teacherId}, 专业: ${key}`);
      })
      .catch((err) => {
        console.error(
          `超时审批自动拒绝失败，教师ID: ${teacherId}, 错误:`,
          err
        );
      });
  },


  // handleApproval(e) {
  //   const { type, action } = e.currentTarget.dataset; // 获取专业类别和操作类型
  //   const pendingChange = this.data.pendingChanges.find(
  //     (item) => item.key === type
  //   );
  
  //   if (!pendingChange) {
  //     wx.showToast({
  //       title: '未找到相关数据',
  //       icon: 'none'
  //     });
  //     return;
  //   }
  
  //   const { teacherId, pendingValue } = pendingChange;
  //   const validValue = Number(pendingValue); // 转换为数字
  
  //   // 校验合法性
  //   if (isNaN(validValue) || validValue === 0) {
  //     wx.showToast({
  //       title: '名额值不合法',
  //       icon: 'none'
  //     });
  //     return;
  //   }
  
  //   // 查找对应的 category 对象
  //   const category = this.data.quotaCategories.find(item => item.key === type);
  //   if (!category) {
  //     wx.showToast({
  //       title: '未找到对应的专业信息',
  //       icon: 'none'
  //     });
  //     return;
  //   }
  
  //   // 显示提示框，确认操作不可撤回
  //   wx.showModal({
  //     title: '确认操作',
  //     content: action === 'approve' ? '接受该名额，需要将此名额使用完，请确认选择' : '拒绝后无法撤销操作，请确认选择',
  //     showCancel: true, // 显示取消按钮
  //     confirmText: action === 'approve' ? '同意' : '拒绝', // 确认按钮文本
  //     cancelText: '取消', // 取消按钮文本
  //     success: (res) => {
  //       if (res.confirm) {
  //         // 用户确认操作
  //         if (action === 'approve') {
  //           // 同意操作
  //           db.collection('Teacher')
  //             .doc(teacherId)
  //             .update({
  //               data: {
  //                 [`${type}`]: db.command.inc(validValue), // 更新导师的正式名额
  //                 [`pending_${type}`]: 0 // 清空 pending 名额
  //               }
  //             })
  //             .then(() => {
  //               wx.showToast({
  //                 title: '审批成功',
  //                 icon: 'success'
  //               });
  //               this.loadPendingChanges(); // 刷新待审批数据
  //               this.loadQuotaInfo(); // 刷新名额信息
  //             })
  //             .catch((err) => {
  //               console.error('审批失败:', err);
  //               wx.showToast({
  //                 title: '审批失败，请稍后重试',
  //                 icon: 'none'
  //               });
  //             });
  //         } else if (action === 'reject') {
  //           // 拒绝操作
  //           db.collection('TotalQuota')
  //             .doc('totalquota')
  //             .update({
  //               data: {
  //                 [`${type}_current`]: db.command.inc(validValue) // 退回名额到总配额池
  //               }
  //             })
  //             .then(() => {
  //               return db.collection('Teacher').doc(teacherId).update({
  //                 data: {
  //                   [`pending_${type}`]: 0 // 清空 pending 名额
  //                 }
  //               });
  //             })
  //             .then(() => {
  //               // 获取导师分配的 Id
  //               return db.collection('Teacher').doc(teacherId).get();
  //             })
  //             .then((res) => {
  //               const teacherData = res.data;
  //               const assignedTeacherId = teacherData.Id; // 获取导师分配的 Id
  //               const teacherName = teacherData.name; // 获取导师姓名
  
  //               // 记录拒绝信息到 RejectedQuota 集合，并存储分配的 Id
  //               return db.collection('RejectedQuota').add({
  //                 data: {
  //                   teacherName: teacherName, // 存储导师姓名
  //                   label: category.label, // 退回的专业名称
  //                   teacherId: assignedTeacherId, // 使用导师分配的 Id
  //                   key: type, // 专业类别
  //                   rejectedValue: validValue, // 拒绝的名额
  //                   reason: '主动拒绝', // 拒绝原因
  //                   timestamp: new Date(), // 拒绝时间戳
  //                 }
  //               });
  //             })
  //             .then(() => {
  //               wx.showToast({
  //                 title: '操作成功',
  //                 icon: 'success'
  //               });
  //               this.loadPendingChanges(); // 刷新待审批数据
  //               this.loadQuotaInfo(); // 刷新名额信息
  //             })
  //             .catch((err) => {
  //               console.error('拒绝操作失败:', err);
  //               wx.showToast({
  //                 title: '操作失败，请稍后重试',
  //                 icon: 'none'
  //               });
  //             });
  //         }
  //       } else {
  //         // 用户取消操作
  //         wx.showToast({
  //           title: '操作已取消',
  //           icon: 'none'
  //         });
  //       }
  //     }
  //   });
  // },


//防止两个设备接受名额
  handleApproval(e) {
    const { code, action } = e.currentTarget.dataset;
    const pendingChange = this.data.pendingChanges.find(
      (item) => item.code === code
    );
  
    if (!pendingChange) {
      wx.showToast({ title: '未找到相关数据', icon: 'none' });
      return;
    }
  
    const { teacherId, pendingValue, label } = pendingChange;
    const validValue = Number(pendingValue);
  
    if (isNaN(validValue) || validValue === 0) {
      wx.showToast({ title: '名额值不合法', icon: 'none' });
      return;
    }
  
    wx.showModal({
      title: '确认操作',
      content: action === 'approve' ? '接受该名额，需要将此名额使用完，请确认选择' : '拒绝后无法撤销操作，请确认选择',
      showCancel: true,
      confirmText: action === 'approve' ? '同意' : '拒绝',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            const db = wx.cloud.database();
            const _ = db.command;
  
            // 获取当前教师数据
            const teacherRes = await db.collection('Teacher').doc(teacherId).get();
            const quotaSettings = teacherRes.data.quota_settings || [];
            
            // 找到对应的 quota_settings 项
            const quotaIndex = quotaSettings.findIndex(q => q.code === code);
            if (quotaIndex === -1) {
              wx.showToast({ title: '未找到对应名额配置', icon: 'none' });
              return;
            }

            const currentPending = quotaSettings[quotaIndex].pending_quota || 0;
            if (currentPending === 0) {
              wx.showToast({ title: '名额已被处理，请刷新', icon: 'none' });
              return;
            }
  
            if (action === 'approve') {
              // 确认名额：将 pending_quota 加到 max_quota，清空 pending_quota
              const newQuotaSettings = [...quotaSettings];
              newQuotaSettings[quotaIndex] = {
                ...newQuotaSettings[quotaIndex],
                max_quota: (newQuotaSettings[quotaIndex].max_quota || 0) + validValue,
                pending_quota: 0
              };

              await db.collection('Teacher').doc(teacherId).update({
                data: {
                  quota_settings: newQuotaSettings
                }
              });
              
              wx.showToast({ title: '审批成功', icon: 'success' });
            } else if (action === 'reject') {
              // 拒绝操作：清空 pending_quota，退回到 TotalQuota
              const quotaType = quotaSettings[quotaIndex].type; // level1, level2, level3
              
              // 清空 pending_quota
              const newQuotaSettings = [...quotaSettings];
              newQuotaSettings[quotaIndex] = {
                ...newQuotaSettings[quotaIndex],
                pending_quota: 0
              };

              await db.collection('Teacher').doc(teacherId).update({
                data: {
                  quota_settings: newQuotaSettings
                }
              });

              // 退回名额到 TotalQuota 的 pending_approval
              const quotaFieldMap = {
                'level1': 'level1_quota',
                'level2': 'level2_quota', 
                'level3': 'level3_quota'
              };
              const quotaField = quotaFieldMap[quotaType];

              if (quotaField) {
                const totalQuotaRes = await db.collection('TotalQuota').doc('totalquota').get();
                const levelQuota = totalQuotaRes.data[quotaField] || {};
                const codeQuota = levelQuota[code] || {};
                
                await db.collection('TotalQuota').doc('totalquota').update({
                  data: {
                    [`${quotaField}.${code}.pending_approval`]: (codeQuota.pending_approval || 0) + validValue
                  }
                });
              }

              // 记录拒绝信息
              const teacherData = teacherRes.data;
              await db.collection('RejectedQuota').add({
                data: {
                  teacherName: teacherData.name,
                  teacherId: teacherData.Id,
                  code: code,
                  label: label,
                  rejectedValue: validValue,
                  reason: '主动拒绝',
                  timestamp: new Date(),
                }
              });
              
              wx.showToast({ title: '操作成功', icon: 'success' });
            }
  
            this.loadPendingChanges();
            this.loadQuotaInfo();
          } catch (err) {
            console.error('操作失败:', err);
            wx.showToast({ title: '操作失败，请稍后重试', icon: 'none' });
          }
        } else {
          wx.showToast({ title: '操作已取消', icon: 'none' });
        }
      }
    });
  },
  



  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 更新底部高亮
    tabService.updateIndex(this, 0);
    this.GetStorage(); // 确保登录信息加载完成后再执行其他逻辑
    this.loadAnnouncements(); // 页面加载时加载公告
    console.log("进入页面")
    // 启动定时器，每分钟刷新一次
    this.remainingTimeInterval = setInterval(() => {
      this.loadPendingChanges();
    }, 60000);

  },
  /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {
      this.GetStorage(); // 确保登录信息加载完成后再执行其他逻辑
      this.loadAnnouncements(); // 下拉时加载公告
      wx.stopPullDownRefresh();  // 立即停止下拉刷新
      console.log("待审批名额",this.data.pendingChanges)
      console.log("下拉刷新操作1")
    },
  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    // 页面隐藏时清除定时器
    clearInterval(this.remainingTimeInterval);
  }
});
