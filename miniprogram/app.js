const store = require("./utils/store");

App({
  globalData: {
    session: null,
    theme: {
      brand: "#1d4ed8",
      accent: "#14b8a6",
      warning: "#f59e0b",
      danger: "#ef4444",
    },
  },
  onLaunch() {
    store.ensureSeedData();
    this.syncSession();
  },
  syncSession() {
    this.globalData.session = store.getSession();
    return this.globalData.session;
  },
  setSession(session) {
    store.saveSession(session);
    this.globalData.session = session;
  },
  clearSession() {
    store.saveSession(null);
    this.globalData.session = null;
  },
});
