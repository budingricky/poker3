## 把 Vite 客户端打包成 Android/iOS App（Capacitor）

`client/app` 是 Vite Web 项目，不能直接变成 APK/IPA。推荐用 Capacitor 作为原生壳，把 `dist/` 打进 App 内部，这样安装后无需再启动本地客户端服务器。

### 1) 安装依赖

在仓库根目录执行一次即可：

```bash
npm i
```

### 2) 生成 Web 产物并创建原生工程

```bash
cd client/app
npm run build
npx cap add android
npx cap add ios
```

### 3) 同步 Web 产物到原生工程

```bash
cd client/app
npm run cap:sync:android
npm run cap:sync:ios
```

### 4) 生成安装包

#### Android（本地）

```bash
cd client/app/android
./gradlew assembleDebug
```

产物一般在 `android/app/build/outputs/apk/debug/`。

#### iOS（需要 macOS）

```bash
cd client/app
npx cap open ios
```

在 Xcode 里签名并 Archive 导出 IPA。

### 4.1) 在 Windows 上构建 iOS（结论与可行方案）

iOS 的 IPA **无法在 Windows 本地构建**（Apple 工具链 `xcodebuild` / Xcode 只能在 macOS 运行）。但你可以在 Windows 开发，然后用以下方式在 macOS 远程构建：

- 推荐：GitHub Actions（macOS runner）自动出 IPA
- 备选：Codemagic / MacStadium / 自己的 Mac mini 远程机器

本仓库已内置 GitHub Actions 工作流：`.github/workflows/ios-ipa.yml`

#### 使用 GitHub Actions 云构建 IPA（从 Windows 发起）

1) 把仓库推到 GitHub
2) 在 GitHub 仓库 Settings → Secrets and variables → Actions 添加 Secrets：
   - `APPLE_TEAM_ID`：你的 Team ID
   - `IOS_BUNDLE_ID`：例如 `com.poker3.client`
   - `IOS_MARKETING_VERSION`：例如 `1.0.0`（可选，不填默认 1.0.0）
   - `IOS_CERT_P12_BASE64`：iOS Distribution 证书（.p12）base64
   - `IOS_CERT_PASSWORD`：.p12 密码
   - `IOS_PROVISIONING_PROFILE_BASE64`：Provisioning Profile（.mobileprovision）base64
   - `KEYCHAIN_PASSWORD`：随便一个强密码（构建机临时钥匙串用）
   - `APPSTORE_ISSUER_ID`：App Store Connect API Issuer ID（用于上传 TestFlight）
   - `APPSTORE_KEY_ID`：App Store Connect API Key ID（用于上传 TestFlight）
   - `APPSTORE_API_KEY_P8_BASE64`：App Store Connect API 私钥 .p8 的 base64（用于上传 TestFlight）
3) GitHub Actions 里手动触发 workflow：Build iOS IPA (Capacitor)
4) 如果配置了 APPSTORE_* secrets，会自动上传到 TestFlight；同时在 Artifacts 也会生成 `poker3-ipa` 可下载

> 说明：这里默认用 app-store 导出方式（适合 TestFlight/App Store）。如果你想要 Ad Hoc/企业签名，改 `client/app/ios/ExportOptions.plist` 的 `method` 即可。

#### Windows 下把证书/描述文件转 base64

在 PowerShell 执行（路径改成你的真实文件）：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\ios_distribution.p12")) | Out-File -Encoding ascii -NoNewline ios_p12.b64.txt
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\AppStore.mobileprovision")) | Out-File -Encoding ascii -NoNewline ios_profile.b64.txt
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\AuthKey_XXXXXXXXXX.p8")) | Out-File -Encoding ascii -NoNewline appstore_key_p8.b64.txt
```

把生成的 `*.b64.txt` 内容复制到对应的 GitHub Secrets。

### 5) 云编译建议

- Android：用 GitHub Actions / Codemagic 在 Linux 上跑 `./gradlew assembleDebug` 或 `bundleRelease`
- iOS：必须 macOS runner，并需要 Apple 开发者签名材料
