<?php
session_start();

$projects = [
    'poker3' => [
        'name' => 'Poker3 挖坑扑克——内部测试',
        'icon' => '🎮',
        'description' => '多人在线德州扑克游戏',
        'android_apk' => 'apk/poker3-android.apk',
        'ios_testflight' => 'https://testflight.apple.com/join/Jx72qnDH',
        'agreement_android' => 'agreement-android.html',
        'agreement_ios' => 'agreement-ios.html',
        'tutorial_android' => 'tutorial-android.html',
        'tutorial_ios' => 'tutorial-ios.html'
    ]
];

$step = isset($_GET['step']) ? $_GET['step'] : 'project';
$selectedProject = isset($_SESSION['project']) ? $_SESSION['project'] : '';
$device = isset($_SESSION['device']) ? $_SESSION['device'] : '';
$error = '';
$success = '';

$dataFile = __DIR__ . '/data/signatures.json';
$signaturesDir = __DIR__ . '/data/signatures';

if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode([]));
}

if (!file_exists($signaturesDir)) {
    mkdir($signaturesDir, 0755, true);
}

function getProjectConfig($projectId, $projects) {
    return isset($projects[$projectId]) ? $projects[$projectId] : null;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['project'])) {
        $_SESSION['project'] = $_POST['project'];
        header('Location: ?step=device');
        exit;
    }
    
    if (isset($_POST['device'])) {
        $_SESSION['device'] = $_POST['device'];
        header('Location: ?step=agreement');
        exit;
    }
    
    if (isset($_POST['sign'])) {
        $name = trim($_POST['name']);
        $phone = trim($_POST['phone']);
        $signatureImage = isset($_POST['signature_image']) ? trim($_POST['signature_image']) : '';
        $appleId = isset($_POST['apple_id']) ? trim($_POST['apple_id']) : '';
        
        if (empty($name) || empty($phone) || empty($signatureImage)) {
            $error = '请填写所有必填字段并完成手写签名';
        } else {
            $signatureFilename = 'signature_' . time() . '_' . uniqid() . '.png';
            $signaturePath = $signaturesDir . '/' . $signatureFilename;
            
            $imageData = preg_replace('#^data:image/\w+;base64,#i', '', $signatureImage);
            $imageData = base64_decode($imageData);
            file_put_contents($signaturePath, $imageData);
            
            $record = [
                'project' => $_SESSION['project'],
                'device' => $_SESSION['device'],
                'name' => $name,
                'phone' => $phone,
                'signature_image' => $signatureFilename,
                'apple_id' => $appleId,
                'timestamp' => date('Y-m-d H:i:s'),
                'ip' => $_SERVER['REMOTE_ADDR']
            ];
            
            $data = json_decode(file_get_contents($dataFile), true);
            $data[] = $record;
            file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            
            $_SESSION['signed'] = true;
            $_SESSION['record'] = $record;
            header('Location: ?step=complete');
            exit;
        }
    }
}

function getAgreementContent($device, $projectConfig) {
    if (!$projectConfig) return '';
    $file = $device === 'ios' ? $projectConfig['agreement_ios'] : $projectConfig['agreement_android'];
    $path = __DIR__ . '/' . $file;
    if (file_exists($path)) {
        return file_get_contents($path);
    }
    return '';
}

function getTutorialContent($device, $projectConfig) {
    if (!$projectConfig) return '';
    $file = $device === 'ios' ? $projectConfig['tutorial_ios'] : $projectConfig['tutorial_android'];
    $path = __DIR__ . '/' . $file;
    if (file_exists($path)) {
        ob_start();
        include $path;
        return ob_get_clean();
    }
    return '';
}

