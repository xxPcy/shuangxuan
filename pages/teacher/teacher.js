const tabService = require("../utils/tab-service");
const db = wx.cloud.database();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    Landmention: '', // 学生信息
    _id: '', // 学生ID
    preselection: [], // 保存申请的导师信息数组
    specialized: '', // 专业类别
    status: '',
    selected: '',
    rejectionMessages: [], // 拒绝消息列表
    showModal: false, // 控制模态框显示
    selectedMessage: {} // 当前选中的消息详情
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const data = wx.getStorageSync('user'); // 获取学生信息
    this.setData({
      Landmention: data,
      _id: data._id
    });

    // 获取学生详细信息
    db.collection('Stu')
      .doc(data._id)
      .get()
      .then(res => {
        const { preselection, selectedField, status, selected, reason, specialized } = res.data; // 获取学生信息
        console.log("selected", selected);
        console.log("specialized", specialized);
        this.setData({
          preselection: preselection || [], // 设置导师信息
          specialized: specialized || '', // 直接使用数据库中的 specialized 字段
          status: status,
          selected: selected,
          rejectionMessages: reason ? this.formatMessages(reason) : [] // 格式化拒绝消息
        });
      })
      .catch(error => {
        console.error("获取学生信息失败：", error);
      });
  },

  /**
   * 格式化拒绝消息
   */
  formatMessages(messages) {
    return messages.map(message => {
      return {
        ...message,
        timestamp: new Date(message.timestamp).toLocaleString() // 转换为本地日期时间格式
      };
    });
  },

  /**
   * 取消选择操作
   */
  cancel() {
    const _ = db.command;
    const _id = this.data._id;
    console.log("_id:",_id)
    const stu_ID = this.data.Landmention.ID; // 学生ID
    console.log("stu_ID:",stu_ID);
    const Tec_id = this.data.preselection[1]; // 获取导师ID
    wx.showModal({
      title: '确定取消',
      content: '确定取消该导师申请吗',
      complete: (res) => {
        if (res.confirm) {
          db.collection('Stu')
      .doc(_id)
      .update({
        data: {
          status: "chosing",
          preselection: [] // 清空已申请的导师信息
        }
      })
      .then(() => {
        db.collection('Teacher')
          .doc(Tec_id)
          .update({
            data: {
              prestudent: _.pull({ studentId: _id }) // 从导师的申请列表中移除学生
            }
          })
          .then(() => {
            this.updatedata(); // 更新页面数据
          })
          .catch(error => {
            console.error("更新导师信息失败：", error);
          });
      })
      .catch(error => {
        console.error("更新学生信息失败：", error);
      });
        }
      }
    })
  },

  /**
   * 更新页面数据
   */
  updatedata() {
    const data = wx.getStorageSync('user');

    this.setData({
      Landmention: data,
      _id: data._id
    });

    db.collection('Stu')
      .doc(data._id)
      .get()
      .then(res => {
        const { preselection, status, reason, selected, specialized } = res.data;
        console.log("updatedata - specialized", specialized);
        this.setData({
          preselection: preselection || [],
          specialized: specialized || '',
          status: status,
          selected: selected,
          rejectionMessages: reason ? this.formatMessages(reason) : []
        });
      })
      .catch(error => {
        console.error("更新数据失败：", error);
      });
  },

  /**
   * 点击消息展示详情
   */
  showMessageDetails(e) {
    const index = e.currentTarget.dataset.index;
    const message = this.data.rejectionMessages[index];
    this.setData({
      selectedMessage: message,
      showModal: true
    });
  },

  /**
   * 关闭模态框
   */
  closeModal() {
    this.setData({
      showModal: false,
      selectedMessage: {}
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    console.log("触发onshow页面")
    this.updatedata();
    tabService.updateIndex(this, 1); // 更新底部高亮状态

  },

  /**
   * 页面下拉刷新
   */
  onPullDownRefresh() {
    const data = wx.getStorageSync('user');

    this.setData({
      Landmention: data,
      _id: data._id
    });

    db.collection('Stu')
      .doc(data._id)
      .get()
      .then(res => {
        const { preselection, status, reason, selected, specialized } = res.data;
        console.log("onPullDownRefresh - specialized", specialized);
        this.setData({
          preselection: preselection || [],
          specialized: specialized || '',
          status: status,
          selected: selected,
          rejectionMessages: reason ? this.formatMessages(reason) : []
        });
      })
      .catch(error => {
        console.error("更新数据失败：", error);
      });
    wx.stopPullDownRefresh(); // 停止刷新动画
  },

  /**
   * 判断是否已申请导师
   */
  hasApplied() {
    return this.data.preselection.length > 0; // 根据 preselection 数组长度判断
  }
});
