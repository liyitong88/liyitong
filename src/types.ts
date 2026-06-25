export type UserRole = "admin" | "user";

export type TaskType =
  | "设备维修"
  | "设备采购"
  | "耗材采购"
  | "计量校准"
  | "设备验收"
  | "设备报废"
  | "合同跟进"
  | "厂家沟通"
  | "科室反馈"
  | "其他";

export type TaskStatus =
  | "待处理"
  | "处理中"
  | "等待配件"
  | "等待厂家"
  | "已完成"
  | "已取消";

export type Task = {
  id: string;
  title: string;
  type: TaskType;
  department: string;
  equipmentName: string;
  equipmentCode: string;
  description: string;
  owner: string;
  status: TaskStatus;
  createDate: string;
  dueDate: string;
  remindDate: string;
  finishDate: string;
  result: string;
  cost: string;
  vendor: string;
  acceptancePerson: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskLog = {
  id: string;
  taskId: string;
  logContent: string;
  operator: string;
  logTime: string;
};

export type Attachment = {
  id: string;
  taskId: string;
  fileUrl: string;
  fileType: string;
  fileName: string;
  uploadedAt: string;
};

export type User = {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
};

export type SessionUser = {
  id: string;
  username: string;
  role: UserRole;
};

export type ReportRange = {
  start: string;
  end: string;
};
