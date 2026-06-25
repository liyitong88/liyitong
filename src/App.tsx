import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  defaultTaskTypes,
  loadAttachments,
  loadLogs,
  loadSession,
  loadTasks,
  loadUsers,
  loadTaskPrefs,
  normalizeTaskPrefs,
  normalizeTask,
  saveAttachments,
  saveLogs,
  saveSession,
  saveTaskPrefs,
  saveTasks,
  saveUsers,
  sha256,
  uid,
} from "./storage";
import type { Attachment, SessionUser, Task, TaskLog, User } from "./types";
import {
  buildMonthRange,
  emptyTask,
  formatDate,
  formatDateTime,
  formatMoney,
  inRange,
  isDueToday,
  isOverdue,
  isReminderSoon,
  isReminderToday,
  isWithinThreeDays,
  getAllowedStatusTransitions,
  sortTasks,
  taskCode,
  summaryForReport,
} from "./utils";

type View = "dashboard" | "tasks" | "reports" | "audit" | "users";

const initialAdminPassword = "admin123";

const todayString = () => new Date().toISOString().slice(0, 10);
const dateOffset = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const seedUsers = async () => {
  const users = loadUsers();
  if (users.length > 0) return;
  const passwordHash = await sha256(initialAdminPassword);
  saveUsers([
    {
      id: uid(),
      username: "admin",
      passwordHash,
      role: "admin",
      createdAt: new Date().toISOString(),
    },
  ]);
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<SessionUser | null>(() => loadSession());
  const [view, setView] = useState<View>("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [search, setSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditType, setAuditType] = useState("全部");
  const [auditOperator, setAuditOperator] = useState("全部");
  const [auditStart, setAuditStart] = useState("");
  const [auditEnd, setAuditEnd] = useState("");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [typeFilter, setTypeFilter] = useState("全部");
  const [deptFilter, setDeptFilter] = useState("全部");
  const [ownerFilter, setOwnerFilter] = useState("全部");
  const [dateFilter, setDateFilter] = useState("");
  const [taskScope, setTaskScope] = useState("全部");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [message, setMessage] = useState("");
  const [taskDraft, setTaskDraft] = useState<Task>(() => emptyTask({ createDate: todayString() }));
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskMode, setTaskMode] = useState<"create" | "edit">("create");
  const [logDraft, setLogDraft] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeDraft, setCompleteDraft] = useState({
    finishDate: todayString(),
    result: "",
    cost: "0",
    vendor: "",
    acceptancePerson: "",
    remark: "",
  });
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [userDraft, setUserDraft] = useState({ username: "", password: "", role: "user" as User["role"] });
  const [reportRange, setReportRange] = useState(() => buildMonthRange());
  const [taskPrefs, setTaskPrefs] = useState(() => loadTaskPrefs());
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void (async () => {
      await seedUsers();
      setTasks(loadTasks());
      setLogs(loadLogs());
      setAttachments(loadAttachments());
      setUsers(loadUsers());
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveTasks(tasks);
  }, [ready, tasks]);

  useEffect(() => {
    if (!ready) return;
    saveLogs(logs);
  }, [ready, logs]);

  useEffect(() => {
    if (!ready) return;
    saveAttachments(attachments);
  }, [ready, attachments]);

  useEffect(() => {
    if (!ready) return;
    saveUsers(users);
  }, [ready, users]);

  useEffect(() => {
    if (!ready) return;
    saveSession(session);
  }, [ready, session]);

  useEffect(() => {
    if (!ready) return;
    saveTaskPrefs(taskPrefs);
  }, [ready, taskPrefs]);

  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) {
      setSelectedTaskId(sortTasks(tasks)[0].id);
    }
  }, [tasks, selectedTaskId]);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedTaskLocked = Boolean(selectedTask && (selectedTask.status === "已完成" || selectedTask.status === "已取消"));
  const currentRole = session?.role ?? "user";
  const canEditSelectedTask = Boolean(selectedTask && (currentRole === "admin" || !selectedTaskLocked));
  const allowedStatusTransitions: Task["status"][] = selectedTask
    ? getAllowedStatusTransitions(selectedTask.status, currentRole)
    : [];

  const taskLogs = useMemo(
    () => logs.filter((item) => item.taskId === selectedTaskId).sort((a, b) => b.logTime.localeCompare(a.logTime)),
    [logs, selectedTaskId],
  );

  const taskAttachments = useMemo(
    () => attachments.filter((item) => item.taskId === selectedTaskId),
    [attachments, selectedTaskId],
  );

  function matchesTaskScope(task: Task, scope: string) {
    if (scope === "今日提醒") return isReminderToday(task);
    if (scope === "即将提醒") return isReminderSoon(task);
    if (scope === "今日待办") return isReminderToday(task) || isDueToday(task);
    if (scope === "今日到期") return isDueToday(task);
    if (scope === "超期任务") return isOverdue(task);
    return true;
  }

  const recentActivity = useMemo(
    () =>
      logs
        .slice()
        .sort((a, b) => b.logTime.localeCompare(a.logTime))
        .slice(0, 6)
        .map((log) => {
          const task = tasks.find((item) => item.id === log.taskId);
          return {
            ...log,
            taskTitle: task?.title ?? "已删除任务",
          };
        }),
    [logs, tasks],
  );

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortTasks(
      tasks.filter((task) => {
        if (!matchesTaskScope(task, taskScope)) return false;
        if (statusFilter !== "全部" && task.status !== statusFilter) return false;
        if (typeFilter !== "全部" && task.type !== typeFilter) return false;
        if (deptFilter !== "全部" && task.department !== deptFilter) return false;
        if (ownerFilter !== "全部" && task.owner !== ownerFilter) return false;
        if (dateFilter && task.dueDate !== dateFilter && task.createDate !== dateFilter) return false;
        if (!q) return true;
        return [taskCode(task), task.title, task.equipmentName, task.equipmentCode].some((text) =>
          text.toLowerCase().includes(q),
        );
      }),
    );
  }, [tasks, search, statusFilter, typeFilter, deptFilter, ownerFilter, dateFilter, taskScope]);

  const visibleTaskOrder = filteredTasks.length > 0 ? filteredTasks : sortTasks(tasks);
  const selectedTaskIndex = visibleTaskOrder.findIndex((task) => task.id === selectedTaskId);

  const dashboardCounts = useMemo(() => {
    const active = tasks.filter((task) => task.status !== "已完成" && task.status !== "已取消");
    return {
      remindToday: active.filter(isReminderToday).length,
      remindSoon: active.filter(isReminderSoon).length,
      todayTodo: active.filter((task) => isReminderToday(task) || isDueToday(task)).length,
      soon: active.filter(isWithinThreeDays).length,
      overdue: active.filter(isOverdue).length,
    };
  }, [tasks]);

  const reminderTasks = useMemo(() => {
    return sortTasks(tasks)
      .filter((task) => isOverdue(task) || isDueToday(task) || isWithinThreeDays(task) || isReminderSoon(task))
      .slice(0, 8);
  }, [tasks]);

  const todayTodoTasks = useMemo(() => {
    return sortTasks(tasks)
      .filter((task) => task.status !== "已完成" && task.status !== "已取消")
      .filter((task) => isReminderToday(task) || isDueToday(task))
      .slice(0, 6);
  }, [tasks]);

  const departmentSuggestions = useMemo(
    () => Array.from(new Set([taskPrefs.department, ...tasks.map((task) => task.department)])).filter(Boolean),
    [taskPrefs.department, tasks],
  );
  const ownerSuggestions = useMemo(
    () => Array.from(new Set([taskPrefs.owner, ...tasks.map((task) => task.owner)])).filter(Boolean),
    [taskPrefs.owner, tasks],
  );
  const equipmentNameSuggestions = useMemo(
    () => Array.from(new Set([taskPrefs.equipmentName, ...tasks.map((task) => task.equipmentName)])).filter(Boolean),
    [taskPrefs.equipmentName, tasks],
  );
  const equipmentCodeSuggestions = useMemo(
    () => Array.from(new Set([taskPrefs.equipmentCode, ...tasks.map((task) => task.equipmentCode)])).filter(Boolean),
    [taskPrefs.equipmentCode, tasks],
  );

  const reportStats = useMemo(() => summaryForReport(tasks, logs, reportRange), [tasks, logs, reportRange]);

  const auditRows = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return logs
      .slice()
      .sort((a, b) => b.logTime.localeCompare(a.logTime))
      .map((log) => {
        const task = tasks.find((item) => item.id === log.taskId);
        const actionType =
          log.logContent.includes("创建") ? "创建" :
          log.logContent.includes("更新") ? "更新" :
          log.logContent.includes("完成") ? "闭环" :
          log.logContent.includes("附件") ? "附件" :
          log.logContent.includes("状态") ? "状态" :
          "记录";
        return {
          ...log,
          taskTitle: task?.title ?? "已删除任务",
          taskCode: task ? taskCode(task) : "-",
          taskStatus: task?.status ?? "-",
          actionType,
        };
      })
      .filter((row) => {
        if (auditType !== "全部" && row.actionType !== auditType) return false;
        if (auditOperator !== "全部" && row.operator !== auditOperator) return false;
        if (auditStart && row.logTime.slice(0, 10) < auditStart) return false;
        if (auditEnd && row.logTime.slice(0, 10) > auditEnd) return false;
        if (!q) return true;
        return [row.taskTitle, row.taskCode, row.logContent, row.operator, row.taskStatus].some((text) =>
          text.toLowerCase().includes(q),
        );
      });
  }, [auditSearch, auditOperator, auditType, auditStart, auditEnd, logs, tasks]);

  const auditOperatorOptions = useMemo(() => ["全部", ...Array.from(new Set(logs.map((log) => log.operator))).filter(Boolean)], [logs]);

  const reportNarrative = useMemo(() => {
    const newCount = tasks.filter((task) => inRange(task.createDate, reportRange)).length;
    const repairCount = reportStats.byType["设备维修"] ?? 0;
    const purchaseCount = (reportStats.byType["设备采购"] ?? 0) + (reportStats.byType["耗材采购"] ?? 0);
    const calibrationCount = reportStats.byType["计量校准"] ?? 0;
    const acceptanceCount = reportStats.byType["设备验收"] ?? 0;
    const important = reportStats.important.length > 0
      ? reportStats.important.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "1. 暂无重点事项";
    const overdueList = reportStats.overdue.length > 0
      ? reportStats.overdue.slice(0, 5).map((task, index) => `${index + 1}. ${task.title}（${task.status}，截止 ${formatDate(task.dueDate)}）`).join("\n")
      : "1. 暂无遗留问题";

    return [
      "医学装备科月度工作报告",
      "",
      `统计周期：${reportRange.start} 至 ${reportRange.end}`,
      `本周期共新增任务 ${newCount} 项，完成 ${reportStats.completed.length} 项，未完成 ${reportStats.pending.length} 项，超期 ${reportStats.overdue.length} 项。`,
      `其中维修类任务 ${repairCount} 项，采购类任务 ${purchaseCount} 项，计量校准 ${calibrationCount} 项，验收事项 ${acceptanceCount} 项。`,
      `费用合计 ${formatMoney(String(reportStats.costTotal))} 元。`,
      "",
      "本月重点完成事项：",
      important,
      "",
      "目前遗留问题：",
      overdueList,
    ].join("\n");
  }, [reportRange, reportStats, tasks]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("全部");
    setTypeFilter("全部");
    setDeptFilter("全部");
    setOwnerFilter("全部");
    setDateFilter("");
    setTaskScope("全部");
  };

  const returnToTaskList = () => {
    setSelectedTaskId("");
    setView("tasks");
  };

  const openTaskScope = (scope: string) => {
    setSearch("");
    setStatusFilter("全部");
    setTypeFilter("全部");
    setDeptFilter("全部");
    setOwnerFilter("全部");
    setDateFilter("");
    setTaskScope(scope);
    const nextSelected = sortTasks(tasks.filter((task) => matchesTaskScope(task, scope)))[0];
    setSelectedTaskId(nextSelected?.id ?? "");
    setView("tasks");
  };

  const openTaskForm = (task?: Task) => {
    if (task) {
      if (task.status === "已完成" || task.status === "已取消") {
        setMessage("已完成或已取消的任务请先由管理员处理后再编辑。");
        return;
      }
      setTaskMode("edit");
      setTaskDraft({ ...task });
    } else {
      setTaskMode("create");
      setTaskDraft(createTaskDraft());
    }
    setTaskFormOpen(true);
  };

  const applyTaskTemplate = (type: Task["type"], title: string) => {
    setTaskMode("create");
    setTaskDraft(
      emptyTask({
        title,
        type,
        createDate: todayString(),
        dueDate: dateOffset(7),
        remindDate: dateOffset(3),
        description: "请补充具体情况。",
      }),
    );
    setTaskFormOpen(true);
    setMessage(`已套用${type}模板。`);
  };

  const duplicateSelectedTask = () => {
    if (!selectedTask) return;
    setTaskMode("create");
    setTaskDraft(
      emptyTask({
        title: `${selectedTask.title} - 复制`,
        type: selectedTask.type,
        department: selectedTask.department,
        equipmentName: selectedTask.equipmentName,
        equipmentCode: selectedTask.equipmentCode,
        description: selectedTask.description,
        owner: selectedTask.owner,
        createDate: todayString(),
        dueDate: selectedTask.dueDate || dateOffset(7),
        remindDate: selectedTask.remindDate || dateOffset(3),
        remark: selectedTask.remark,
      }),
    );
    setTaskFormOpen(true);
    setMessage("已复制为新任务，可直接修改后保存。");
  };

  const createTaskDraft = (prefs = taskPrefs) =>
    emptyTask({
      createDate: todayString(),
      dueDate: dateOffset(7),
      remindDate: dateOffset(3),
      type: (prefs.type as Task["type"]) || "设备维修",
      department: prefs.department,
      owner: prefs.owner,
      equipmentName: prefs.equipmentName,
      equipmentCode: prefs.equipmentCode,
    });

  const submitTaskForm = (keepOpen = false) => {
    if (!taskDraft.title.trim() || !taskDraft.department.trim() || !taskDraft.dueDate || !taskDraft.owner.trim()) {
      setMessage("请补齐任务标题、科室、截止日期和负责人。");
      return false;
    }
    const now = new Date().toISOString();
    if (taskMode === "create" || !taskDraft.id) {
      const taskId = uid();
      const nextTask = {
        ...taskDraft,
        id: taskId,
        createdAt: now,
        updatedAt: now,
      };
      setTasks((prev) => [nextTask, ...prev]);
      setSelectedTaskId(taskId);
      setLogs((prev) => [
        {
          id: uid(),
          taskId,
          logContent: "任务已创建。",
          operator: session?.username ?? "系统",
          logTime: now,
        },
        ...prev,
      ]);
      setMessage("任务已创建。");
    } else {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskDraft.id ? { ...taskDraft, updatedAt: now } : task)),
      );
      setLogs((prev) => [
        {
          id: uid(),
          taskId: taskDraft.id,
          logContent: "任务信息已更新。",
          operator: session?.username ?? "系统",
          logTime: now,
        },
        ...prev,
      ]);
      setMessage("任务已更新。");
    }
    const nextPrefs = {
      department: taskDraft.department,
      owner: taskDraft.owner,
      equipmentName: taskDraft.equipmentName,
      equipmentCode: taskDraft.equipmentCode,
      type: taskDraft.type,
    };
    setTaskPrefs(nextPrefs);
    if (keepOpen && taskMode === "create") {
      setTaskDraft(createTaskDraft(nextPrefs));
      setTaskFormOpen(true);
      setView("tasks");
      setMessage("任务已创建，继续新增下一条。");
      return true;
    }
    setTaskFormOpen(false);
    setView("tasks");
    return true;
  };

  const openCompleteForm = () => {
    if (!selectedTask) return;
    if (selectedTaskLocked && currentRole !== "admin") {
      setMessage("已完成任务仅管理员可重新处理。");
      return;
    }
    setCompleteDraft({
      finishDate: selectedTask.finishDate || todayString(),
      result: selectedTask.result || "",
      cost: selectedTask.cost || "0",
      vendor: selectedTask.vendor || "",
      acceptancePerson: selectedTask.acceptancePerson || session?.username || "",
      remark: selectedTask.remark || "",
    });
    setCompleteOpen(true);
  };

  const submitCompleteTask = () => {
    if (!selectedTask) return;
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((task) =>
        task.id === selectedTask.id
          ? {
              ...task,
              status: "已完成",
              finishDate: completeDraft.finishDate,
              result: completeDraft.result,
              cost: completeDraft.cost,
              vendor: completeDraft.vendor,
              acceptancePerson: completeDraft.acceptancePerson,
              remark: completeDraft.remark,
              updatedAt: now,
            }
          : task,
      ),
    );
    setLogs((prev) => [
      {
        id: uid(),
        taskId: selectedTask.id,
        logContent: "任务已完成闭环。",
        operator: session?.username ?? "系统",
        logTime: now,
      },
      ...prev,
    ]);
    setCompleteOpen(false);
    setMessage("任务已完成闭环。");
  };

  const changeStatus = (status: Task["status"]) => {
    if (!selectedTask) return;
    if (!allowedStatusTransitions.includes(status)) {
      setMessage("当前状态下不能直接切换到这个状态。");
      return;
    }
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((task) => (task.id === selectedTask.id ? { ...task, status, updatedAt: now } : task)),
    );
    setLogs((prev) => [
      {
        id: uid(),
        taskId: selectedTask.id,
        logContent: `状态变更为：${status}`,
        operator: session?.username ?? "系统",
        logTime: now,
      },
      ...prev,
    ]);
    setMessage("状态已更新。");
  };

  const addLog = () => {
    if (!selectedTaskId || !logDraft.trim()) return;
    const now = new Date().toISOString();
    setLogs((prev) => [
      {
        id: uid(),
        taskId: selectedTaskId,
        logContent: logDraft.trim(),
        operator: session?.username ?? "系统",
        logTime: now,
      },
      ...prev,
    ]);
    setTasks((prev) => prev.map((task) => (task.id === selectedTaskId ? { ...task, updatedAt: now } : task)));
    setLogDraft("");
    setMessage("处理记录已添加。");
  };

  const addAttachment = async (files: FileList | null) => {
    if (!selectedTaskId || !files || files.length === 0) return;
    const now = new Date().toISOString();
    const uploaded = await Promise.all(
      Array.from(files).map(
        (file) =>
          new Promise<Attachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: uid(),
                taskId: selectedTaskId,
                fileUrl: String(reader.result),
                fileType: file.type,
                fileName: file.name,
                uploadedAt: now,
              });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );
    setAttachments((prev) => [...uploaded, ...prev]);
    setLogs((prev) => [
      ...uploaded.map((item) => ({
        id: uid(),
        taskId: selectedTaskId,
        logContent: `上传附件：${item.fileName}`,
        operator: session?.username ?? "系统",
        logTime: now,
      })),
      ...prev,
    ]);
    setMessage(uploaded.length > 1 ? `已添加 ${uploaded.length} 个附件。` : "附件已添加。");
  };

  const doLogin = async () => {
    const username = loginForm.username.trim();
    const password = loginForm.password;
    const user = users.find((item) => item.username === username);
    if (!user) {
      setLoginError("账号或密码不正确。");
      return;
    }
    const passwordHash = await sha256(password);
    if (passwordHash !== user.passwordHash) {
      setLoginError("账号或密码不正确。");
      return;
    }
    setSession({ id: user.id, username: user.username, role: user.role });
    setLoginError("");
    setView("dashboard");
  };

  const logout = () => setSession(null);

  const openUserForm = () => {
    setUserDraft({ username: "", password: "", role: "user" });
    setUserFormOpen(true);
  };

  const submitUserForm = async () => {
    const username = userDraft.username.trim();
    const password = userDraft.password;
    if (!username || !password) {
      setMessage("请填写账号和初始密码。");
      return;
    }
    if (users.some((item) => item.username === username)) {
      setMessage("账号已存在，请更换用户名。");
      return;
    }
    const passwordHash = await sha256(password);
    setUsers((prev) => [
      {
        id: uid(),
        username,
        passwordHash,
        role: userDraft.role,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setUserFormOpen(false);
    setMessage("用户已创建。");
  };

  const seedDemoData = () => {
    if (tasks.length > 0) return;
    const now = new Date().toISOString();
    const demo: Task[] = [
      emptyTask({
        id: uid(),
        title: "CT 设备报警排查",
        type: "设备维修",
        department: "影像科",
        equipmentName: "CT-128",
        equipmentCode: "IMG-CT-001",
        description: "机房出现报警，需要联系工程师排查。",
        owner: "张工",
        status: "处理中",
        dueDate: todayString(),
        remindDate: todayString(),
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
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        remindDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        createdAt: now,
        updatedAt: now,
      }),
    ];
    setTasks(demo);
    setSelectedTaskId(demo[0].id);
    setLogs((prev) => [
      ...demo.map((task) => ({
        id: uid(),
        taskId: task.id,
        logContent: "演示任务已创建。",
        operator: "系统",
        logTime: now,
      })),
      ...prev,
    ]);
    setMessage("已生成演示数据。");
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportNarrative);
      setMessage("月报正文已复制。");
    } catch {
      setMessage("复制失败，请手动选中月报正文。");
    }
  };

  const copySelectedTaskCode = async () => {
    if (!selectedTask) return;
    try {
      await navigator.clipboard.writeText(taskCode(selectedTask));
      setMessage("任务编号已复制。");
    } catch {
      setMessage("复制失败，请手动复制任务编号。");
    }
  };

  const copySelectedTaskSummary = async () => {
    if (!selectedTask) return;
    const recentLogs = taskLogs.slice(0, 5).map((log) => `- ${formatDateTime(log.logTime)} · ${log.operator}：${log.logContent}`);
    const summary = [
      `任务编号：${taskCode(selectedTask)}`,
      `任务标题：${selectedTask.title}`,
      `任务类型：${selectedTask.type}`,
      `涉及科室：${selectedTask.department}`,
      `设备名称：${selectedTask.equipmentName || "-"}`,
      `设备编号：${selectedTask.equipmentCode || "-"}`,
      `负责人：${selectedTask.owner}`,
      `当前状态：${selectedTask.status}`,
      `创建日期：${formatDate(selectedTask.createDate)}`,
      `截止日期：${formatDate(selectedTask.dueDate)}`,
      `提醒日期：${formatDate(selectedTask.remindDate)}`,
      `完成日期：${formatDate(selectedTask.finishDate)}`,
      `处理结果：${selectedTask.result || "-"}`,
      `费用金额：${selectedTask.cost || "0"}`,
      `维修单位：${selectedTask.vendor || "-"}`,
      `验收人：${selectedTask.acceptancePerson || "-"}`,
      `备注：${selectedTask.remark || "-"}`,
      `问题描述：${selectedTask.description || "-"}`,
      `附件数量：${taskAttachments.length}`,
      "",
      "最近处理记录：",
      ...(recentLogs.length > 0 ? recentLogs : ["- 暂无处理记录"]),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      setMessage("任务摘要已复制。");
    } catch {
      setMessage("复制失败，请手动复制任务摘要。");
    }
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const taskSheet = XLSX.utils.json_to_sheet(
      tasks.map((task) => ({
        任务编号: taskCode(task),
        标题: task.title,
        类型: task.type,
        科室: task.department,
        设备名称: task.equipmentName,
        设备编号: task.equipmentCode,
        负责人: task.owner,
        状态: task.status,
        创建日期: task.createDate,
        截止日期: task.dueDate,
        提醒日期: task.remindDate,
        完成日期: task.finishDate,
        费用金额: task.cost,
        处理结果: task.result,
      })),
    );
    const logSheet = XLSX.utils.json_to_sheet(
      logs.map((log) => ({
        任务ID: log.taskId,
        处理记录: log.logContent,
        操作人: log.operator,
        时间: log.logTime,
      })),
    );
    const attachmentSheet = XLSX.utils.json_to_sheet(
      attachments.map((attachment) => ({
        任务ID: attachment.taskId,
        文件名: attachment.fileName,
        类型: attachment.fileType,
        上传时间: attachment.uploadedAt,
      })),
    );
    const summarySheet = XLSX.utils.json_to_sheet([
      { 指标: "新增任务", 数值: tasks.filter((task) => inRange(task.createDate, reportRange)).length },
      { 指标: "完成任务", 数值: reportStats.completed.length },
      { 指标: "未完成任务", 数值: reportStats.pending.length },
      { 指标: "超期任务", 数值: reportStats.overdue.length },
      { 指标: "费用合计", 数值: reportStats.costTotal },
    ]);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "报告摘要");
    XLSX.utils.book_append_sheet(workbook, taskSheet, "任务明细");
    XLSX.utils.book_append_sheet(workbook, logSheet, "处理记录");
    XLSX.utils.book_append_sheet(workbook, attachmentSheet, "附件");
    XLSX.writeFile(workbook, `医学装备科任务报告-${reportRange.start}-${reportRange.end}.xlsx`);
    setMessage("Excel 已导出。");
  };

  const exportPdf = () => {
    const win = window.open("", "_blank", "width=1024,height=900");
    if (!win) {
      setMessage("浏览器阻止了 PDF 预览窗口。");
      return;
    }
    win.document.write(`
      <html>
        <head>
          <title>医学装备科月度工作报告</title>
          <style>
            body { font-family: "Microsoft YaHei", sans-serif; padding: 32px; color: #0f172a; }
            h1 { margin: 0 0 8px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; vertical-align: top; }
            th { width: 180px; text-align: left; background: #f8fafc; }
            pre { white-space: pre-wrap; background: #f8fafc; border: 1px solid #cbd5e1; padding: 16px; border-radius: 12px; }
          </style>
        </head>
        <body>
          <h1>医学装备科月度工作报告</h1>
          <table>
            <tr><th>统计周期</th><td>${reportRange.start} 至 ${reportRange.end}</td></tr>
            <tr><th>任务编号</th><td>${selectedTask ? taskCode(selectedTask) : "-"}</td></tr>
            <tr><th>新增任务</th><td>${tasks.filter((task) => inRange(task.createDate, reportRange)).length}</td></tr>
            <tr><th>完成任务</th><td>${reportStats.completed.length}</td></tr>
            <tr><th>未完成任务</th><td>${reportStats.pending.length}</td></tr>
            <tr><th>超期任务</th><td>${reportStats.overdue.length}</td></tr>
            <tr><th>费用合计</th><td>${formatMoney(String(reportStats.costTotal))}</td></tr>
          </table>
          <h2>报告正文</h2>
          <pre>${reportNarrative.replace(/</g, "&lt;")}</pre>
          <script>window.onload = function () { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const exportAuditExcel = async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(
      auditRows.map((row) => ({
        任务编号: row.taskCode,
        任务标题: row.taskTitle,
        动作类型: row.actionType,
        当前状态: row.taskStatus,
        操作人: row.operator,
        记录内容: row.logContent,
        时间: row.logTime,
      })),
    );
    XLSX.utils.book_append_sheet(workbook, sheet, "审计记录");
    XLSX.writeFile(workbook, `医学装备科审计记录-${todayString()}.xlsx`);
    setMessage("审计记录已导出。");
  };

  const exportVisibleTasks = async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(
      filteredTasks.map((task) => ({
        任务编号: taskCode(task),
        标题: task.title,
        类型: task.type,
        科室: task.department,
        设备名称: task.equipmentName,
        设备编号: task.equipmentCode,
        负责人: task.owner,
        状态: task.status,
        创建日期: task.createDate,
        截止日期: task.dueDate,
        提醒日期: task.remindDate,
      })),
    );
    XLSX.utils.book_append_sheet(workbook, sheet, "筛选任务");
    XLSX.writeFile(workbook, `医学装备科任务筛选-${todayString()}.xlsx`);
    setMessage("当前筛选结果已导出。");
  };

  const exportBackup = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks,
      logs,
      attachments,
      users,
      session,
      taskPrefs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `医学装备科备份-${todayString()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage("备份文件已导出。");
  };

  const importBackupFile = async (file: File | null) => {
    if (!file) return;
    const ok = window.confirm("导入备份会覆盖当前浏览器里的任务、日志、附件、用户和登录状态，是否继续？");
    if (!ok) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as {
        version?: number;
        tasks?: Task[];
        logs?: TaskLog[];
        attachments?: Attachment[];
        users?: User[];
        session?: SessionUser | null;
        taskPrefs?: typeof taskPrefs;
      };
      const nextTasks = Array.isArray(data.tasks) ? data.tasks.map((task) => normalizeTask(task)) : [];
      setTasks(nextTasks);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setSession(data.session ?? null);
      if (data.taskPrefs) {
        setTaskPrefs(normalizeTaskPrefs(data.taskPrefs));
      }
      const firstTaskId = nextTasks.length > 0 ? nextTasks[0].id : "";
      setSelectedTaskId(firstTaskId);
      setMessage(data.version ? `备份已导入，版本 ${data.version}。` : "备份已导入。");
    } catch {
      setMessage("备份文件读取失败，请确认文件格式正确。");
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  };

  if (!ready) {
    return (
      <div className="shell center">
        <div className="card hero">
          <div className="badge">MedEquip Task Tracker</div>
          <h1>医学装备科任务闭环管理系统</h1>
          <p className="muted">正在初始化本地数据...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="shell auth-shell">
        <div className="auth-card">
          <div className="brand-pill">医学装备科随身任务管理</div>
          <h1>任务闭环管理系统</h1>
          <p className="muted">默认管理员账号：<code>admin</code> / <code>admin123</code></p>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void doLogin(); }}>
            <label>
              账号
              <input
                autoFocus
                value={loginForm.username}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
              />
            </label>
            <label>
              密码
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </label>
          </form>
          {loginError ? <div className="alert error">{loginError}</div> : null}
          <button className="primary" onClick={() => void doLogin()}>
            登录进入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">MedEquip Task Tracker</div>
          <h1>医学装备科任务闭环管理系统</h1>
          <p className="muted">
            当前用户：{session.username} · {session.role === "admin" ? "管理员" : "普通用户"}
          </p>
        </div>
        <div className="topbar-actions">
          {view !== "dashboard" ? (
            <button className="ghost" onClick={() => setView("dashboard")}>
              返回首页
            </button>
          ) : null}
          <button className="ghost" onClick={logout}>
            退出登录
          </button>
        </div>
      </header>

      <section className="stats-grid">
        <button className="stat-card stat-card-button" onClick={() => openTaskScope("今日提醒")}>
          <span>今日提醒</span>
          <strong>{dashboardCounts.remindToday}</strong>
        </button>
        <button className="stat-card stat-card-button" onClick={() => openTaskScope("即将提醒")}>
          <span>即将提醒</span>
          <strong>{dashboardCounts.remindSoon}</strong>
        </button>
        <button className="stat-card stat-card-button danger" onClick={() => openTaskScope("超期任务")}>
          <span>超期任务</span>
          <strong>{dashboardCounts.overdue}</strong>
        </button>
        <button className="stat-card stat-card-button" onClick={() => openTaskScope("今日待办")}>
          <span>今日待办</span>
          <strong>{dashboardCounts.todayTodo}</strong>
        </button>
      </section>

      <section className="panel reminder-panel">
        <div className="panel-head">
          <h2>优先提醒</h2>
          <span className="muted">超期、提醒日期、3 天内到期</span>
        </div>
        <div className="task-list">
          {reminderTasks.length > 0 ? (
            reminderTasks.map((task) => (
              <button key={task.id} className="task-row" onClick={() => { setSelectedTaskId(task.id); setView("tasks"); }}>
                <div>
                  <strong>{task.title}</strong>
                  <p>{taskCode(task)} · {task.department} · {task.owner} · 提醒 {formatDate(task.remindDate)}</p>
                </div>
                <div className="row-meta">
                  <span className="pill">{task.status}</span>
                  <span className={isOverdue(task) ? "pill danger" : isReminderToday(task) || isReminderSoon(task) ? "pill warning" : "pill"}>
                    {isOverdue(task) ? "超期" : isReminderToday(task) ? "今日提醒" : isReminderSoon(task) ? "即将提醒" : "3 天内到期"}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="alert">当前没有需要优先提醒的任务。</div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>今日待办</h2>
          <button className="ghost" onClick={() => openTaskScope("今日待办")}>
            查看全部
          </button>
        </div>
        <div className="task-list">
          {todayTodoTasks.length > 0 ? (
            todayTodoTasks.map((task) => (
              <button key={task.id} className="task-row" onClick={() => { setSelectedTaskId(task.id); setView("tasks"); }}>
                <div>
                  <strong>{task.title}</strong>
                  <p>{taskCode(task)} · {task.department} · {task.owner} · {formatDate(task.dueDate)}</p>
                </div>
                <div className="row-meta">
                  <span className="pill">{task.status}</span>
                  <span className={isDueToday(task) ? "pill warning" : "pill"}>{isReminderToday(task) ? "今日提醒" : "今日到期"}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="alert">今天没有待办任务。</div>
          )}
        </div>
      </section>

      <nav className="tabs desktop-tabs">
        {[
          ["dashboard", "首页"],
          ["tasks", "任务"],
          ["reports", "报告"],
          ["audit", "审计"],
          ["users", "用户"],
        ].map(([key, label]) => (
          <button key={key} className={view === key ? "tab active" : "tab"} onClick={() => setView(key as View)}>
            {label}
          </button>
        ))}
      </nav>

      <nav className="mobile-tabs">
        {[
          ["dashboard", "首页"],
          ["tasks", "任务"],
          ["reports", "报告"],
          ["audit", "审计"],
          ["users", "用户"],
        ].map(([key, label]) => (
          <button key={key} className={view === key ? "mobile-tab active" : "mobile-tab"} onClick={() => setView(key as View)}>
            {label}
          </button>
        ))}
      </nav>

      {message ? <div className="alert success">{message}</div> : null}

      {view === "dashboard" ? (
        <div className="layout">
          <section className="panel">
            <div className="panel-head">
              <h2>最近任务</h2>
              <button className="ghost" onClick={seedDemoData}>
                填充演示数据
              </button>
            </div>
            <div className="task-list">
              {sortTasks(tasks)
                .slice(0, 6)
                .map((task) => (
                  <button key={task.id} className={selectedTaskId === task.id ? "task-row selected" : "task-row"} onClick={() => { setSelectedTaskId(task.id); setView("tasks"); }}>
                    <div>
                      <strong>{task.title}</strong>
                      <p>
                        {task.department} · {task.type}
                      </p>
                    </div>
                    <div className="row-meta">
                      <span className="pill">{task.status}</span>
                      <span className={isOverdue(task) ? "pill danger" : isDueToday(task) ? "pill warning" : "pill"}>
                        {isOverdue(task) ? "超期" : isDueToday(task) ? "今日到期" : formatDate(task.dueDate)}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>最近操作</h2>
              <span className="muted">最新 6 条记录</span>
            </div>
            <div className="timeline">
              {recentActivity.length > 0 ? (
                recentActivity.map((log) => (
                  <div key={log.id} className="timeline-item">
                    <strong>{log.taskTitle}</strong>
                    <p>
                      {log.logContent} · {log.operator} · {formatDateTime(log.logTime)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="alert">还没有操作记录，先创建一条任务试试。</div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {view === "tasks" ? (
        <div className="layout tasks-layout">
          <section className="panel wide">
            <div className="panel-head">
              <div>
                <h2>任务列表</h2>
                <span className="muted">
                  共 {tasks.length} 条，当前显示 {filteredTasks.length} 条
                </span>
              </div>
              <div className="row-meta">
                <button className="ghost" onClick={() => void exportVisibleTasks()}>
                  导出当前
                </button>
                <button className="ghost" onClick={() => openTaskForm()}>
                  新增任务
                </button>
              </div>
            </div>
            <div className="scope-row">
              {["全部", "今日提醒", "即将提醒", "今日待办", "今日到期", "超期任务"].map((item) => (
                <button
                  key={item}
                  className={taskScope === item ? "scope-pill active" : "scope-pill"}
                  onClick={() => openTaskScope(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="filters">
              <input placeholder="搜索标题、设备名称或编号" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                {["全部", "待处理", "处理中", "等待配件", "等待厂家", "已完成", "已取消"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                {["全部", ...defaultTaskTypes].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                {["全部", ...Array.from(new Set(tasks.map((task) => task.department))).filter(Boolean)].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
                {["全部", ...Array.from(new Set(tasks.map((task) => task.owner))).filter(Boolean)].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
              <button className="ghost" onClick={clearFilters}>
                重置筛选
              </button>
            </div>

            <div className="task-list">
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <button
                    key={task.id}
                    className={selectedTaskId === task.id ? "task-row selected" : "task-row"}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div>
                      <strong>{task.title}</strong>
                      <p>
                        {taskCode(task)} · {task.department} · {task.equipmentName || "无设备名称"}
                        {task.equipmentCode ? ` · ${task.equipmentCode}` : ""}
                      </p>
                    </div>
                    <div className="row-meta">
                      <span className="pill">{task.type}</span>
                      <span className={isOverdue(task) ? "pill danger" : isDueToday(task) ? "pill warning" : "pill"}>
                        {isOverdue(task) ? "超期" : isDueToday(task) ? "今日到期" : formatDate(task.dueDate)}
                      </span>
                      <span className="pill">{task.status}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="alert">没有找到符合条件的任务。</div>
              )}
            </div>
          </section>

          <section className="panel detail-panel">
            {selectedTask ? (
              <>
                <div className="panel-head">
                  <h2>{selectedTask.title}</h2>
                  <div className="row-meta">
                    <button className="ghost" onClick={returnToTaskList}>
                      返回列表
                    </button>
                    <span className={isOverdue(selectedTask) ? "pill danger" : isDueToday(selectedTask) ? "pill warning" : "pill"}>
                      {isOverdue(selectedTask) ? "超期" : isDueToday(selectedTask) ? "今日到期" : "正常"}
                    </span>
                    <button className="ghost" onClick={copySelectedTaskCode}>
                      复制编号
                    </button>
                    <button className="ghost" onClick={copySelectedTaskSummary}>
                      复制摘要
                    </button>
                  </div>
                </div>

                <div className="detail-grid">
                  <Info label="任务编号" value={taskCode(selectedTask)} />
                  <Info label="任务类型" value={selectedTask.type} />
                  <Info label="涉及科室" value={selectedTask.department} />
                  <Info label="设备名称" value={selectedTask.equipmentName || "-"} />
                  <Info label="设备编号" value={selectedTask.equipmentCode || "-"} />
                  <Info label="负责人" value={selectedTask.owner} />
                  <Info label="当前状态" value={selectedTask.status} />
                  <Info label="截止日期" value={formatDate(selectedTask.dueDate)} />
                  <Info label="提醒日期" value={formatDate(selectedTask.remindDate)} />
                </div>

                <section className="section">
                  <h3>问题描述</h3>
                  <p className="muted">{selectedTask.description || "暂无描述"}</p>
                </section>

                <section className="section">
                  <h3>处理记录</h3>
                  <div className="stack">
                    <textarea rows={3} value={logDraft} onChange={(e) => setLogDraft(e.target.value)} placeholder="添加一条处理记录，例如：联系厂家、工程师到场、更换配件..." />
                    <button className="primary" onClick={addLog}>
                      添加记录
                    </button>
                  </div>
                  <div className="timeline">
                    {taskLogs.map((log) => (
                      <div key={log.id} className="timeline-item">
                        <strong>{log.logContent}</strong>
                        <p>
                          {log.operator} · {formatDateTime(log.logTime)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="section">
                  <h3>附件</h3>
                  <input type="file" accept="image/*,.pdf" multiple onChange={(e) => void addAttachment(e.target.files)} />
                  <p className="muted">支持一次选择多个图片或 PDF 文件。</p>
                  <div className="attachment-grid">
                    {taskAttachments.map((attachment) => (
                      <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="attachment-card">
                        <strong>{attachment.fileName}</strong>
                        <span>{formatDateTime(attachment.uploadedAt)}</span>
                      </a>
                    ))}
                  </div>
                </section>

                <section className="section action-row">
                  <button
                    className="ghost"
                    onClick={() => {
                      const prevTask = selectedTaskIndex > 0 ? visibleTaskOrder[selectedTaskIndex - 1] : null;
                      if (prevTask) setSelectedTaskId(prevTask.id);
                    }}
                    disabled={selectedTaskIndex <= 0}
                  >
                    上一条
                  </button>
                  <button
                    className="ghost"
                    onClick={() => {
                      const nextTask =
                        selectedTaskIndex >= 0 && selectedTaskIndex < visibleTaskOrder.length - 1
                          ? visibleTaskOrder[selectedTaskIndex + 1]
                          : null;
                      if (nextTask) setSelectedTaskId(nextTask.id);
                    }}
                    disabled={selectedTaskIndex < 0 || selectedTaskIndex >= visibleTaskOrder.length - 1}
                  >
                    下一条
                  </button>
                  <button className="ghost" onClick={() => openTaskForm(selectedTask)} disabled={!canEditSelectedTask}>
                    编辑任务
                  </button>
                  <button className="ghost" onClick={duplicateSelectedTask}>
                    复制为新任务
                  </button>
                  {allowedStatusTransitions.includes("处理中") ? (
                    <button className="primary" onClick={() => changeStatus("处理中")}>
                      处理中
                    </button>
                  ) : null}
                  {allowedStatusTransitions.includes("等待配件") ? (
                    <button className="ghost" onClick={() => changeStatus("等待配件")}>
                      等待配件
                    </button>
                  ) : null}
                  {allowedStatusTransitions.includes("等待厂家") ? (
                    <button className="ghost" onClick={() => changeStatus("等待厂家")}>
                      等待厂家
                    </button>
                  ) : null}
                  {allowedStatusTransitions.includes("已完成") ? (
                    <button className="success" onClick={openCompleteForm}>
                      完成闭环
                    </button>
                  ) : null}
                  {allowedStatusTransitions.includes("已取消") ? (
                    <button className="danger-btn" onClick={() => changeStatus("已取消")}>
                      取消任务
                    </button>
                  ) : null}
                </section>
                {selectedTaskLocked ? (
                  <div className="alert">
                    该任务已完成或已取消，普通用户仅可查看。需要调整请联系管理员。
                  </div>
                ) : null}
              </>
            ) : (
              <div className="muted">请选择一条任务查看详情。</div>
            )}
          </section>
        </div>
      ) : null}

      {view === "reports" ? (
        <section className="panel">
          <div className="panel-head">
            <h2>统计报告</h2>
            <div className="row-meta">
              <button className="ghost" onClick={copyReport}>
                复制月报
              </button>
              <button className="ghost" onClick={exportPdf}>
                导出 PDF
              </button>
              <button className="primary" onClick={() => void exportExcel()}>
                导出 Excel
              </button>
            </div>
          </div>

          <div className="filters">
            <input type="date" value={reportRange.start} onChange={(e) => setReportRange((prev) => ({ ...prev, start: e.target.value }))} />
            <input type="date" value={reportRange.end} onChange={(e) => setReportRange((prev) => ({ ...prev, end: e.target.value }))} />
            <button className="ghost" onClick={() => setReportRange(buildMonthRange())}>
              本月
            </button>
            <button className="ghost" onClick={() => setReportRange({ start: todayString(), end: todayString() })}>
              今天
            </button>
          </div>

          <section className="subpanel">
            <h3>月度报告正文</h3>
            <textarea rows={12} readOnly value={reportNarrative} />
          </section>

          <div className="report-grid">
            <ReportStat label="新增任务" value={tasks.filter((task) => inRange(task.createDate, reportRange)).length} />
            <ReportStat label="完成任务" value={reportStats.completed.length} />
            <ReportStat label="未完成任务" value={reportStats.pending.length} />
            <ReportStat label="超期任务" value={reportStats.overdue.length} />
            <ReportStat label="费用合计" value={formatMoney(String(reportStats.costTotal))} />
            <ReportStat label="处理记录" value={reportStats.recentLogs.length} />
          </div>

          <div className="report-columns">
            <section className="subpanel">
              <h3>任务类型分布</h3>
              <div className="stack">
                {Object.entries(reportStats.byType).length > 0 ? (
                  Object.entries(reportStats.byType).map(([key, value]) => <BarRow key={key} label={key} value={value} />)
                ) : (
                  <p className="muted">暂无数据</p>
                )}
              </div>
            </section>

            <section className="subpanel">
              <h3>科室分布</h3>
              <div className="stack">
                {Object.entries(reportStats.byDepartment).length > 0 ? (
                  Object.entries(reportStats.byDepartment).map(([key, value]) => <BarRow key={key} label={key} value={value} />)
                ) : (
                  <p className="muted">暂无数据</p>
                )}
              </div>
            </section>
          </div>

          <section className="subpanel">
            <h3>重点事项</h3>
            <ul className="bullet-list">
              {reportStats.important.length > 0 ? (
                reportStats.important.map((item) => <li key={item}>{item}</li>)
              ) : (
                <li className="muted">暂无重点事项</li>
              )}
            </ul>
          </section>
        </section>
      ) : null}

      {view === "audit" ? (
        <section className="panel">
          <div className="panel-head">
            <h2>历史审计</h2>
            <div className="row-meta">
              <button className="ghost" onClick={() => void exportAuditExcel()}>
                导出审计
              </button>
            </div>
          </div>
          <p className="muted">查看任务流转、创建、更新、闭环和附件动作，支持时间范围筛选与导出。</p>

          <div className="filters">
            <input
              placeholder="搜索任务、编号、操作者或内容"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
            />
            <input type="date" value={auditStart} onChange={(e) => setAuditStart(e.target.value)} />
            <input type="date" value={auditEnd} onChange={(e) => setAuditEnd(e.target.value)} />
            <select value={auditType} onChange={(e) => setAuditType(e.target.value)}>
              {["全部", "创建", "更新", "状态", "闭环", "记录"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select value={auditOperator} onChange={(e) => setAuditOperator(e.target.value)}>
              {auditOperatorOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              className="ghost"
              onClick={() => {
                setAuditSearch("");
                setAuditType("全部");
                setAuditOperator("全部");
                setAuditStart("");
                setAuditEnd("");
              }}
            >
              重置审计
            </button>
          </div>

          <div className="audit-summary">
            <div className="stat-card">
              <span>审计记录</span>
              <strong>{auditRows.length}</strong>
            </div>
            <div className="stat-card">
              <span>创建动作</span>
              <strong>{auditRows.filter((row) => row.actionType === "创建").length}</strong>
            </div>
            <div className="stat-card">
              <span>闭环动作</span>
              <strong>{auditRows.filter((row) => row.actionType === "闭环").length}</strong>
            </div>
            <div className="stat-card">
              <span>附件动作</span>
              <strong>{auditRows.filter((row) => row.actionType === "附件").length}</strong>
            </div>
          </div>

          <div className="timeline audit-timeline">
            {auditRows.length > 0 ? (
              auditRows.map((row) => (
                <div key={row.id} className="timeline-item audit-item">
                  <div className="audit-head">
                    <strong>{row.taskTitle}</strong>
                    <span className="pill">{row.actionType}</span>
                  </div>
                  <p>
                    {row.taskCode} · {row.operator} · {formatDateTime(row.logTime)}
                  </p>
                  <p className="muted">{row.logContent}</p>
                  <div className="row-meta">
                    <span className="pill">{row.taskStatus}</span>
                    <span className="pill">{tasks.some((item) => item.id === row.taskId) ? "当前任务存在" : "历史记录"}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="alert">没有找到符合条件的审计记录。</div>
            )}
          </div>
        </section>
      ) : null}

      {view === "users" ? (
        <section className="panel">
          <div className="panel-head">
            <h2>用户与系统</h2>
            {session.role === "admin" ? (
              <button className="primary" onClick={openUserForm}>
                新增用户
              </button>
            ) : null}
          </div>

          <section className="section">
            <h3>当前用户</h3>
            <div className="table">
              {users.map((user) => (
                <div key={user.id} className="table-row">
                  <strong>{user.username}</strong>
                  <span>{user.role === "admin" ? "管理员" : "普通用户"}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <h3>系统说明</h3>
            <p className="muted">
              数据仅保存在当前浏览器。首次登录可使用默认管理员账号 <strong>admin / admin123</strong>。
              任务完成后不会随意删除，只允许修改状态、补充过程记录和完成闭环。
              已完成和已取消的任务默认锁定，普通用户只能查看，管理员可做必要修正。
            </p>
          </section>

          <section className="section">
            <h3>数据备份</h3>
            <div className="row-meta">
              <button className="ghost" onClick={exportBackup}>
                导出备份
              </button>
              <button className="ghost" onClick={() => backupInputRef.current?.click()}>
                导入备份
              </button>
            </div>
            <input
              ref={backupInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => void importBackupFile(e.target.files?.[0] ?? null)}
            />
            <p className="muted">建议定期导出备份，避免浏览器缓存清理后数据丢失。</p>
          </section>
        </section>
      ) : null}

      {taskFormOpen ? (
        <Modal title={taskMode === "create" ? "新增任务" : "编辑任务"} onClose={() => setTaskFormOpen(false)}>
          <TaskForm
            draft={taskDraft}
            setDraft={setTaskDraft}
            onSave={submitTaskForm}
            onSaveAndNew={taskMode === "create" ? () => submitTaskForm(true) : undefined}
            onSaveSuccess={() => setTaskFormOpen(false)}
            onUseTemplate={applyTaskTemplate}
            departments={departmentSuggestions}
            owners={ownerSuggestions}
            equipmentNames={equipmentNameSuggestions}
            equipmentCodes={equipmentCodeSuggestions}
          />
        </Modal>
      ) : null}

      {completeOpen && selectedTask ? (
        <Modal title="完成闭环" onClose={() => setCompleteOpen(false)}>
          <p className="muted">任务：{selectedTask.title}</p>
          <div className="grid-form">
            <label>
              完成时间
              <input type="date" value={completeDraft.finishDate} onChange={(e) => setCompleteDraft((prev) => ({ ...prev, finishDate: e.target.value }))} />
            </label>
            <label>
              处理结果
              <input value={completeDraft.result} onChange={(e) => setCompleteDraft((prev) => ({ ...prev, result: e.target.value }))} />
            </label>
            <label>
              费用金额
              <input type="number" min="0" step="0.01" value={completeDraft.cost} onChange={(e) => setCompleteDraft((prev) => ({ ...prev, cost: e.target.value }))} />
            </label>
            <label>
              维修单位
              <input value={completeDraft.vendor} onChange={(e) => setCompleteDraft((prev) => ({ ...prev, vendor: e.target.value }))} />
            </label>
            <label>
              验收人
              <input value={completeDraft.acceptancePerson} onChange={(e) => setCompleteDraft((prev) => ({ ...prev, acceptancePerson: e.target.value }))} />
            </label>
            <label>
              完成备注
              <input value={completeDraft.remark} onChange={(e) => setCompleteDraft((prev) => ({ ...prev, remark: e.target.value }))} />
            </label>
          </div>
          <div className="action-row modal-actions">
            <button className="ghost" onClick={() => setCompleteOpen(false)}>
              取消
            </button>
            <button className="success" onClick={submitCompleteTask}>
              确认完成
            </button>
          </div>
        </Modal>
      ) : null}

      {userFormOpen && session.role === "admin" ? (
        <Modal title="新增用户" onClose={() => setUserFormOpen(false)}>
          <div className="grid-form">
            <label>
              用户名
              <input value={userDraft.username} onChange={(e) => setUserDraft((prev) => ({ ...prev, username: e.target.value }))} />
            </label>
            <label>
              初始密码
              <input type="password" value={userDraft.password} onChange={(e) => setUserDraft((prev) => ({ ...prev, password: e.target.value }))} />
            </label>
            <label>
              用户角色
              <select value={userDraft.role} onChange={(e) => setUserDraft((prev) => ({ ...prev, role: e.target.value as User["role"] }))}>
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
              </select>
            </label>
          </div>
          <div className="action-row modal-actions">
            <button className="ghost" onClick={() => setUserFormOpen(false)}>
              取消
            </button>
            <button className="primary" onClick={() => void submitUserForm()}>
              创建用户
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="panel-head">
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose}>
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TaskForm({
  draft,
  setDraft,
  onSave,
  onSaveAndNew,
  onSaveSuccess,
  onUseTemplate,
  departments,
  owners,
  equipmentNames,
  equipmentCodes,
}: {
  draft: Task;
  setDraft: Dispatch<SetStateAction<Task>>;
  onSave: () => boolean;
  onSaveAndNew?: () => boolean;
  onSaveSuccess?: () => void;
  onUseTemplate?: (type: Task["type"], title: string) => void;
  departments: string[];
  owners: string[];
  equipmentNames: string[];
  equipmentCodes: string[];
}) {
  return (
    <div className="stack">
      {onUseTemplate ? (
        <div className="template-row">
          <button className="ghost" onClick={() => onUseTemplate("设备维修", "设备维修跟进")}>
            维修模板
          </button>
          <button className="ghost" onClick={() => onUseTemplate("设备采购", "设备采购跟进")}>
            采购模板
          </button>
          <button className="ghost" onClick={() => onUseTemplate("计量校准", "计量校准安排")}>
            校准模板
          </button>
        </div>
      ) : null}

      <div className="grid-form">
        <label>
          任务标题*
          <input value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} />
        </label>
        <label>
          任务类型*
          <select value={draft.type} onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value as Task["type"] }))}>
            {defaultTaskTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          涉及科室*
          <input list="department-suggestions" value={draft.department} onChange={(e) => setDraft((prev) => ({ ...prev, department: e.target.value }))} />
        </label>
        <label>
          设备名称
          <input list="equipment-name-suggestions" value={draft.equipmentName} onChange={(e) => setDraft((prev) => ({ ...prev, equipmentName: e.target.value }))} />
        </label>
        <label>
          设备编号
          <input list="equipment-code-suggestions" value={draft.equipmentCode} onChange={(e) => setDraft((prev) => ({ ...prev, equipmentCode: e.target.value }))} />
        </label>
        <label>
          负责人*
          <input list="owner-suggestions" value={draft.owner} onChange={(e) => setDraft((prev) => ({ ...prev, owner: e.target.value }))} />
        </label>
        <label>
          创建日期
          <input type="date" value={draft.createDate} onChange={(e) => setDraft((prev) => ({ ...prev, createDate: e.target.value }))} />
        </label>
        <label>
          截止日期*
          <input type="date" value={draft.dueDate} onChange={(e) => setDraft((prev) => ({ ...prev, dueDate: e.target.value }))} />
        </label>
        <label>
          提醒日期
          <input type="date" value={draft.remindDate} onChange={(e) => setDraft((prev) => ({ ...prev, remindDate: e.target.value }))} />
        </label>
        <label>
          状态
          <select value={draft.status} onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as Task["status"] }))}>
            {["待处理", "处理中", "等待配件", "等待厂家", "已完成", "已取消"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <datalist id="department-suggestions">
        {departments.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <datalist id="owner-suggestions">
        {owners.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <datalist id="equipment-name-suggestions">
        {equipmentNames.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <datalist id="equipment-code-suggestions">
        {equipmentCodes.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <label>
        问题描述
        <textarea rows={4} value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
      </label>

      <label>
        备注
        <textarea rows={3} value={draft.remark} onChange={(e) => setDraft((prev) => ({ ...prev, remark: e.target.value }))} />
      </label>

      <div className="row-meta">
        <button
          className="primary"
          onClick={() => {
            if (onSave()) {
              onSaveSuccess?.();
            }
          }}
        >
          保存任务
        </button>
        {onSaveAndNew ? (
          <button className="ghost" onClick={() => onSaveAndNew()}>
            保存并新增
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="report-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BarRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="bar-row">
      <span>{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.min(100, value * 18)}%` }} />
      </div>
      <strong>{value}</strong>
    </div>
  );
}
