import type { ReportRange, Task, TaskLog, TaskStatus, TaskType } from "./types";

export const formatDateTime = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const formatDate = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const parseDate = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const isOverdue = (task: Task) => {
  if (task.status === "已完成" || task.status === "已取消") return false;
  const due = parseDate(task.dueDate);
  if (!due) return false;
  const today = startOfToday();
  due.setHours(23, 59, 59, 999);
  return due < today;
};

export const isDueToday = (task: Task) => {
  const due = parseDate(task.dueDate);
  if (!due) return false;
  return due.toDateString() === startOfToday().toDateString();
};

export const isWithinThreeDays = (task: Task) => {
  if (task.status === "已完成" || task.status === "已取消") return false;
  const due = parseDate(task.dueDate);
  if (!due) return false;
  const diff = due.getTime() - startOfToday().getTime();
  return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
};

export const isReminderToday = (task: Task) => {
  const remind = parseDate(task.remindDate);
  if (!remind) return false;
  return remind.toDateString() === startOfToday().toDateString();
};

export const isReminderSoon = (task: Task) => {
  if (task.status === "已完成" || task.status === "已取消") return false;
  const remind = parseDate(task.remindDate);
  if (!remind) return false;
  const diff = remind.getTime() - startOfToday().getTime();
  return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
};

export const sortTasks = (tasks: Task[]) =>
  [...tasks].sort((a, b) => {
    const weight = (task: Task) => {
      if (isOverdue(task)) return 0;
      if (isDueToday(task)) return 1;
      return 2;
    };
    const diff = weight(a) - weight(b);
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

export const buildMonthRange = (base = new Date()): ReportRange => {
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

export const inRange = (value: string, range: ReportRange) => {
  const date = parseDate(value);
  if (!date) return false;
  const start = parseDate(range.start);
  const end = parseDate(range.end);
  if (!start || !end) return false;
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
};

export const emptyTask = (overrides: Partial<Task> = {}): Task => ({
  id: "",
  title: "",
  type: "设备维修" as TaskType,
  department: "",
  equipmentName: "",
  equipmentCode: "",
  description: "",
  owner: "",
  status: "待处理" as TaskStatus,
  createDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  remindDate: "",
  finishDate: "",
  result: "",
  cost: "",
  vendor: "",
  acceptancePerson: "",
  remark: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const formatMoney = (value: string) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return value || "0";
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const taskCode = (task: Task) => {
  const datePart = task.createDate ? task.createDate.replace(/-/g, "") : "00000000";
  const tail = task.id.slice(-4).toUpperCase();
  return `ME-${datePart}-${tail}`;
};

export const getAllowedStatusTransitions = (status: Task["status"], role: "admin" | "user"): Task["status"][] => {
  if (role === "admin") {
    return ["待处理", "处理中", "等待配件", "等待厂家", "已完成", "已取消"];
  }
  if (status === "已完成" || status === "已取消") return [] as const;
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

export const summaryForReport = (tasks: Task[], logs: TaskLog[], range: ReportRange) => {
  const scoped = tasks.filter((task) => inRange(task.createDate, range) || inRange(task.updatedAt, range));
  const completed = scoped.filter((task) => task.status === "已完成");
  const pending = scoped.filter((task) => task.status !== "已完成" && task.status !== "已取消");
  const overdue = scoped.filter(isOverdue);
  const byType = scoped.reduce<Record<string, number>>((acc, task) => {
    acc[task.type] = (acc[task.type] ?? 0) + 1;
    return acc;
  }, {});
  const byDepartment = scoped.reduce<Record<string, number>>((acc, task) => {
    const key = task.department || "未填写";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const costTotal = scoped.reduce((sum, task) => sum + (Number(task.cost) || 0), 0);
  const important = scoped
    .filter((task) => task.status !== "已完成" || isOverdue(task))
    .slice(0, 8)
    .map((task) => `${task.title}（${task.status}）`);
  const recentLogs = logs.filter((log) => inRange(log.logTime.slice(0, 10), range));
  return { scoped, completed, pending, overdue, byType, byDepartment, costTotal, important, recentLogs };
};
