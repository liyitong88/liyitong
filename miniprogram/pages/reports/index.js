const store = require("../../utils/storage");
const { buildMonthRange } = require("../../utils/task");
const { buildMonthlySummary } = require("../../utils/report");
const { exportXlsx } = require("../../utils/export");

Page({
  data: {
    session: null,
    range: buildMonthRange(),
    summary: null,
    typeRows: [],
    deptRows: [],
    reportText: "",
    loading: false,
    reportCards: [],
    reportLead: "",
  },
  onShow() {
    const session = getApp().syncSession();
    if (!session) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.setData({ session });
    this.generate();
  },
  onPullDownRefresh() {
    this.onShow();
    wx.stopPullDownRefresh();
  },
  onStartChange(e) {
    this.setData({ range: { ...this.data.range, start: e.detail.value } });
  },
  onEndChange(e) {
    this.setData({ range: { ...this.data.range, end: e.detail.value } });
  },
  generate() {
    const state = store.loadState();
    const summary = buildMonthlySummary(state.tasks, state.logs, this.data.range);
    const typeRows = Object.entries(summary.stats.byType).map(([name, value]) => ({ name, value }));
    const deptRows = Object.entries(summary.stats.byDepartment).map(([name, value]) => ({ name, value }));
    this.setData({
      summary,
      typeRows,
      deptRows,
      reportText: summary.text,
      reportLead: summary.text.split("\n")[2] || summary.headline,
      reportCards: [
        { label: "完成任务", value: summary.stats.completed.length },
        { label: "未完成", value: summary.stats.pending.length },
        { label: "超期", value: summary.stats.overdue.length },
        { label: "费用合计", value: summary.costText },
      ],
    });
  },
  async exportExcel() {
    const state = store.loadState();
    this.setData({ loading: true });
    await exportXlsx(state.tasks);
    this.setData({ loading: false });
    wx.showToast({ title: "已导出", icon: "success" });
  },
  copyReport() {
    wx.setClipboardData({
      data: this.data.reportText,
      success: () => wx.showToast({ title: "已复制", icon: "success" }),
    });
  },
});
