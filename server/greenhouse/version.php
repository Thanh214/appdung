<?php
/**
 * Greenhouse Firmware Version API
 * Trả về thông tin version mới nhất cho ESP32/Mobile app
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

define('VERSION_FILE', __DIR__ . '/firmware/version.json');

// Đọc thông tin version
if (file_exists(VERSION_FILE)) {
    $versionInfo = json_decode(file_get_contents(VERSION_FILE), true);
    
    // Thêm thông tin server
    $versionInfo['server_time'] = date('Y-m-d H:i:s');
    
    echo json_encode([
        'success' => true,
        'data' => $versionInfo
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} else {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'Chưa có firmware nào được upload'
    ], JSON_UNESCAPED_UNICODE);
}

