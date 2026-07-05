const {
  defaultTaskTypes,
  emptyTask,
  uid,
  sortTasks,
} = require("./task");

const keys = {
  users: "medequip.users",
  tasks: "medequip.tasks",
  logs: "medequip.logs",
  attachments: "medequip.attachments",
  session: "medequip.session",
  prefs: "medequip.prefs",
  sync: "medequip.sync",
};

const defaultStatuses = ["待处理", "处理中", "等待配件", "等待厂家", "已完成", "已取消"];

const safeGet = (key, fallback) => {
  try {
    const value = wx.getStorageSync(key);
    return value === "" || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
};

const safeSet = (key, value) => {
  try {
    wx.setStorageSync(key, value);
  } catch {
    // ignore write failures for temporary sessions
  }
};

const safeRemove = (key) => {
  try {
    wx.removeStorageSync(key);
  } catch {
    // ignore
  }
};

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const hashPassword = (input) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
};

const normalizeUser = (user) => ({
  id: user?.id || uid(),
  username: String(user?.username || ""),
  passwordHash: String(user?.passwordHash || ""),
  role: user?.role === "admin" ? "admin" : "user",
  createdAt: String(user?.createdAt || new Date().toISOString()),
});

const normalizeTask = (task) => {
  const base = emptyTask();
  return {
    ...base,
    ...task,
    id: String(task?.id || uid()),
    title: String(task?.title || ""),
    type: defaultTaskTypes.includes(task?.type) ? task.type : base.type,
    department: String(task?.department || ""),
    equipmentName: String(task?.equipmentName || ""),
    equipmentCode: String(task?.equipmentCode || ""),
    description: String(task?.description || ""),
    owner: String(task?.owner || ""),
    status: defaultStatuses.includes(task?.status) ? task.status : base.status,
    createDate: String(task?.createDate || base.createDate),
    dueDate: String(task?.dueDate || ""),
    remindDate: String(task?.remindDate || ""),
    finishDate: String(task?.finishDate || ""),
    result: String(task?.result || ""),
    cost: String(task?.cost || ""),
    vendor: String(task?.vendor || ""),
    acceptancePerson: String(task?.acceptancePerson || ""),
    remark: String(task?.remark || ""),
    createdAt: String(task?.createdAt || base.createdAt),
    updatedAt: String(task?.updatedAt || base.updatedAt),
  };
};

const normalizeLog = (log) => ({
  id: log?.id || uid(),
  taskId: String(log?.taskId || ""),
  logContent: String(log?.logContent || ""),
  operator: String(log?.operator || ""),
  logTime: String(log?.logTime || new Date().toISOString()),
});

const normalizeAttachment = (item) => ({
  id: item?.id || uid(),
  taskId: String(item?.taskId || ""),
  filePath: String(item?.filePath || ""),
  fileName: String(item?.fileName || ""),
  fileType: String(item?.fileType || ""),
  uploadedAt: String(item?.uploadedAt || new Date().toISOString()),
});

const normalizePrefs = (prefs) => ({
  department: String(prefs?.department || ""),
  owner: String(prefs?.owner || ""),
  equipmentName: String(prefs?.equipmentName || ""),
  equipmentCode: String(prefs?.equipmentCode || ""),
  type: String(prefs?.type || ""),
});

const loadUsers = () => normalizeArray(safeGet(keys.users, [])).map(normalizeUser);
const saveUsers = (value) => safeSet(keys.users, JSON.stringify(value.map(normalizeUser)));

const loadTasks = () => sortTasks(normalizeArray(safeGet(keys.tasks, [])).map(normalizeTask));
const saveTasks = (value) => safeSet(keys.tasks, JSON.stringify(value.map(normalizeTask)));

const loadLogs = () => normalizeArray(safeGet(keys.logs, [])).map(normalizeLog);
const saveLogs = (value) => safeSet(keys.logs, JSON.stringify(value.map(normalizeLog)));

