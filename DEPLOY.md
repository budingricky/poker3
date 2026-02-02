# 部署指南：Android 本地服务器

本指南介绍如何在 Android 手机上运行此游戏服务器。

## 方法一：使用 Termux (推荐)

Termux 是 Android 上的终端模拟器，可以安装 Node.js 环境。

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

5. **构建前端** (可选，如果只在开发模式运行可跳过):
   ```bash
   npm run build
   ```

6. **启动服务器**：
   为了让局域网其他设备访问，需要确保手机连接 WiFi 或开启热点。
   
   运行开发服务器 (最简单):
   ```bash
   npm run dev -- --host
   ```
   Vite 会显示 Network 地址，例如 `http://192.168.x.x:5173`。

7. **访问**：
   其他手机连接同一 WiFi/热点，浏览器访问上述 IP 地址。

## 注意事项

- **防火墙**：部分 Android 系统可能限制端口访问，如果无法访问，尝试关闭流量节省模式或检查热点设置。
- **性能**：旧款 Android 手机作为服务器可能性能有限，建议使用性能较好的设备。
