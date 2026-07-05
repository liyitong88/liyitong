const store = require("../../utils/storage");
const { sortTasks, taskCode, isOverdue, isDueToday, isWithinThreeDays, isReminderToday, isReminderSoon, defaultTaskTypes } = require("../../utils/task");

Page({
  data: {
    session: null,
    keyword: "",
    scope: "全部",
    statusIndex: 0,
    typeIndex: 0,
    deptIndex: 0,
    ownerIndex: 0,
    statusOptions: ["全部", "待处理", "处理中", "等待配件", "等待厂家", "已完成", "已取消"],
    typeOptions: ["全部", ...defaultTaskTypes],
    deptOptions: ["全部"],
    ownerOptions: ["全部"],
    tasks: [],
    filteredTasks: [],
    leadTitle: "",
    leadNote: "",
    metrics: [],
  },
  onShow() {
    const state = store.loadState();
    const session = getApp().syncSession();
    if (!session) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    const pendingScope = wx.getStorageSync("medequip.pendingTaskScope");
    if (pendingScope) {
      wx.removeStorageSync("medequip.pendingTaskScope");
      const scopeMap = {
        today: "今日待办",
        remind: "今日提醒",
        soon: "3天内到期",
        overdue: "超期任务",
      };
      const nextScope = scopeMap[pendingScope];
      if (nextScope) {
        this.setData({ scope: nextScope });
      }
    }
    const deptOptions = ["全部", ...Array.from(new Set(state.tasks.map((item) => item.department).filter(Boolean)))];
    const ownerOptions = ["全部", ...Array.from(new Set(state.tasks.map((item) => item.owner).filter(Boolean)))];
    this.setData({
      session,
      tasks: state.tasks,
      deptOptions,
      ownerOptions,
    });
    this.applyFilter();
  },
  onPullDownRefresh() {
    this.onShow();
    wx.stopPullDownRefresh();
  },
  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    this.applyFilter();
  },
  onScopeChange(e) {
    const index = Number(e.detail.value);
    const scope = ["全部", "今日待办", "今日提醒", "3天内到期", "超期任务"][index];
    this.setData({ scope });
    this.applyFilter();
  },
  onStatusChange(e) {
    this.setData({ statusIndex: Number(e.detail.value) });
    this.applyFilter();
  },
  onTypeChange(e) {
    this.setData({ typeIndex: Number(e.detail.value) });
    this.applyFilter();
  },
  onDeptChange(e) {
    this.setData({ deptIndex: Number(e.detail.value) });
    this.applyFilter();
  },
  onOwnerChange(e) {
    this.setData({ ownerIndex: Number(e.detail.value) });
    this.applyFilter();
  },
  clearFilters() {
    this.setData({
      keyword: "",
      scope: "全部",
      statusIndex: 0,
      typeIndex: 0,
      deptIndex: 0,
      ownerIndex: 0,
    });
    this.applyFilter();
  },
  applyFilter() {
    const {
      tasks,
      keyword,
      scope,
      statusIndex,
      typeIndex,
      deptIndex,
      ownerIndex,
      statusOptions,
      typeOptions,
      deptOptions,
      ownerOptions,
    } = this.data;
    const q = keyword.trim().toLowerCase();
    const filtered = sortTasks(tasks.filter((task) => {
      if (scope === "今日待办" && !(isReminderToday(task) || isDueToday(task))) return false;
      if (scope === "今日提醒" && !isReminderToday(task)) return false;
      if (scope === "3天内到期" && !isWithinThreeDays(task)) return false;
      if (scope === "超期任务" && !isOverdue(task)) return false;
      if (statusOptions[statusIndex] !== "全部" && task.status !== statusOptions[statusIndex]) return false;
      if (typeOptions[typeIndex] !== "全部" && task.type !== typeOptions[typeIndex]) return false;
      if (deptOptions[deptIndex] !== "全部" && task.department !== deptOptions[deptIndex]) return false;
      if (ownerOptions[ownerIndex] !== "全部" && task.owner !== ownerOptions[ownerIndex]) return false;
      if (!q) return true;
      return [taskCode(task), task.title, task.department, task.owner, task.equipmentName, task.equipmentCode]
        .join(" ")
        .toLowerCase()
        .includes(q);
    })).map((task) => ({
      ...task,
      taskCode: taskCode(task),
      badge: isOverdue(task)
        ? "超期"
        : isDueToday(task)
          ? "今日到期"
          : isReminderToday(task)
            ? "今日提醒"
            : isWithinThreeDays(task)
              ? "3天内到期"
              : task.status,
      badgeClass: isOverdue(task) ? "danger" : isDueToday(task) ? "warn" : "",
    }));
    const active = filtered.filter((task) => task.status !== "已完成" && task.status !== "已取消");
    const overdue = filtered.filter(isOverdue).length;
    const today = filtered.filter((task) => isReminderToday(task) || isDueToday(task)).length;
    const soon = filtered.filter(isWithinThreeDays).length;
    const leadTitle = filtered.length > 0 ? `当前筛选出 ${filtered.length} 条任务` : "没有符合条件的任务";
    const leadNote = `待处理 ${active.length} 条 · 今日 ${today} 条 · 超期 ${overdue} 条`;
    this.setData({
      filteredTasks: filtered,
      leadTitle,
      leadNote,
      metrics: [
        { label: "待处理", value: active.length },
        { label: "今日", value: today },
        { label: "超期", value: overdue },
        { label: "3天内", value: soon },
      ],
    });
  },
  openCreate() {
    wx.navigateTo({ url: "/pages/task-form/index?mode=create" });
  },
  openDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/task-detail/index?id=${id}` });
  },
  goHome() {
    wx.switchTab({ url: "/pages/dashboard/index" });
  },
  goReports() {
    wx.switchTab({ url: "/pages/reports/index" });
  },
  goProfile() {
    wx.switchTab({ url: "/pages/profile/index" });
  },
});
