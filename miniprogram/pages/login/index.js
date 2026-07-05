const store = require("../../utils/storage");

Page({
  data: {
    username: "admin",
    password: "admin123",
    loading: false,
    error: "",
  },
  onShow() {
    const session = getApp().syncSession();
    if (session) {
      wx.reLaunch({ url: "/pages/dashboard/index" });
    }
  },
  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },
  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },
  async handleLogin() {
    const username = this.data.username.trim();
    const password = this.data.password;
    if (!username || !password) {
      this.setData({ error: "请填写账号和密码" });
      return;
    }
    this.setData({ loading: true, error: "" });
    const session = store.login(username, password);
    this.setData({ loading: false });
    if (!session) {
      this.setData({ error: "账号或密码不正确" });
      return;
    }
    getApp().setSession(session);
    wx.reLaunch({ url: "/pages/dashboard/index" });
  },
});