const loadAttachments = () => normalizeArray(safeGet(keys.attachments, [])).map(normalizeAttachment);
const saveAttachments = (value) => safeSet(keys.attachments, JSON.stringify(value.map(normalizeAttachment)));

const loadSession = () => {
  const session = safeGet(keys.session, null);
  return session && session.id ? session : null;
};
const saveSession = (session) => {
  if (!session) {
    safeRemove(keys.session);
    return;
  }
  safeSet(keys.session, JSON.stringify(session));
};

const loadPrefs = () => normalizePrefs(safeGet(keys.prefs, {}));
const savePrefs = (value) => safeSet(keys.prefs, JSON.stringify(normalizePrefs(value)));

const normalizeSyncConfig = (config) => ({
  endpoint: String(config?.endpoint || ""),
  token: String(config?.token || ""),
});

const loadSyncConfig = () => normalizeSyncConfig(safeGet(keys.sync, {}));

const saveSyncConfig = (value) => safeSet(keys.sync, JSON.stringify(normalizeSyncConfig(value)));

const ensureSeedData = () => {
  const users = loadUsers();
  if (users.length === 0) {
    saveUsers([
      {
        id: uid(),
        username: "admin",
        passwordHash: hashPassword("admin123"),
        role: "admin",
        createdAt: new Date().toISOString(),
      },
    ]);
  }
};

const login = (username, password) => {
  const users = loadUsers();
  const user = users.find((item) => item.username === username);
  if (!user) return null;
  if (user.passwordHash !== hashPassword(password)) return null;
  const session = { id: user.id, username: user.username, role: user.role };
  saveSession(session);
  return session;
};

const logout = () => saveSession(null);

const updateTask = (taskId, updater) => {
  const tasks = loadTasks();
  const next = tasks.map((task) => (task.id === taskId ? normalizeTask(updater(task)) : task));
  saveTasks(next);
  return next.find((task) => task.id === taskId);
};

const upsertTask = (task) => {
  const tasks = loadTasks();
  const normalized = normalizeTask(task);
  const index = tasks.findIndex((item) => item.id === normalized.id);
  if (index >= 0) tasks[index] = normalized;
  else tasks.unshift(normalized);
  saveTasks(tasks);
  return normalized;
};

const addTask = (task, operator) => {
  const now = new Date().toISOString();
  const normalized = normalizeTask({
    ...emptyTask(),
    ...task,
    id: uid(),
    createdAt: now,
    updatedAt: now,
  });
  const tasks = [normalized, ...loadTasks()];
  saveTasks(tasks);
  addLog(normalized.id, "任务已创建", operator || "系统", now);
  return normalized;
};

const addLog = (taskId, logContent, operator, logTime = new Date().toISOString()) => {
  const logs = loadLogs();
  const item = normalizeLog({ taskId, logContent, operator, logTime });
  logs.unshift(item);
  saveLogs(logs);
  return item;
};

const addAttachment = (taskId, filePath, fileName, fileType, operator) => {
  const attachments = loadAttachments();
  const item = normalizeAttachment({
    id: uid(),
    taskId,
    filePath,
    fileName,
    fileType,
    uploadedAt: new Date().toISOString(),
  });
  attachments.unshift(item);
  saveAttachments(attachments);
  addLog(taskId, `上传附件：${fileName}`, operator || "系统", item.uploadedAt);
  return item;
};

const completeTask = (taskId, payload, operator) => {
  const updated = updateTask(taskId, (task) => ({
    ...task,
    status: "已完成",
    finishDate: payload.finishDate || task.finishDate,
    result: payload.result || task.result,
    cost: payload.cost || task.cost,
    vendor: payload.vendor || task.vendor,
    acceptancePerson: payload.acceptancePerson || task.acceptancePerson,
    remark: payload.remark || task.remark,
    updatedAt: new Date().toISOString(),
  }));
  if (updated) {
    addLog(taskId, "任务已完成闭环", operator || "系统");
  }
  return updated;
};

