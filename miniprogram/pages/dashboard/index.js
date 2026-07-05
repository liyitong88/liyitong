const store = require("../../utils/storage");
const { sortTasks, isOverdue, isDueToday, isReminderToday, isWithinThreeDays, isReminderSoon, formatDatePart, taskCode } = require("../../utils/task");

Page({
  data: {
    session: null,
    tasks: [],
    logs: [],
    attachments: [],
    counts: {
      todayTodo: 0,
      soon: 0,
      overdue: 0,
      remindSoon: 0,
    },
    reminders: [],
    recentTasks: [],
    latestLogs: [],
    focusTitle: "",
    focusNote: "",
    missionTiles: [],
  },
  onShow() {
    const state = store.loadState();
    const session = getApp().syncSession();
    if (!session) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.applyState(state, session);
  },
  onPullDownRefresh() {
    this.onShow();
    wx.stopPullDownRefresh();
  },
  applyState(state, session) {
    const active = state.tasks.filter((task) => task.status !== "已完成" && task.status !== "已取消");
    const typeCount = (type) => state.tasks.filter((task) => task.type === type).length;
    const overdueCount = active.filter(isOverdue).length;
    const todayCount = active.filter((task) => isReminderToday(task) || isDueToday(task)).length;
    const soonCount = active.filter(isWithinThreeDays).length;
    const reminders = sortTasks(state.tasks)
      .filter((task) => isOverdue(task) || isDueToday(task) || isWithinThreeDays(task) || isReminderSoon(task))
      .slice(0, 6)
      .map((task) => ({
        ...task,
        badge: isOverdue(task)
          ? "超期"
          : isDueToday(task)
            ? "今日到期"
            : isReminderToday(task)
              ? "今日提醒"
              : isWithinThreeDays(task)
                ? "3天内到期"
                : "即将提醒",
        badgeClass: isOverdue(task) ? "danger" : "warn",
      }));
    const recentTasks = sortTasks(state.tasks).slice(0, 6).map((task) => ({
      ...task,
      badge: taskCode(task),
      dueText: task.dueDate ? formatDatePart(task.dueDate) : "-",
      badgeClass: isOverdue(task) ? "danger" : isDueToday(task) ? "" : "warn",
    }));
    const latestLogs = state.logs.slice(0, 5).map((log) => {
      const task = state.tasks.find((item) => item.id === log.taskId);
      return {
        ...log,
        taskTitle: task ? task.title : "已删除任务",
      };
    });
    const focusTitle = overdueCount > 0
      ? `今天先处理 ${overdueCount} 条超期任务`
      : todayCount > 0
        ? `今天有 ${todayCount} 条待办需要跟进`
        : "今天节奏不错，可以先补全新任务";
    const focusNote = `提醒 ${soonCount} 条 · 待办 ${todayCount} 条 · 超期 ${overdueCount} 条`;
    this.setData({
      session,
      tasks: state.tasks,
      logs: state.logs,
      attachments: state.attachments,
      counts: {
        todayTodo: active.filter((task) => isReminderToday(task) || isDueToday(task)).length,
        soon: active.filter(isWithinThreeDays).length,
        overdue: active.filter(isOverdue).length,
        remindSoon: active.filter(isReminderSoon).length,
      },
      reminders,
      recentTasks,
      latestLogs,
      focusTitle,
      focusNote,
      missionTiles: [
        { label: "设备维修", value: typeCount("设备维修") },
        { label: "设备采购", value: typeCount("设备采购") + typeCount("耗材采购") },
        { label: "计量校准", value: typeCount("计量校准") },
        { label: "设备验收", value: typeCount("设备验收") },
      ],
    });
  },
  goToTasks() {
    wx.switchTab({ url: "/pages/tasks/index" });
  },
  openScopedTasks(e) {
    const { scope } = e.currentTarget.dataset;
    wx.setStorageSync("medequip.pendingTaskScope", scope);
    wx.switchTab({ url: "/pages/tasks/index" });
  },
  goToReports() {
    wx.switchTab({ url: "/pages/reports/index" });
  },
  goToProfile() {
    wx.switchTab({ url: "/pages/profile/index" });
  },
  createTask() {
    wx.navigateTo({ url: "/pages/task-form/index?mode=create" });
  },
  openTask(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/task-detail/index?id=${id}` });
  },
});
