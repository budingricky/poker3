# Poker3 Mobile Client（Expo）

这是一个独立的手机端客户端：内置 WebView，通过局域网自动发现服务器（优先尝试 `poker3.local`），并打开服务端提供的网页 UI。

## 开发

在本目录执行：

- `npm i`
- `npm run start`

## EAS 云打包

在本目录执行：

- `npm i -g eas-cli`
- `eas login`
- `eas init`（首次需要，用于创建/绑定 EAS Project）
- `eas build -p android --profile preview`
- `eas build -p ios --profile preview`

## 服务器约定

客户端默认探测：

- `http://poker3.local`（Android 服务器 App 可能占用 80）
- `http://poker3.local:8080`
- 若均失败，会读取手机局域网 IP 并在同网段做有限扫描（80/8080/3001）。
