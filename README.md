# 医学装备科任务闭环管理系统

一个面向医学装备科日常工作的随身任务管理系统，当前同时保留了：

- Web 版，适合浏览器和 GitHub Pages 预览
- 微信小程序版，适合直接在手机里长期使用

微信小程序版已经放在 `miniprogram/` 目录里，可以直接导入微信开发者工具。

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

## 微信小程序打开方式

1. 打开微信开发者工具
2. 选择“导入项目”
3. 项目目录选这个仓库根目录
4. 识别到 `project.config.json` 后，开发者工具会自动读取 `miniprogram/`
5. 先执行一次“工具 -> 构建 npm”
6. 默认账号：
   - `admin`
   - `admin123`

如果你后面要继续在手机上长期用，优先看微信小程序版，不再依赖电脑开着。

## 云同步

在小程序的“我的”页面里可以填写同步接口地址和令牌。

- 上传：把本地数据推到你的服务端
- 下载：把服务端数据拉回本地

接口只要返回整份数据 JSON 就行，后面我也可以继续帮你接成 Supabase 或 Cloudflare Workers。

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
