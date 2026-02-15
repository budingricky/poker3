# PM2 服务器部署指南

本指南介绍如何使用 PM2 部署 poker3 游戏服务器到生产环境。

## 前置条件

- 服务器已安装 Node.js (推荐 v18 或更高版本)
- 服务器已安装 npm
- 已获取 SSL 证书（推荐使用 Let's Encrypt）

## 一、服务器准备

### 1. 安装 PM2

```bash
npm install -g pm2
```

### 2. 上传项目文件

将整个 poker3 项目上传到服务器，建议路径：
```
/www/wwwroot/poker3/
```

### 3. 安装项目依赖

```bash
cd /www/wwwroot/poker3/server/app
npm install
```

## 二、SSL 证书配置

### 1. 创建证书目录

```bash
mkdir -p /www/wwwroot/poker3/certs
```

### 2. 上传 SSL 证书

将您的 SSL 证书文件上传到 `/www/wwwroot/poker3/certs/` 目录：
- `fullchain.pem` - 完整证书链
- `privkey.pem` - 私钥

**使用 Let's Encrypt 的用户可以直接使用软链接：**
```bash
ln -s /etc/letsencrypt/live/your-domain.com/fullchain.pem /www/wwwroot/poker3/certs/fullchain.pem
ln -s /etc/letsencrypt/live/your-domain.com/privkey.pem /www/wwwroot/poker3/certs/privkey.pem
```

## 三、配置 PM2

### 1. 修改 ecosystem.config.cjs（如需要）

根据您的实际部署路径修改 `ecosystem.config.cjs` 中的配置：

```javascript
module.exports = {
  apps: [{
    name: 'poker3-server',
    cwd: '/www/wwwroot/poker3/server/app',  // 修改为您的实际路径
    script: 'npm',
    args: 'run dev',
    env: {
      PORT: 3001,
      SSL_CERT_PATH: '/www/wwwroot/poker3/certs/fullchain.pem',  // 修改证书路径
      SSL_KEY_PATH: '/www/wwwroot/poker3/certs/privkey.pem',    // 修改私钥路径
      NODE_ENV: 'production',
    },
  }],
}
```

### 2. 创建日志目录

```bash
mkdir -p /www/wwwroot/poker3/logs
```

## 四、启动服务

### 1. 启动服务

```bash
cd /www/wwwroot/poker3
pm2 start ecosystem.config.cjs
```

### 2. 查看服务状态

```bash
pm2 status
```

您应该能看到 poker3-server 正在运行。

### 3. 查看日志

```bash
# 查看实时日志
pm2 logs poker3-server

# 查看最近的日志
pm2 logs poker3-server --lines 100

# 查看错误日志
pm2 logs poker3-server --err

# 查看输出日志
pm2 logs poker3-server --out
```

## 五、常用 PM2 命令

### 服务管理
```bash
# 停止服务
pm2 stop poker3-server

# 重启服务
pm2 restart poker3-server

# 重载服务（零停机）
pm2 reload poker3-server

# 删除服务
pm2 delete poker3-server
```

### 信息查看
```bash
# 查看服务详情
pm2 show poker3-server

# 监控服务资源使用
pm2 monit
```

### 开机自启
```bash
# 保存当前 PM2 进程列表
pm2 save

# 设置 PM2 开机自启
pm2 startup
# 按照提示执行输出的命令
```

## 六、防火墙配置

确保服务器防火墙开放 3001 端口：

### 使用 ufw (Ubuntu/Debian)
```bash
ufw allow 3001/tcp
```

### 使用 firewalld (CentOS/RHEL)
```bash
firewall-cmd --permanent --add-port=3001/tcp
firewall-cmd --reload
```

### 使用云服务商安全组
如果使用阿里云、腾讯云等，需要在控制台的安全组中添加入站规则：
- 协议：TCP
- 端口：3001
- 来源：0.0.0.0/0（或限制为特定 IP）

## 七、Nginx 反向代理（可选）

如果需要使用 80/443 端口，可以配置 Nginx 反向代理：

### nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /www/wwwroot/poker3/certs/fullchain.pem;
    ssl_certificate_key /www/wwwroot/poker3/certs/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass https://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

然后通过 `https://your-domain.com` 访问服务器。

## 八、故障排查

### 服务无法启动
1. 检查端口是否被占用：
   ```bash
   netstat -tlnp | grep 3001
   ```
2. 查看错误日志：
   ```bash
   pm2 logs poker3-server --err
   ```
3. 检查 SSL 证书路径是否正确
4. 检查文件权限

### 客户端无法连接
1. 确认服务器防火墙已开放端口
2. 检查 SSL 证书是否有效
3. 尝试直接访问 `https://your-server-ip:3001/api/health`
4. 查看浏览器控制台的网络请求

## 九、更新部署

当需要更新代码时：

```bash
# 1. 拉取最新代码
cd /www/wwwroot/poker3
git pull  # 或上传新文件

# 2. 安装新依赖（如有）
cd /www/wwwroot/poker3/server/app
npm install

# 3. 重启服务
pm2 restart poker3-server

# 4. 确认服务正常
pm2 status
pm2 logs poker3-server --lines 50
```
