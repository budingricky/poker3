# 挖坑 (Poker3) - 离线局域网纸牌游戏

基于 Node.js 和 React 开发的四人挖坑纸牌游戏系统，同时提供 Android 原生应用版本（内置服务器）。

## 功能特性

- **房主建房**：在 Android 设备上启动服务，创建游戏房间。
- **局域网对战**：支持 4 人通过 WiFi 热点连接同一局域网进行游戏。
- **实时同步**：基于 WebSocket 实现低延迟的游戏状态同步。
- **挖坑规则**：实现标准的挖坑玩法（发牌、叫分、出牌）。
- **Android 应用**：提供 APK 版本，内置 API/WebSocket 服务器和监控界面，无需配置命令行环境。

## 技术栈

- **服务端 (Node 版)**：Node.js, Express, ws
- **服务端 (Android 版)**：Kotlin, Ktor Embedded Server
- **语言**：TypeScript, Kotlin

## 目录结构

- `server/app`：服务端工程（包含 Node 服务端与 Android 原生内置服务器）
- `client/app`：客户端工程（网页客户端）

## 快速开始（Node 服务端）

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务端

```bash
npm run server:dev
```

## 快速开始（网页客户端）

```bash
npm run client:dev
```

启动后打开浏览器，输入/选择服务端地址（例如 `http://192.168.1.5:3001` 或 Android 应用显示的地址），即可连接 API 与 WebSocket。

## 构建 Android 应用 (APK)

Android 项目位于 `server/app/android/` 目录下。该应用内置了 Ktor 服务器，并通过 Android NSD/mDNS 注册 `poker3`（可通过 `http://poker3.local` 或 `http://poker3.local:8080` 访问，端口取决于系统权限）。

### 步骤

1. **使用 Android Studio 打开**：
   - 打开 Android Studio。
   - 选择 "Open an existing Android Studio project"。
   - 选择项目的 `server/app/android` 目录。

2. **构建 APK**：
   - 等待 Gradle 同步完成。
   - 点击菜单栏 `Build` -> `Build Bundle(s) / APK(s)` -> `Build APK(s)`。
   - 生成的 APK 可以安装到 Android 手机上。

### Android 应用使用说明

1. 手机连接 WiFi 或开启热点。
2. 打开“挖坑服务器”应用。
3. 点击“启动服务器”。
4. 应用会显示当前的 IP 地址（例如 `http://192.168.1.5:8080`）。
5. 其他玩家运行网页客户端（或你后续实现的任意客户端），连接该地址进行游戏。

## 游戏规则

当前实现规则（以代码为准）：

1. 使用一副扑克牌，去掉大小王，共 52 张牌；4 人局，每人 12 张，底牌 4 张。
2. 叫分 1~4，逆时针一轮，最高分为坑主；有人叫 4 分直接成为坑主；无人叫分则默认“最小红心牌持有者”烂挖（1 分）。
3. 必挖：手牌含四个 3 / 三个 3 / 两个 3+红心 4，则轮到该玩家叫分时强制 4 分挖。
4. 底牌先亮出，坑主必须点击“收底牌”后加入手牌；红心 4 持有者先出。
5. 点数大小：3>2>A>K>Q>J>10>9>8>7>6>5>4；相同牌型才可比较大小；先出完牌的一方获胜（坑主方 vs 其余三人）。
