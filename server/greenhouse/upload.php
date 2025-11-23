<?php
/**
 * Greenhouse Firmware Upload Endpoint
 * Nhận firmware.bin và version từ PlatformIO build script
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle OPTIONS request (CORS preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ===== CONFIGURATION =====
define('UPLOAD_DIR', __DIR__ . '/firmware/');
define('UPLOAD_KEY', 'greenhouse_secret_key_2024');  // Key bảo mật (phải khớp với Python script)
define('MAX_FILE_SIZE', 2 * 1024 * 1024); // 2MB
define('ALLOWED_EXTENSIONS', ['bin']);

// ===== HELPER FUNCTIONS =====
function sendResponse($success, $message, $data = null) {
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data,
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function validateUploadKey() {
    $key = $_POST['upload_key'] ?? '';
    return $key === UPLOAD_KEY;
}

function ensureUploadDir() {
    if (!is_dir(UPLOAD_DIR)) {
        if (!mkdir(UPLOAD_DIR, 0755, true)) {
            sendResponse(false, 'Không thể tạo thư mục upload');
        }
    }
}

// ===== MAIN LOGIC =====
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // 1. Validate upload key
    if (!validateUploadKey()) {
        http_response_code(401);
        sendResponse(false, 'Unauthorized: Invalid upload key');
    }
    
    // 2. Ensure upload directory exists
    ensureUploadDir();
    
    // 3. Validate file upload
    if (!isset($_FILES['firmware']) || $_FILES['firmware']['error'] !== UPLOAD_ERR_OK) {
        sendResponse(false, 'Không tìm thấy file firmware hoặc upload lỗi');
    }
    
    $file = $_FILES['firmware'];
    $version = $_POST['version'] ?? 'unknown';
    $deviceType = $_POST['device_type'] ?? 'greenhouse';
    
    // 4. Validate file size
    if ($file['size'] > MAX_FILE_SIZE) {
        sendResponse(false, 'File quá lớn (max 2MB)');
    }
    
    // 5. Validate file extension
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ALLOWED_EXTENSIONS)) {
        sendResponse(false, 'Chỉ chấp nhận file .bin');
    }
    
    // 6. Clean old firmware files (chỉ giữ lại greenhouse_latest.bin và version.json)
    $oldFiles = glob(UPLOAD_DIR . 'greenhouse_v*.bin');
    $cleanedCount = 0;
    foreach ($oldFiles as $oldFile) {
        if (file_exists($oldFile) && unlink($oldFile)) {
            $cleanedCount++;
        }
    }
    
    // 7. Tạo backup của firmware hiện tại (nếu có)
    $latestFilename = "greenhouse_latest.bin";
    $backupFilename = "greenhouse_backup.bin";
    $latestDestination = UPLOAD_DIR . $latestFilename;
    $backupDestination = UPLOAD_DIR . $backupFilename;
    
    if (file_exists($latestDestination)) {
        // Backup bản latest hiện tại trước khi ghi đè
        copy($latestDestination, $backupDestination);
    }
    
    // 8. Move uploaded file trực tiếp thành greenhouse_latest.bin
    if (!move_uploaded_file($file['tmp_name'], $latestDestination)) {
        sendResponse(false, 'Không thể lưu file');
    }
    
    // 9. Save version info
    $versionInfo = [
        'version' => $version,
        'filename' => $latestFilename,
        'size' => $file['size'],
        'upload_time' => date('Y-m-d H:i:s'),
        'device_type' => $deviceType,
        'download_url' => 'http://' . $_SERVER['HTTP_HOST'] . '/greenhouse/firmware/' . $latestFilename
    ];
    
    $versionFile = UPLOAD_DIR . 'version.json';
    file_put_contents($versionFile, json_encode($versionInfo, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    // 10. Success response
    sendResponse(true, 'Upload firmware thành công', [
        'version' => $version,
        'filename' => $latestFilename,
        'size' => round($file['size'] / 1024, 2) . ' KB',
        'download_url' => $versionInfo['download_url'],
        'old_files_cleaned' => $cleanedCount,
        'backup_created' => file_exists($backupDestination)
    ]);
    
} else {
    http_response_code(405);
    sendResponse(false, 'Method Not Allowed. Chỉ chấp nhận POST request');
}

