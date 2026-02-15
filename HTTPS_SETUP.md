# 使用 HTTPS 启动客户端和服务器

## 配置说明

项目已经配置好使用 HTTPS，证书文件位于 `.certs/` 目录：
- `poker3.local+lan.pem` - SSL 证书
- `poker3.local+lan-key.pem` - SSL 私钥

## 启动步骤

### 1. 启动服务器

在 `server/app` 目录下运行：

```bash
cd server/app
npm run dev
```

服务器会自动检测证书并在 `https://0.0.0.0:3001` 上启动。

### 2. 启动客户端

在 `client/app` 目录下运行：

```bash
cd client/app
npm run dev
```

客户端会自动在 `https://localhost:5173` 上启动。

## 访问地址

- 客户端: https://localhost:5173
- 服务器: https://localhost:3001

## 注意事项

由于使用自签名证书，浏览器可能会显示安全警告，您需要：
1. 点击"高级"
2. 选择"继续前往 localhost (不安全)"

## 环境变量（可选）

如果需要自定义证书路径，可以在相应目录下创建 `.env` 文件：

**服务器 (server/app/.env):**
```env
SSL_CERT_PATH=路径/to/cert.pem
SSL_KEY_PATH=路径/to/key.pem
```

**客户端 (client/app/.env):**
```env
VITE_HTTPS_CERT_PATH=路径/to/cert.pem
VITE_HTTPS_KEY_PATH=路径/to/key.pem
```
