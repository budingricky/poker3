# 部署指南：Android 本地服务器

本指南介绍如何在 Android 手机上运行此游戏服务器。

说明：服务端仅提供 API 与 WebSocket，不提供网页渲染与静态资源。

## 方法一：使用 Android 原生应用（推荐）

- Android Studio 打开 `server/app/android`
- 构建并安装 APK 到手机
- 在应用内启动服务器，记下应用显示的服务端地址（例如 `http://192.168.1.5:8080`）

## 方法二：使用 Termux（Node 服务端）

Termux 是 Android 上的终端模拟器，可以安装 Node.js 环境并运行 `server/app` 下的 Node 服务端。

### 步骤

1. **安装 Termux**：从 F-Droid 或 Google Play 下载 Termux。
2. **安装 Node.js**：
   在 Termux 中运行：
   ```bash
   pkg update
   pkg install nodejs git
   ```
3. **获取代码**：
   ```bash
   git clone <your-repo-url> poker3
   cd poker3
   ```
   (或者将项目文件直接复制到手机存储中)

4. **安装依赖**：
   ```bash
   npm install
   ```

5. **启动服务器**：
   为了让局域网其他设备访问，需要确保手机连接 WiFi 或开启热点。
   
   ```bash
   npm run server:dev
   ```

## 客户端（网页）

网页客户端在 `client/app`，需要在任意一台设备上启动（电脑/手机浏览器均可访问）。

```bash
npm run client:dev
```

打开网页客户端后，填写/选择服务端地址（Android 应用显示的地址或 `http://<手机IP>:3001`），即可连接进行游戏。

## 注意事项

- **防火墙**：部分 Android 系统可能限制端口访问，如果无法访问，尝试关闭流量节省模式或检查热点设置。
- **性能**：旧款 Android 手机作为服务器可能性能有限，建议使用性能较好的设备。