$projectConfig = getProjectConfig($selectedProject, $projects);
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>公测协议</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>公测协议签署</h1>
        </header>
        
        <?php if ($step === 'project'): ?>
        <div class="card">
            <h2>选择公测项目</h2>
            <p class="subtitle">请选择您要参与的公测项目</p>
            
            <form method="POST" class="project-select">
                <?php foreach ($projects as $projectId => $project): ?>
                <label class="project-card">
                    <input type="radio" name="project" value="<?php echo htmlspecialchars($projectId); ?>" required>
                    <div class="project-icon"><?php echo htmlspecialchars($project['icon']); ?></div>
                    <div class="project-name"><?php echo htmlspecialchars($project['name']); ?></div>
                    <div class="project-desc"><?php echo htmlspecialchars($project['description']); ?></div>
                </label>
                <?php endforeach; ?>
                
                <button type="submit" class="btn btn-primary">继续</button>
            </form>
        </div>
        
        <?php elseif ($step === 'device' && $projectConfig): ?>
        <div class="card">
            <div class="project-header">
                <span class="project-badge"><?php echo htmlspecialchars($projectConfig['icon']); ?> <?php echo htmlspecialchars($projectConfig['name']); ?></span>
            </div>
            
            <div class="progress">
                <div class="step active">1</div>
                <div class="line"></div>
                <div class="step active">2</div>
                <div class="line"></div>
                <div class="step">3</div>
            </div>
            
            <h2>选择您的设备</h2>
            <p class="subtitle">请选择您要使用的移动设备类型</p>
            
            <form method="POST" class="device-select">
                <label class="device-card android">
                    <input type="radio" name="device" value="android" required>
                    <div class="device-icon">🤖</div>
                    <div class="device-name">Android</div>
                    <div class="device-desc">直接下载安装包</div>
                </label>
                
                <label class="device-card ios">
                    <input type="radio" name="device" value="ios">
                    <div class="device-icon">🍎</div>
                    <div class="device-name">iOS</div>
                    <div class="device-desc">通过 TestFlight 公测链接</div>
                </label>
                
                <button type="submit" class="btn btn-primary">继续</button>
            </form>
        </div>
        
        <?php elseif ($step === 'agreement' && $projectConfig): ?>
        <div class="card">
            <div class="project-header">
                <span class="project-badge"><?php echo htmlspecialchars($projectConfig['icon']); ?> <?php echo htmlspecialchars($projectConfig['name']); ?></span>
            </div>
            
            <div class="progress">
                <div class="step active">1</div>
                <div class="line"></div>
                <div class="step active">2</div>
                <div class="line"></div>
                <div class="step active">3</div>
            </div>
            
            <h2><?php echo $device === 'ios' ? 'iOS' : 'Android'; ?> 公测协议</h2>
            
            <div class="agreement-box">
                <?php echo getAgreementContent($device, $projectConfig); ?>
            </div>
            
            <form method="POST" class="sign-form" id="signForm">
                <?php if ($error): ?>
                <div class="alert error"><?php echo htmlspecialchars($error); ?></div>
                <?php endif; ?>
                
                <div class="form-group">
                    <label for="name">姓名 *</label>
                    <input type="text" id="name" name="name" required placeholder="请输入您的真实姓名">
                </div>
                
                <div class="form-group">
                    <label for="phone">联系电话 *</label>
                    <input type="tel" id="phone" name="phone" required placeholder="请输入您的联系电话">
                </div>
                
                <?php if ($device === 'ios'): ?>
                <div class="form-group">
                    <label for="apple_id">Apple ID 邮箱 *</label>
                    <input type="email" id="apple_id" name="apple_id" required placeholder="请输入您的 Apple ID">
                </div>
                <?php endif; ?>
                
                <div class="form-group signature-group">
                    <label>手写签名 *</label>
                    <div class="signature-container">
                        <canvas id="signatureCanvas" width="500" height="200"></canvas>
                        <button type="button" class="btn btn-secondary btn-small" id="clearSignature">清除签名</button>
                    </div>
                    <input type="hidden" id="signature_image" name="signature_image">
                    <p class="hint">请在上方区域使用鼠标或手写板完成签名</p>
                </div>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="agree" required>
                    <label for="agree">我已仔细阅读并同意以上公测协议的所有条款</label>
                </div>
                
                <input type="hidden" name="sign" value="1">
                <button type="submit" class="btn btn-primary btn-large" id="submitBtn">确认签署协议</button>
            </form>
        </div>
        
        <?php elseif ($step === 'complete' && $projectConfig): ?>
        <div class="card success-card">
            <div class="success-icon">✓</div>
            <h2>签署成功！</h2>
            <p class="subtitle">感谢您参与 <?php echo htmlspecialchars($projectConfig['name']); ?> 公测</p>
            
            <div class="info-box">
                <p><strong>项目：</strong><?php echo htmlspecialchars($projectConfig['name']); ?></p>
                <p><strong>签署时间：</strong><?php echo $_SESSION['record']['timestamp']; ?></p>
                <p><strong>姓名：</strong><?php echo htmlspecialchars($_SESSION['record']['name']); ?></p>
                <p><strong>联系电话：</strong><?php echo htmlspecialchars($_SESSION['record']['phone']); ?></p>
                <p><strong>设备：</strong><?php echo $_SESSION['record']['device'] === 'ios' ? 'iOS' : 'Android'; ?></p>
                <?php if ($_SESSION['device'] === 'ios' && !empty($_SESSION['record']['apple_id'])): ?>
                <p><strong>Apple ID：</strong><?php echo htmlspecialchars($_SESSION['record']['apple_id']); ?></p>
                <?php endif; ?>
            </div>
            
            <?php if ($_SESSION['device'] === 'android'): ?>
            <div class="download-section">
                <h3>📥 下载安装包</h3>
                <a href="<?php echo htmlspecialchars($projectConfig['android_apk']); ?>" class="btn btn-primary btn-large" download>
                    下载 Android APK
                </a>
            </div>
            <?php else: ?>
            <div class="testflight-section">
                <h3>🚀 TestFlight 公测链接</h3>
                <div class="info-box highlight">
                    <p>点击下方按钮直接加入公测：</p>
                    <a href="<?php echo htmlspecialchars($projectConfig['ios_testflight']); ?>" target="_blank" class="btn btn-primary btn-large" style="margin-top: 15px; display: inline-block;">
                        🔗 打开 TestFlight 公测链接
                    </a>
                </div>
            </div>
            <?php endif; ?>
            
            <div class="tutorial-section">
                <h3>📖 安装教程</h3>
                <div class="tutorial-box">
                    <?php echo getTutorialContent($device, $projectConfig); ?>
                </div>
            </div>
        </div>
        <?php endif; ?>
    </div>
    
    <script>
    <?php if ($step === 'project'): ?>
    document.querySelectorAll('.project-card input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', function() {
            document.querySelectorAll('.project-card').forEach(card => {
                card.style.borderColor = '#e2e8f0';
                card.style.background = '#f8fafc';
                card.style.boxShadow = 'none';
            });
            if (this.checked) {
                const card = this.closest('.project-card');
                card.style.borderColor = '#667eea';
                card.style.background = '#ebf4ff';
                card.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.2)';
            }
        });
    });
    <?php endif; ?>
    
    <?php if ($step === 'agreement'): ?>
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let hasDrawn = false;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    function getPosition(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        if (e.touches) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
    
    function startDrawing(e) {
        isDrawing = true;
        hasDrawn = true;
        const pos = getPosition(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        e.preventDefault();
    }
    
    function draw(e) {
        if (!isDrawing) return;
        const pos = getPosition(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        e.preventDefault();
    }
    
    function stopDrawing() {
        isDrawing = false;
        updateSignatureImage();
    }
    
    function updateSignatureImage() {
        document.getElementById('signature_image').value = canvas.toDataURL('image/png');
    }
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    
    document.getElementById('clearSignature').addEventListener('click', function() {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        hasDrawn = false;
        document.getElementById('signature_image').value = '';
    });
    
    document.getElementById('signForm').addEventListener('submit', function(e) {
        if (!hasDrawn) {
            e.preventDefault();
            alert('请完成手写签名');
            return false;
        }
        updateSignatureImage();
    });
    
    function resizeCanvas() {
        const container = canvas.parentElement;
        const maxWidth = Math.min(500, container.clientWidth - 40);
        if (maxWidth < 500) {
            canvas.style.width = maxWidth + 'px';
            canvas.style.height = (maxWidth * 0.4) + 'px';
        }
    }
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    <?php endif; ?>
    </script>
    
    <footer>
        <div class="footer-content">
            <p>© <?php echo date('Y'); ?> 全润琦 保留所有权利</p>
            <p class="developer-name">开发者：全润琦</p>
        </div>
    </footer>
</body>
</html>
