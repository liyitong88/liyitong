# GitHub Pages 发布说明

这个项目已经补好了 GitHub Pages 的静态发布配置。

## 你现在要做的事

1. 打开 GitHub 登录页
2. 输入一次性验证码：`32FC-6C05`
3. 完成登录后告诉我一声

## 我已经做好的内容

- `vite.config.ts` 已经使用相对路径 `base: "./"`
- `public/.nojekyll` 已添加，避免 Pages 处理静态资源
- `public/404.html` 已添加，防止直链页面返回空白
- `.github/workflows/deploy-pages.yml` 已添加，负责自动构建和发布

## 登录完成后我会继续做

1. 创建 GitHub 仓库
2. 推送当前代码
3. 启用 GitHub Pages
4. 给你一个长期可访问的公网地址

