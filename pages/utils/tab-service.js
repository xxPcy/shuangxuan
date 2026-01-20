// tabBar的data
let tabData = {
  tabIndex: 0, // 底部按钮高亮下标
  tabBar: {
    custom: true,
    color: "#5F5F5F",
    selectedColor: "#07c160",
    backgroundColor: "#F7F7F7",
    list: [],
  },
};

// 更新菜单
const updateRole = (that, type) => {
  // 这里设置权限（分3种权限，权限1显示1，2，3；权限2显示4，5；权限三显示6，7；）
  if (type === "0") {
    tabData.tabBar.list = [
      {
        text: "导师信息",
        pagePath: "pages/information/information",
        iconPath: "/image/people-bottom-card.png",
        selectedIconPath: "/image/people-bottom-card.png",
      },
      {
        text: "申请",
        pagePath: "pages/teacher/teacher",
        iconPath: "/image/cooperative-handshake.png",
        selectedIconPath: "/image/cooperative-handshake.png",
      },
      {
        text: "个人",
        pagePath: "pages/user/user",
        iconPath: "/image/user.png",
        selectedIconPath: "/image/user.png",
      },
    ];
  } else if (type === "1") {
    tabData.tabBar.list = [
      {
        pagePath: "pages/Tec/Tec",
        iconPath: "/image/cooperative-handshake.png",
        selectedIconPath: "/image/cooperative-handshake.png",
        text: "名额信息",
      },

      {
        pagePath: "pages/Review_s/review",
        iconPath: "/image/studentshenqing.png",
        selectedIconPath: "/image/studentshenqing.png",
        text: "学生申请",
    },

      {
        pagePath: "pages/QuotaInformation/QuotaInformation",
        iconPath: "/image/doc-detail.png",
        selectedIconPath: "/image/doc-detail.png",
        text: "信息编辑",
      },
    ];
  } else if (type === "2") {
    tabData.tabBar.list = [
      {
        pagePath: "pages/admin/admin",
        iconPath: "/image/afferent-three.png",
        selectedIconPath: "/image/afferent-three.png",
        text: "管理页面",
      },
    ];
  }
  updateTab(that);
};

// 更新底部高亮
const updateIndex = (that, index) => {
  tabData.tabIndex = index;
  updateTab(that); // 修复错误，直接调用 updateTab
};

// 更新Tab状态
const updateTab = (that) => {
  if (typeof that.getTabBar === "function" && that.getTabBar()) {
    that.getTabBar().setData(tabData);
  }
};

// 将可调用的方法抛出让外面调用
module.exports = {
  updateRole,
  updateTab,
  updateIndex,
  tabBar: tabData.tabBar.list,
};
