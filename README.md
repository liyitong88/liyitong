# 医学装备科任务闭环管理系统

一个面向医学装备科日常工作的随身任务管理小程序，支持手机和电脑访问。

实现方式和“月度绩效核算工具”保持一致：

- 前端静态化
- 数据优先保存在浏览器本地
- 通过导出备份 / 导入恢复做数据迁移
- 不依赖后端也能先跑 MVP

## 主要功能

- 登录
- 新增任务
- 任务列表与筛选
- 处理记录
- 状态流转
- 完成闭环
- 首页提醒
- 月度报告
- Excel 导出
- 本地备份和导入

## 默认账号

- 账号：`admin`
- 密码：`admin123`

## 快速启动

```bash
pnpm install
pnpm dev
```

## 手机访问

同一 Wi-Fi 下：

```bash
pnpm dev:host
```

外网访问：

```powershell
start-mobile.bat
```

然后用手机打开窗口里显示的 `https://...trycloudflare.com` 地址。

## 正式部署

如果要拿到长期稳定地址，推荐直接部署到 **Cloudflare Pages**，再绑定一个自己的域名。这样不会依赖你电脑开着，也不依赖同一个 Wi-Fi。

详细步骤请看：

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [USER_GUIDE.md](./USER_GUIDE.md)

## 构建

```bash
pnpm build
```
