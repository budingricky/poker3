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

### 步骤

1. **构建前端**：
   ```bash
   npm run build
   ```
   这将生成 `dist/` 目录。

2. **复制静态资源**：
   (如果使用提供的脚本，此步骤已自动完成。否则需手动复制)
   ```bash
   cp -r dist/* android/app/src/main/assets/
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

## 游戏规则

1. 4人游戏，使用一副牌（54张）。
2. 每人发12张牌，留6张底牌。
3. 叫分最高的玩家成为"坑主"，拿走底牌并先出牌。
4. 其他三位玩家联手对抗坑主。
5. 先出完牌的一方获胜。
