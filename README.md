# 挖坑 (Poker3) - 离线局域网纸牌游戏

基于 Node.js 和 React 开发的四人挖坑纸牌游戏系统，同时提供 Android 原生应用版本（内置服务器）。

## 功能特性

- **房主建房**：在 Android 设备上启动服务，创建游戏房间。
- **局域网对战**：支持 4 人通过 WiFi 热点连接同一局域网进行游戏。
- **实时同步**：基于 WebSocket 实现低延迟的游戏状态同步。
- **挖坑规则**：实现标准的挖坑玩法（发牌、叫分、出牌）。
- **Android 应用**：提供 APK 版本，内置 Web 服务器和监控界面，无需配置命令行环境。

## 技术栈

- **前端**：React, Vite, TailwindCSS
- **后端 (Web版)**：Node.js, Express, Socket.io
- **后端 (Android版)**：Kotlin, Ktor Embedded Server
- **语言**：TypeScript, Kotlin

## 快速开始 (Web 版)

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

此命令将同时启动前端 (localhost:5173) 和后端 (localhost:3001)。

### 3. 访问游戏

打开浏览器访问 `http://localhost:5173`。

## 构建 Android 应用 (APK)

本项目包含完整的 Android 项目源码，位于 `android/` 目录下。该应用内置了 Ktor 服务器和 React 前端静态资源。
该服务器会通过 Android NSD/mDNS 注册 `poker3`（可通过 `http://poker3.local` 或 `http://poker3.local:8080` 访问，端口取决于系统权限）。

### 步骤

1. **构建前端**：
   ```bash
   npm run build
   ```
   这将生成 `dist/` 目录。

2. **复制静态资源**：
   (如果使用提供的脚本，此步骤已自动完成。否则需手动复制)
   ```bash
   cp -r dist/* android/app/src/main/assets/web/
   ```

3. **使用 Android Studio 打开**：
   - 打开 Android Studio。
   - 选择 "Open an existing Android Studio project"。
   - 选择项目的 `android` 目录。

4. **构建 APK**：
   - 等待 Gradle 同步完成。
   - 点击菜单栏 `Build` -> `Build Bundle(s) / APK(s)` -> `Build APK(s)`。
   - 生成的 APK 可以安装到 Android 手机上。

### Android 应用使用说明

1. 手机连接 WiFi 或开启热点。
2. 打开“挖坑服务器”应用。
3. 点击“启动服务器”。
4. 应用会显示当前的 IP 地址（例如 `http://192.168.1.5:8080`）。
5. 其他玩家（包括房主自己）在浏览器输入该地址即可进入游戏大厅。

## 移动客户端（Expo / EAS）

本项目提供一个独立的手机客户端（内置 WebView），会优先通过 `poker3.local` 自动发现局域网中的服务器，并直接打开服务器提供的网页 UI。

目录：`apps/mobile-client`

### EAS 云打包

在 `apps/mobile-client` 目录执行：

```bash
npm i -g eas-cli
eas login
eas build -p android --profile preview
eas build -p ios --profile preview
```

## 游戏规则

当前实现规则（以代码为准）：

1. 使用一副扑克牌，去掉大小王，共 52 张牌；4 人局，每人 12 张，底牌 4 张。
2. 叫分 1~4，逆时针一轮，最高分为坑主；有人叫 4 分直接成为坑主；无人叫分则默认“最小红心牌持有者”烂挖（1 分）。
3. 必挖：手牌含四个 3 / 三个 3 / 两个 3+红心 4，则轮到该玩家叫分时强制 4 分挖。
4. 底牌先亮出，坑主必须点击“收底牌”后加入手牌；红心 4 持有者先出。
5. 点数大小：3>2>A>K>Q>J>10>9>8>7>6>5>4；相同牌型才可比较大小；先出完牌的一方获胜（坑主方 vs 其余三人）。
