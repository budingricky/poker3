# Poker3 Mobile（EAS 云编译 APK）

本目录是 Poker3 的 Expo（React Native）“壳”客户端：用 WebView 加载 Poker3 Web 客户端页面。

## 前置条件

- 已有 Expo 账号（用于 EAS）
- 已安装 Node.js 18+ / npm

## 本地启动（可选）

```bash
cd client/poker3-mobile
npm run start
```

## EAS 云编译 APK（Android）

1) 安装 EAS CLI（全局或 npx 都可）

```bash
npm i -g eas-cli
```

2) 登录并初始化

```bash
cd client/poker3-mobile
eas login
eas init
```

3) 构建 APK（调试/内测分发）

```bash
eas build -p android --profile preview-apk
```

构建完成后，EAS 会给出下载链接，直接下载安装到手机即可。

## 说明

- `preview-apk` 输出 APK；`production-aab` 输出 AAB（上架 Play Store 用）。
- App 内加载的是“Web 客户端站点地址”（Vite build 部署后的 URL）。
- 推荐在 `eas.json` 里给 `EXPO_PUBLIC_WEB_URL` 设置为你的 Web 客户端 URL，这样首次打开无需手动输入。

### 部署 Web 客户端（Vite）

在项目根目录构建：

```bash
npm run client:build
```

把 `client/app/dist/` 上传到任意静态站点（Nginx、对象存储静态托管等），得到一个 `https://...` 地址填到 `EXPO_PUBLIC_WEB_URL`。
