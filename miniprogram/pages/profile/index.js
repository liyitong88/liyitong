const store = require("../../utils/storage");
const { exportXlsx } = require("../../utils/export");
const { syncPull, syncPush } = require("../../utils/sync");

Page({
  data: {
    session: null,
    username: "",
    password: "",
    role: "user",
    adminMode: false,
    stats: {
      total: 0,
      active: 0,
      done: 0,
    },
    syncConfig: {
      endpoint: "",
      token: "",
    },
    syncState: "",
  },
  onShow() {
    const session = getApp().syncSession();
    if (!session) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    const state = store.loadState();
    this.setData({
      session,
      adminMode: session.role === "admin",
      syncConfig: store.loadSyncConfig(),
      stats: {
        total: state.tasks.length,
        active: state.tasks.filter((task) => task.status !== "已完成" && task.status !== "已取消").length,
        done: state.tasks.filter((task) => task.status === "已完成").length,
      },
    });
  },
  onPullDownRefresh() {
    this.onShow();
    wx.stopPullDownRefresh();
  },
  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: e.detail.value });
  },
  onRoleChange(e) {
    this.setData({ role: e.detail.value });
  },
  onSyncInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      syncConfig: {
        ...this.data.syncConfig,
        [field]: e.detail.value,
      },
    });
  },
  saveSyncConfig() {
    store.saveSyncConfig(this.data.syncConfig);
    wx.showToast({ title: "同步配置已保存", icon: "success" });
  },
  async pushSync() {
    try {
      this.setData({ syncState: "正在上传..." });
      await syncPush();
      this.setData({ syncState: "已上传到云端" });
      wx.showToast({ title: "同步完成", icon: "success" });
    } catch (error) {
      this.setData({ syncState: error.message || "上传失败" });
      wx.showToast({ title: "上传失败", icon: "none" });
    }
  },
  async pullSync() {
    try {
      this.setData({ syncState: "正在下载..." });
      await syncPull();
      this.setData({ syncState: "已从云端更新" });
      wx.showToast({ title: "同步完成", icon: "success" });
      this.onShow();
    } catch (error) {
      this.setData({ syncState: error.message || "下载失败" });
      wx.showToast({ title: "下载失败", icon: "none" });
    }
  },
  addUser() {
    const username = this.data.username.trim();
    const password = this.data.password.trim();
    if (!username || !password) {
      wx.showToast({ title: "请先填写账号和密码", icon: "none" });
      return;
    }
    const state = store.loadState();
    if (state.users.some((item) => item.username === username)) {
      wx.showToast({ title: "账号已存在", icon: "none" });
      return;
    }
    state.users.unshift({
      id: `${Date.now()}`,
      username,
      passwordHash: store.hashPassword(password),
      role: this.data.role,
      createdAt: new Date().toISOString(),
    });
    store.saveState({ users: state.users });
    this.setData({ username: "", password: "", role: "user" });
    wx.showToast({ title: "已添加", icon: "success" });
  },
  resetDemo() {
    wx.showModal({
      title: "恢复示例数据",
      content: "会覆盖当前任务、记录和附件，确定继续吗？",
      success: (res) => {
        if (!res.confirm) return;
        store.resetDemoData();
        wx.showToast({ title: "已恢复", icon: "success" });
      },
    });
  },
  async exportBackup() {
    const state = store.loadState();
    const filePath = `${wx.env.USER_DATA_PATH}/medequip-backup-${Date.now()}.json`;
    wx.getFileSystemManager().writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
    wx.openDocument({
      filePath,
      fileType: "json",
      showMenu: true,
    });
  },
  importBackup() {
    wx.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["json"],
      success: (res) => {
        const filePath = res.tempFiles?.[0]?.path;
        if (!filePath) return;
        try {
          const fs = wx.getFileSystemManager();
          const text = fs.readFileSync(filePath, "utf8");
          const payload = JSON.parse(text);
          store.importBackup(payload);
          wx.showToast({ title: "已导入", icon: "success" });
          this.onShow();
        } catch (error) {
          wx.showToast({ title: "文件格式不对", icon: "none" });
        }
      },
    });
  },
  async exportExcel() {
    const state = store.loadState();
    await exportXlsx(state.tasks, "设备科任务导出.xlsx");
    wx.showToast({ title: "已导出", icon: "success" });
  },
  logout() {
    wx.showModal({
      title: "退出登录",
      content: "确定退出当前账号吗？",
      success: (res) => {
        if (!res.confirm) return;
        getApp().clearSession();
        wx.reLaunch({ url: "/pages/login/index" });
      },
    });
  },
});
