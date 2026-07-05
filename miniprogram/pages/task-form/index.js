const store = require("../../utils/storage");
const { emptyTask, defaultTaskTypes, defaultTaskStatuses } = require("../../utils/task");

const today = () => new Date().toISOString().slice(0, 10);
const dateOffset = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

Page({
  data: {
    session: null,
    mode: "create",
    taskId: "",
    taskTypes: defaultTaskTypes,
    taskStatuses: defaultTaskStatuses,
    title: "",
    typeIndex: 0,
    statusIndex: 0,
    department: "",
    equipmentName: "",
    equipmentCode: "",
    description: "",
    owner: "",
    createDate: today(),
    dueDate: dateOffset(7),
    remindDate: dateOffset(3),
    finishDate: today(),
    result: "",
    cost: "0",
    vendor: "",
    acceptancePerson: "",
    remark: "",
    filePath: "",
    fileName: "",
    fileType: "",
    error: "",
  },
  onLoad(query) {
    const session = getApp().syncSession();
    if (!session) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    const mode = query.mode || "create";
    const taskId = query.id || query.taskId || "";
    const state = store.loadState();
    let form = emptyTask({
      createDate: today(),
      dueDate: dateOffset(7),
      remindDate: dateOffset(3),
    });
    if (taskId) {
      const task = state.tasks.find((item) => item.id === taskId);
      if (task) form = { ...form, ...task };
    }
    this.setData({
      session,
      mode,
      taskId,
      title: form.title,
      typeIndex: Math.max(0, this.data.taskTypes.indexOf(form.type)),
      statusIndex: Math.max(0, this.data.taskStatuses.indexOf(form.status)),
      department: form.department,
      equipmentName: form.equipmentName,
      equipmentCode: form.equipmentCode,
      description: form.description,
      owner: form.owner,
      createDate: form.createDate,
      dueDate: form.dueDate,
      remindDate: form.remindDate,
      finishDate: form.finishDate || today(),
      result: form.result,
      cost: form.cost || "0",
      vendor: form.vendor,
      acceptancePerson: form.acceptancePerson,
      remark: form.remark,
    });
  },
  onTypeChange(e) {
    this.setData({ typeIndex: Number(e.detail.value) });
  },
  onStatusChange(e) {
    this.setData({ statusIndex: Number(e.detail.value) });
  },
  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: e.detail.value });
  },
  async chooseImage() {
    const result = await new Promise((resolve) => {
      wx.chooseImage({
        count: 1,
        success: resolve,
        fail: () => resolve(null),
      });
    });
    if (!result || !result.tempFilePaths.length) return;
    const tempFilePath = result.tempFilePaths[0];
    const fileName = tempFilePath.split(/[\\/]/).pop() || `附件-${Date.now()}.jpg`;
    wx.showLoading({ title: "保存附件中" });
    try {
      const savedPath = await new Promise((resolve, reject) => {
        wx.saveFile({
          tempFilePath,
          success: (res) => resolve(res.savedFilePath),
          fail: reject,
        });
      });
      this.setData({ filePath: savedPath, fileName, fileType: "image" });
    } catch (error) {
      this.setData({ filePath: tempFilePath, fileName, fileType: "image" });
    } finally {
      wx.hideLoading();
    }
  },
  backToList() {
    wx.navigateBack({ delta: 1 });
  },
  submit() {
    const session = getApp().globalData.session || getApp().syncSession();
    if (!this.data.title.trim() || !this.data.department.trim() || !this.data.owner.trim() || !this.data.dueDate) {
      this.setData({ error: "请把标题、科室、负责人和截止日期填完整" });
      return;
    }
    const state = store.loadState();
    const now = new Date().toISOString();
    const type = this.data.taskTypes[this.data.typeIndex] || this.data.taskTypes[0];
    const status = this.data.taskStatuses[this.data.statusIndex] || "待处理";
    const payload = {
      title: this.data.title.trim(),
      type,
      department: this.data.department.trim(),
      equipmentName: this.data.equipmentName.trim(),
      equipmentCode: this.data.equipmentCode.trim(),
      description: this.data.description.trim(),
      owner: this.data.owner.trim(),
      status,
      createDate: this.data.createDate,
      dueDate: this.data.dueDate,
      remindDate: this.data.remindDate,
      finishDate: this.data.finishDate,
      result: this.data.result.trim(),
      cost: this.data.cost.trim(),
      vendor: this.data.vendor.trim(),
      acceptancePerson: this.data.acceptancePerson.trim(),
      remark: this.data.remark.trim(),
      updatedAt: now,
    };
    if (this.data.mode === "complete") {
      if (!this.data.result.trim()) {
        this.setData({ error: "完成闭环时请填写处理结果" });
        return;
      }
      store.completeTask(this.data.taskId, payload, session?.username || "系统");
      wx.showToast({ title: "已完成闭环", icon: "success" });
      wx.redirectTo({ url: `/pages/task-detail/index?id=${this.data.taskId}` });
      return;
    }
    if (this.data.taskId) {
      const current = state.tasks.find((item) => item.id === this.data.taskId) || emptyTask();
      const updated = {
        ...current,
        ...payload,
        id: this.data.taskId,
        createdAt: current.createdAt || now,
      };
      store.upsertTask(updated);
      store.addLog(this.data.taskId, "任务信息已更新", session?.username || "系统", now);
      wx.showToast({ title: "已保存", icon: "success" });
      wx.redirectTo({ url: `/pages/task-detail/index?id=${this.data.taskId}` });
      return;
    }
    const task = store.addTask(payload, session?.username || "系统");
    if (this.data.filePath) {
      store.addAttachment(task.id, this.data.filePath, this.data.fileName, this.data.fileType, session?.username || "系统");
    }
    wx.showToast({ title: "已创建", icon: "success" });
    wx.redirectTo({ url: `/pages/task-detail/index?id=${task.id}` });
  },
});