const changeTaskStatus = (taskId, status, operator) => {
  const updated = updateTask(taskId, (task) => ({
    ...task,
    status,
    updatedAt: new Date().toISOString(),
  }));
  if (updated) {
    addLog(taskId, `状态变更为：${status}`, operator || "系统");
  }
  return updated;
};

const removeTask = (taskId) => {
  const tasks = loadTasks().filter((task) => task.id !== taskId);
  saveTasks(tasks);
};

const loadState = () => ({
  users: loadUsers(),
  session: loadSession(),
  tasks: loadTasks(),
  logs: loadLogs(),
  attachments: loadAttachments(),
  prefs: loadPrefs(),
});

const saveState = (state) => {
  if (state.users) saveUsers(state.users);
  if (state.session !== undefined) saveSession(state.session);
  if (state.tasks) saveTasks(state.tasks);
  if (state.logs) saveLogs(state.logs);
  if (state.attachments) saveAttachments(state.attachments);
  if (state.prefs) savePrefs(state.prefs);
  if (state.syncConfig) saveSyncConfig(state.syncConfig);
};

const importBackup = (payload) => {
  const next = {
    users: Array.isArray(payload?.users) ? payload.users.map(normalizeUser) : loadUsers(),
    session: payload?.session || null,
    tasks: Array.isArray(payload?.tasks) ? payload.tasks.map(normalizeTask) : [],
    logs: Array.isArray(payload?.logs) ? payload.logs.map(normalizeLog) : [],
    attachments: Array.isArray(payload?.attachments) ? payload.attachments.map(normalizeAttachment) : [],
    prefs: payload?.prefs ? normalizePrefs(payload.prefs) : loadPrefs(),
  };
  saveState(next);
  return next;
};

const resetDemoData = () => {
  const now = new Date().toISOString();
  const demoTasks = [
    emptyTask({
      id: uid(),
      title: "CT 设备报警排查",
      type: "设备维修",
      department: "影像科",
      equipmentName: "CT-128",
      equipmentCode: "IMG-CT-001",
      description: "机房出现报警，需联系工程师到场排查。",
      owner: "张工",
      status: "处理中",
      dueDate: new Date().toISOString().slice(0, 10),
      remindDate: new Date().toISOString().slice(0, 10),
      createdAt: now,
      updatedAt: now,
    }),
    emptyTask({
      id: uid(),
      title: "采购申请审批跟进",
      type: "设备采购",
      department: "采购办",
      equipmentName: "监护仪",
      equipmentCode: "PUR-002",
      description: "等待审批后下单。",
      owner: "李老师",
      status: "待处理",
      dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      remindDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      createdAt: now,
      updatedAt: now,
    }),
  ];
  saveTasks(demoTasks);
  saveLogs([
    {
      id: uid(),
      taskId: demoTasks[0].id,
      logContent: "已联系工程师，等待上门。",
      operator: "张工",
      logTime: now,
    },
  ]);
  saveAttachments([]);
  savePrefs({
    department: "影像科",
    owner: "张工",
    equipmentName: "CT-128",
    equipmentCode: "IMG-CT-001",
    type: "设备维修",
  });
};

const ensureLocalSyncedState = () => loadState();

module.exports = {
  hashPassword,
  ensureSeedData,
  loadUsers,
  saveUsers,
  loadTasks,
  saveTasks,
  loadLogs,
  saveLogs,
  loadAttachments,
  saveAttachments,
  loadSession,
  saveSession,
  loadPrefs,
  savePrefs,
  loadSyncConfig,
  saveSyncConfig,
  login,
  logout,
  addTask,
  addLog,
  addAttachment,
  completeTask,
  changeTaskStatus,
  removeTask,
  loadState,
  saveState,
  importBackup,
  resetDemoData,
  upsertTask,
  ensureLocalSyncedState,
};
