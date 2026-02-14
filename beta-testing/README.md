# 公测协议签署系统

## 功能说明

这是一个用于公测用户签署协议的网页系统，支持多个项目，每个项目可单独配置：

- **项目选择**：支持多个公测项目，用户选择后进入对应流程
- **Android 用户**：签署协议后可直接下载 APK 安装包，并查看详细的 Android 安装教程
- **iOS 用户**：签署协议后收集 Apple ID（自动保存），通过 TestFlight 公测链接直接安装，并查看完整的安装教程

## 主要特性

- ✅ **多项目支持**：可配置多个公测项目
- ✅ **手写签名**：支持鼠标或手写板在 Canvas 上签名
- ✅ **图片保存**：签名自动保存为 PNG 图片
- ✅ **联系电话**：收集用户联系电话而非邮箱
- ✅ **TestFlight 公测**：iOS 用户直接通过公测链接加入
- ✅ **完整教程**：每个项目和平台都有详细的安装教程
- ✅ **数据记录**：所有信息自动保存到 JSON 文件，包含项目标识

## 文件结构

```
beta-testing/
├── index.php              # 主入口文件（包含项目配置）
├── style.css              # 样式文件
├── agreement-android.html # Android 协议内容
├── agreement-ios.html     # iOS 协议内容
├── tutorial-android.html  # Android 安装教程
├── tutorial-ios.html      # iOS TestFlight 安装教程
├── README.md              # 说明文档
├── apk/
│   └── poker3-android.apk # Android 安装包
└── data/
    ├── .htaccess          # 保护数据目录
    ├── signatures/        # 手写签名图片存储
    └── signatures.json    # 签名记录存储
```

## 添加新项目

在 `index.php` 中的 `$projects` 数组中添加新项目配置：

```php
$projects = [
    'poker3' => [
        'name' => 'Poker3 德州扑克',
        'icon' => '🎮',
        'description' => '多人在线德州扑克游戏',
        'android_apk' => 'apk/poker3-android.apk',
        'ios_testflight' => 'https://testflight.apple.com/join/Jx72qnDH',
        'agreement_android' => 'agreement-android.html',
        'agreement_ios' => 'agreement-ios.html',
        'tutorial_android' => 'tutorial-android.html',
        'tutorial_ios' => 'tutorial-ios.html'
    ],
    'your-project' => [
        'name' => '您的项目名称',
        'icon' => '📱',
        'description' => '项目描述',
        'android_apk' => 'apk/your-project.apk',
        'ios_testflight' => 'https://testflight.apple.com/join/XXXXX',
        'agreement_android' => 'agreement-your-project-android.html',
        'agreement_ios' => 'agreement-your-project-ios.html',
        'tutorial_android' => 'tutorial-your-project-android.html',
        'tutorial_ios' => 'tutorial-your-project-ios.html'
    ]
];
```

## 使用说明

### 1. 环境要求

- PHP 7.0 或更高版本
- Web 服务器（Apache/Nginx）
- 开启 session 支持
- data 目录需要写入权限

### 2. 部署步骤

1. 将整个 `beta-testing` 文件夹上传到您的 Web 服务器
2. 确保 `data` 目录和 `data/signatures` 目录有写入权限
3. 将 Android APK 文件命名为 `poker3-android.apk` 并放在 `apk/` 目录下
4. 访问 `http://your-domain.com/beta-testing/` 即可使用

### 3. 权限设置

```bash
# 确保 data 目录可写
chmod 755 data/
chmod 755 data/signatures/
chmod 644 data/signatures.json
```

### 4. 查看签名记录

签名记录保存在 `data/signatures.json` 文件中，签名图片保存在 `data/signatures/` 目录下。

## 流程说明

1. **选择项目**：用户选择要参与的公测项目
2. **选择设备**：用户选择 Android 或 iOS
3. **查看协议**：显示对应项目和平台的公测协议
4. **填写信息**：
   - 姓名
   - 联系电话
   - 手写签名（Canvas）
   - iOS 用户额外需要填写 Apple ID
5. **完成签署**：
   - Android：显示下载按钮和详细安装教程
   - iOS：显示 TestFlight 公测链接和安装教程

## TestFlight 公测链接

- 公测链接：https://testflight.apple.com/join/Jx72qnDH

## 数据存储

所有签名记录会自动保存，包含以下信息：
- 项目标识
- 设备类型
- 姓名
- 联系电话
- 签名图片文件名
- Apple ID（仅 iOS 用户）
- 签署时间
- IP 地址

## 手写签名功能

- 支持鼠标在电脑上签名
- 支持触摸在手机/平板上签名
- 支持电子手写板
- 提供"清除签名"按钮
- 签名自动保存为 PNG 图片

## 安全建议

1. 使用 HTTPS 协议保护数据传输
2. 定期备份 `data/signatures.json` 文件和 `data/signatures/` 目录
3. 考虑添加验证码防止恶意提交
4. 限制访问 IP 或添加身份验证
5. 定期清理过期的签名记录

## 自定义修改

- 添加新项目：在 `index.php` 中的 `$projects` 数组添加配置
- 修改协议内容：编辑对应项目的协议文件
- 修改安装教程：编辑对应项目的教程文件
- 修改样式：编辑 `style.css`
- 修改 APK 文件名或路径：在 `index.php` 的项目配置中修改
- 修改 TestFlight 公测链接：在 `index.php` 的项目配置中修改

## 注意事项

- 本系统仅供公测使用，不建议用于生产环境
- 请确保遵守相关法律法规和用户隐私保护要求
- 建议在使用前进行充分测试
- data 目录已通过 .htaccess 保护，防止直接访问
