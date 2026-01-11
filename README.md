# Emoticon-Tool（表情包尺寸处理工具）

一个用于表情包上架/发布的前端小工具，支持常见尺寸的一键裁剪/缩放，并提供即梦（Jimeng）图生视频与 GIF 转换能力。

## 功能

- 表情包批量处理：8–24 张，输出 240×240
- 横幅处理：输出 750×400
- 赞赏引导图：输出 750×560
- 赞赏致谢图：输出 750×750
- 封面处理：输出 240×240
- 图标处理：输出 50×50
- AI 动图（Jimeng）：图生视频、视频转 GIF（输出固定 240×240，且压缩至 < 500KB）

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## GitHub Pages 部署

本仓库已内置 GitHub Actions 自动部署流程，推送到 `main` 分支后会自动构建并发布到 GitHub Pages。

在仓库 Settings → Pages 中将 Source 设为 GitHub Actions 即可。

## 说明

- AI 动图功能需要你自行填写 Volcengine 的 Access Key / Secret Key。
- 由于这是纯前端项目，AK/SK 会保存在浏览器端；请不要在公开环境中使用高权限密钥。

