import type { Attachment, SessionUser, Task, TaskLog, TaskType, User } from "./types";
import { emptyTask } from "./utils";

const keys = {
  users: "medequip.users",
  tasks: "medequip.tasks",
  logs: "medequip.logs",
  attachments: "medequip.attachments",
  session: "medequip.session",
  taskPrefs: "medequip.taskPrefs",
};

export const defaultTaskTypes = [
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
] as const;

const isTaskType = (value: string): value is TaskType => defaultTaskTypes.includes(value as TaskType);
const isTaskStatus = (value: string): value is Task["status"] =>
  ["待处理", "处理中", "等待配件", "等待厂家", "已完成", "已取消"].includes(value as Task["status"]);

const stringOrEmpty = (value: unknown) => (typeof value === "string" ? value : "");
const memoryStorage = new Map<string, string>();

const safeGetItem = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryStorage.get(key) ?? null;
  }
};

const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    memoryStorage.set(key, value);
  }
};

const safeRemoveItem = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    memoryStorage.delete(key);
  }
};

export const normalizeTaskPrefs = (prefs: Partial<TaskPrefs> | null | undefined): TaskPrefs => ({
  department: typeof prefs?.department === "string" ? prefs.department : "",
  owner: typeof prefs?.owner === "string" ? prefs.owner : "",
  equipmentName: typeof prefs?.equipmentName === "string" ? prefs.equipmentName : "",
  equipmentCode: typeof prefs?.equipmentCode === "string" ? prefs.equipmentCode : "",
  type: typeof prefs?.type === "string" && isTaskType(prefs.type) ? prefs.type : "",
});

export const normalizeTask = (task: Partial<Task> | null | undefined): Task => {
  const base = emptyTask();
  const type = typeof task?.type === "string" && isTaskType(task.type) ? task.type : base.type;
  const status = typeof task?.status === "string" && isTaskStatus(task.status) ? task.status : base.status;
  return {
    ...base,
    ...task,
    id: stringOrEmpty(task?.id) || uid(),
    title: stringOrEmpty(task?.title),
    type,
    department: stringOrEmpty(task?.department),
    equipmentName: stringOrEmpty(task?.equipmentName),
    equipmentCode: stringOrEmpty(task?.equipmentCode),
    description: stringOrEmpty(task?.description),
    owner: stringOrEmpty(task?.owner),
    status,
    createDate: stringOrEmpty(task?.createDate) || base.createDate,
    dueDate: stringOrEmpty(task?.dueDate),
    remindDate: stringOrEmpty(task?.remindDate),
    finishDate: stringOrEmpty(task?.finishDate),
    result: stringOrEmpty(task?.result),
    cost: stringOrEmpty(task?.cost),
    vendor: stringOrEmpty(task?.vendor),
    acceptancePerson: stringOrEmpty(task?.acceptancePerson),
    remark: stringOrEmpty(task?.remark),
    createdAt: stringOrEmpty(task?.createdAt) || base.createdAt,
    updatedAt: stringOrEmpty(task?.updatedAt) || base.updatedAt,
  };
};

const toJson = <T,>(value: T) => JSON.stringify(value);

const readJson = <T,>(key: string, fallback: T): T => {
  const raw = safeGetItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export async function sha256(input: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function loadUsers(): User[] {
  return readJson<User[]>(keys.users, []);
}

export function saveUsers(users: User[]) {
  safeSetItem(keys.users, toJson(users));
}

export function loadTasks(): Task[] {
  return readJson<Partial<Task>[]>(keys.tasks, []).map((task) => normalizeTask(task));
}

export function saveTasks(tasks: Task[]) {
  safeSetItem(keys.tasks, toJson(tasks));
}

export function loadLogs(): TaskLog[] {
  return readJson<TaskLog[]>(keys.logs, []);
}

export function saveLogs(logs: TaskLog[]) {
  safeSetItem(keys.logs, toJson(logs));
}

export function loadAttachments(): Attachment[] {
  return readJson<Attachment[]>(keys.attachments, []);
}

export function saveAttachments(attachments: Attachment[]) {
  safeSetItem(keys.attachments, toJson(attachments));
}

export function loadSession(): SessionUser | null {
  return readJson<SessionUser | null>(keys.session, null);
}

export function saveSession(session: SessionUser | null) {
  if (!session) {
    safeRemoveItem(keys.session);
    return;
  }
  safeSetItem(keys.session, toJson(session));
}

export type TaskPrefs = {
  department: string;
  owner: string;
  equipmentName: string;
  equipmentCode: string;
  type: string;
};

export function loadTaskPrefs(): TaskPrefs {
  return normalizeTaskPrefs(readJson<TaskPrefs>(keys.taskPrefs, {
    department: "",
    owner: "",
    equipmentName: "",
    equipmentCode: "",
    type: "",
  }));
}

export function saveTaskPrefs(prefs: TaskPrefs) {
  safeSetItem(keys.taskPrefs, toJson(prefs));
}
