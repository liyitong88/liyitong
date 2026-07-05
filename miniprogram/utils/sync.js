const store = require("./storage");

const request = (options) =>
  new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: (res) => resolve(res),
      fail: reject,
    });
  });

const buildHeaders = (config) => {
  const headers = {
    "Content-Type": "application/json",
  };
  if (config?.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }
  return headers;
};

const normalizeEndpoint = (value) => String(value || "").replace(/\/+$/, "");

const pushState = async (state, config) => {
  const endpoint = normalizeEndpoint(config?.endpoint);
  if (!endpoint) {
    throw new Error("请先填写同步地址");
  }
  const res = await request({
    url: endpoint,
    method: "POST",
    header: buildHeaders(config),
    data: {
      ...state,
      syncedAt: new Date().toISOString(),
    },
  });
  return res.data;
};

const pullState = async (config) => {
  const endpoint = normalizeEndpoint(config?.endpoint);
  if (!endpoint) {
    throw new Error("请先填写同步地址");
  }
  const res = await request({
    url: endpoint,
    method: "GET",
    header: buildHeaders(config),
  });
  return res.data;
};

const syncPush = async () => {
  const config = store.loadSyncConfig();
  const state = store.loadState();
  await pushState(state, config);
  return state;
};

const syncPull = async () => {
  const config = store.loadSyncConfig();
  const payload = await pullState(config);
  const next = payload?.state || payload;
  if (!next || typeof next !== "object") {
    throw new Error("同步返回的数据格式不正确");
  }
  store.importBackup(next);
  return next;
};

module.exports = {
  pushState,
  pullState,
  syncPush,
  syncPull,
};
