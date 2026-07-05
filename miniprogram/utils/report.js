const { buildMonthRange, buildReportText, summaryForReport, formatMoney, formatDatePart } = require("./task");

const buildMonthlySummary = (tasks, logs, range = buildMonthRange()) => {
  const stats = summaryForReport(tasks, logs, range);
  return {
    range,
    stats,
    title: "医学装备科月度工作报告",
    text: buildReportText(tasks, logs, range),
    headline: `本期新增 ${stats.scoped.length} 项，完成 ${stats.completed.length} 项，超期 ${stats.overdue.length} 项`,
    costText: `费用合计 ${formatMoney(String(stats.costTotal))} 元`,
  };
};

const toCsvRows = (tasks) => {
  const header = ["编号", "标题", "类型", "科室", "负责人", "状态", "截止日期", "完成日期", "费用"];
  const rows = tasks.map((task) => [
    task.id,
    task.title,
    task.type,
    task.department,
    task.owner,
    task.status,
    formatDatePart(task.dueDate),
    formatDatePart(task.finishDate),
    task.cost || "0",
  ]);
  return [header, ...rows];
};

const csvEscape = (value) => {
  const text = String(value ?? "");
  if (/[,"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const toCsvText = (rows) => rows.map((row) => row.map(csvEscape).join(",")).join("\n");

module.exports = {
  buildMonthlySummary,
  toCsvRows,
  toCsvText,
};
