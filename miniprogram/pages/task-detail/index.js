const store = require("../../utils/storage");
const { formatDatePart, formatDateTimePart, formatMoney, taskCode, isOverdue, isDueToday, isReminderToday, isWithinThreeDays, getAllowedStatusTransitions } = require("../../utils/task");

const dayDiff = (startValue, endValue) => {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
};

Page({
  data: {
    session: null,
    task: null,
    logs: [],
    attachments: [],
    statusOptions: [],
    statusIndex: 0,
    logDraft: "",
    stats: {
      logCount: 0,
      attachmentCount: 0,
      createdAgo: "",
      dueHint: "",
    },
    focusTitle: "",
    focusNote: "",
  },
  onLoad(query) {
    this.taskId = query.id || "";
  },
  onShow() {
    const session = getApp().syncSession();
    if (!session) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.refresh();
  },
  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  },
  refresh() {
    const state = store.loadState();
    const task = state.tasks.find((item) => item.id === this.taskId) || null;
    if (!task) {
      wx.showToast({ title: "任务不存在", icon: "none" });
      wx.navigateBack({ delta: 1 });
      return;
    }
    const session = getApp().globalData.session || getApp().syncSession();
    const statusOptions = getAllowedStatusTransitions(task.status, session?.role || "user");
    const logs = state.logs.filter((item) => item.taskId === task.id);
    const attachments = state.attachments.filter((item) => item.taskId === task.id);
    const createdAgoDays = dayDiff(task.createdAt || new Date(), new Date());
    const dueLeftDays = task.dueDate ? dayDiff(new Date(), task.dueDate) : null;
    const dueHint = task.dueDate
      ? dueLeftDays === null
        ? "截止日期已设置"
        : dueLeftDays < 0
          ? `已超期 ${Math.abs(dueLeftDays)} 天`
          : dueLeftDays === 0
            ? "今天到期"
            : `还有 ${dueLeftDays} 天到期`
      : "未设置截止日期";
    const focusTitle =
      task.status === "已完成"
        ? "任务已闭环"
        : task.status === "已取消"
          ? "任务已取消"
          : isOverdue(task)
            ? "优先处理这个超期任务"
            : "继续推进这个任务";
    const focusNote =
      task.status === "已完成"
        ? "可以查看闭环结果、附件和处理轨迹"
        : task.status === "已取消"
          ? "如需重启，可重新创建一条新任务"
          : dueHint;
    this.setData({
      session,
      task: {
        ...task,
        taskCode: taskCode(task),
        dueBadge: isOverdue(task)
          ? "超期"
          : isDueToday(task)
            ? "今日到期"
            : isReminderToday(task)
              ? "今日提醒"
              : isWithinThreeDays(task)
                ? "3天内到期"
                : task.status,
      },
      logs,
      attachments,
      statusOptions,
      statusIndex: Math.max(0, statusOptions.indexOf(task.status)),
      stats: {
        logCount: logs.length,
        attachmentCount: attachments.length,
        createdAgo: createdAgoDays === null ? "创建时间未知" : createdAgoDays <= 0 ? "今天创建" : `已创建 ${createdAgoDays} 天`,
        dueHint,
      },
      focusTitle,
      focusNote,
    });
  },
  openEdit() {
    wx.navigateTo({ url: `/pages/task-form/index?mode=edit&id=${this.taskId}` });
  },
  openComplete() {
    wx.navigateTo({ url: `/pages/task-form/index?mode=complete&id=${this.taskId}` });
  },
  copyTaskCode() {
    if (!this.data.task?.taskCode) return;
    wx.setClipboardData({
      data: this.data.task.taskCode,
      success: () => wx.showToast({ title: "已复制编号", icon: "success" }),
    });
  },
  goHome() {
    wx.switchTab({ url: "/pages/dashboard/index" });
  },
  goTasks() {
    wx.switchTab({ url: "/pages/tasks/index" });
  },
  onLogInput(e) {
    this.setData({ logDraft: e.detail.value });
  },
  addLog() {
    if (!this.data.logDraft.trim()) return;
    const session = getApp().globalData.session || getApp().syncSession();
    store.addLog(this.taskId, this.data.logDraft.trim(), session?.username || "系统");
    this.setData({ logDraft: "" });
    this.refresh();
  },
  onStatusChange(e) {
    const status = this.data.statusOptions[Number(e.detail.value)];
    const session = getApp().globalData.session || getApp().syncSession();
    store.changeTaskStatus(this.taskId, status, session?.username || "系统");
    this.refresh();
  },
  cancelTask() {
    wx.showModal({
      title: "取消任务",
      content: "确定要把这条任务标记为已取消吗？",
      success: (res) => {
        if (!res.confirm) return;
        const session = getApp().globalData.session || getApp().syncSession();
        store.changeTaskStatus(this.taskId, "已取消", session?.username || "系统");
        this.refresh();
      },
    });
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
    const session = getApp().globalData.session || getApp().syncSession();
    const tempFilePath = result.tempFilePaths[0];
    const fileName = tempFilePath.split(/[\\/]/).pop() || `附件-${Date.now()}.jpg`;
    wx.showLoading({ title: "保存附件中" });
    try {
      const filePath = await new Promise((resolve, reject) => {
        wx.saveFile({
          tempFilePath,
          success: (res) => resolve(res.savedFilePath),
          fail: reject,
        });
      });
      store.addAttachment(this.taskId, filePath, fileName, "image", session?.username || "系统");
    } catch (error) {
      store.addAttachment(this.taskId, tempFilePath, fileName, "image", session?.username || "系统");
    } finally {
      wx.hideLoading();
    }
    this.refresh();
  },
  previewAttachment(e) {
    const { path } = e.currentTarget.dataset;
    wx.previewImage({ urls: [path], current: path });
  },
});
