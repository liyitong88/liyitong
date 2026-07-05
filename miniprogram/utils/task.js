const defaultTaskTypes = [
  "设备维修",
  "设备采购",
  "耗材采购",
  "计量校准",
  "设备验收",
  "设备报废",
  "合同跟进",
  "厂家沟通",
  "科室反馈",
  "其他",
];

const defaultTaskStatuses = ["待处理", "处理中", "等待配件", "等待厂家", "已完成", "已取消"];

const today = () => new Date();
const toDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const startOfToday = () => {
  const d = today();
  d.setHours(0, 0, 0, 0);
  return d;
};
const formatDatePart = (value) => {
  const d = toDateOnly(value);
  if (!d) return "-";
  return d.toISOString().slice(0, 10);
};
const formatDateTimePart = (value) => {
  const d = toDateOnly(value);
  if (!d) return "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

const emptyTask = (overrides = {}) => {
  const now = new Date().toISOString();
  return {
    id: "",
    title: "",
    type: "设备维修",
    department: "",
    equipmentName: "",
    equipmentCode: "",
    description: "",
    owner: "",
    status: "待处理",
    createDate: now.slice(0, 10),
    dueDate: "",
    remindDate: "",
    finishDate: "",
    result: "",
    cost: "",
    vendor: "",
    acceptancePerson: "",
    remark: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

const isCompleted = (task) => task.status === "已完成" || task.status === "已取消";

const isOverdue = (task) => {
  if (isCompleted(task)) return false;
  const due = toDateOnly(task.dueDate);
  if (!due) return false;
  due.setHours(23, 59, 59, 999);
  return due < startOfToday();
};

const isDueToday = (task) => {
  const due = toDateOnly(task.dueDate);
  if (!due) return false;
  return due.toDateString() === startOfToday().toDateString();
};

const isWithinThreeDays = (task) => {
  if (isCompleted(task)) return false;
  const due = toDateOnly(task.dueDate);
  if (!due) return false;
  const diff = due.getTime() - startOfToday().getTime();
  return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
};

const isReminderToday = (task) => {
  const remind = toDateOnly(task.remindDate);
  if (!remind) return false;
  return remind.toDateString() === startOfToday().toDateString();
};

const isReminderSoon = (task) => {
  if (isCompleted(task)) return false;
  const remind = toDateOnly(task.remindDate);
  if (!remind) return false;
  const diff = remind.getTime() - startOfToday().getTime();
  return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
};

const sortTasks = (tasks) =>
  [...tasks].sort((a, b) => {
    const weight = (task) => {
      if (isOverdue(task)) return 0;
      if (isDueToday(task)) return 1;
      return 2;
    };
    const diff = weight(a) - weight(b);
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

const buildMonthRange = (base = new Date()) => {
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    start: formatDatePart(start),
    end: formatDatePart(end),
  };
};

const inRange = (value, range) => {
  const date = toDateOnly(value);
  if (!date) return false;
  const start = toDateOnly(range.start);
  const end = toDateOnly(range.end);
  if (!start || !end) return false;
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
};

const formatMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return value || "0.00";
  return number.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const taskCode = (task) => {
  const datePart = (task.createDate || "0000-00-00").replace(/-/g, "");
  return `ME-${datePart}-${String(task.id || "").slice(-4).toUpperCase()}`;
};

const getAllowedStatusTransitions = (status, role) => {
  if (role === "admin") return [...defaultTaskStatuses];
  if (status === "已完成" || status === "已取消") return [];
  switch (status) {
    case "待处理":
      return ["处理中", "等待配件", "等待厂家", "已取消"];
    case "处理中":
      return ["等待配件", "等待厂家", "已完成", "已取消"];
    case "等待配件":
      return ["处理中", "等待厂家", "已完成", "已取消"];
    case "等待厂家":
      return ["处理中", "等待配件", "已完成", "已取消"];
    default:
      return ["处理中", "已完成", "已取消"];
  }
};

const summaryForReport = (tasks, logs, range) => {
  const scoped = tasks.filter((task) => inRange(task.createDate, range) || inRange(task.updatedAt, range));
  const completed = scoped.filter((task) => task.status === "已完成");
  const pending = scoped.filter((task) => task.status !== "已完成" && task.status !== "已取消");
  const overdue = scoped.filter(isOverdue);
  const byType = scoped.reduce((acc, task) => {
    acc[task.type] = (acc[task.type] || 0) + 1;
    return acc;
  }, {});
  const byDepartment = scoped.reduce((acc, task) => {
    const key = task.department || "未填写";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const costTotal = scoped.reduce((sum, task) => sum + (Number(task.cost) || 0), 0);
  const important = scoped
    .filter((task) => task.status !== "已完成" || isOverdue(task))
    .slice(0, 8)
    .map((task) => `${task.title}｜${task.status}｜${formatDatePart(task.dueDate)}`);
  const recentLogs = logs.filter((log) => inRange(log.logTime.slice(0, 10), range));
  return { scoped, completed, pending, overdue, byType, byDepartment, costTotal, important, recentLogs };
};

const buildReportText = (tasks, logs, range) => {
  const stats = summaryForReport(tasks, logs, range);
  const lines = [
    "医学装备科月度工作报告",
    `统计周期：${range.start} 至 ${range.end}`,
    `本期新增任务 ${stats.scoped.length} 项，完成 ${stats.completed.length} 项，未完成 ${stats.pending.length} 项，超期 ${stats.overdue.length} 项。`,
    `费用合计：${formatMoney(String(stats.costTotal))} 元`,
    "",
    "任务类型分布：",
    ...Object.entries(stats.byType).map(([key, value]) => `- ${key}：${value} 项`),
    "",
    "科室分布：",
    ...Object.entries(stats.byDepartment).map(([key, value]) => `- ${key}：${value} 项`),
    "",
    "重点事项：",
    ...(stats.important.length ? stats.important.map((item, index) => `${index + 1}. ${item}`) : ["1. 暂无"]),
    "",
    "最近处理记录：",
    ...(stats.recentLogs.length
      ? stats.recentLogs.slice(0, 10).map((log) => `${formatDateTimePart(log.logTime)} ｜ ${log.operator} ｜ ${log.logContent}`)
      : ["暂无"]),
  ];
  return lines.join("\n");
};

const formatTaskBadge = (task) => {
  if (isOverdue(task)) return "超期";
  if (isDueToday(task)) return "今日到期";
  if (isReminderToday(task)) return "今日提醒";
  if (isWithinThreeDays(task)) return "3天内到期";
  if (isReminderSoon(task)) return "即将提醒";
  return task.status;
};

module.exports = {
  defaultTaskTypes,
  defaultTaskStatuses,
  uid,
  emptyTask,
  formatDatePart,
  formatDateTimePart,
  formatMoney,
  taskCode,
  isOverdue,
  isDueToday,
  isWithinThreeDays,
  isReminderToday,
  isReminderSoon,
  sortTasks,
  buildMonthRange,
  inRange,
  getAllowedStatusTransitions,
  summaryForReport,
  buildReportText,
  formatTaskBadge,
};
