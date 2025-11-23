<?php
/**
 * Greenhouse Data Storage API
 * Lưu trữ và truy xuất dữ liệu sensor từ ESP32
 */

// Đặt múi giờ Việt Nam
date_default_timezone_set('Asia/Ho_Chi_Minh');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

define('DATA_FILE', __DIR__ . '/data/sensor_data.json');
define('MAX_RECORDS', 43200); // 30 ngày * 24h * 60 records/h (1 phút/record) = 43200 records

// Tạo thư mục data nếu chưa có
$dataDir = dirname(DATA_FILE);
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

/**
 * POST: Lưu dữ liệu từ ESP32
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
        exit;
    }
    
    // Validate required fields
    $required = ['temp', 'hum', 'soil', 'r1', 'r2'];
    foreach ($required as $field) {
        if (!isset($input[$field])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Missing field: $field"]);
            exit;
        }
    }
    
    // Load existing data
    $data = [];
    if (file_exists(DATA_FILE)) {
        $data = json_decode(file_get_contents(DATA_FILE), true) ?: [];
    }
    
    // Add new record
    $newRecord = [
        'timestamp' => time() * 1000, // milliseconds
        'temp' => (float)$input['temp'],
        'hum' => (float)$input['hum'],
        'soil' => (float)$input['soil'],
        'r1' => (int)$input['r1'],
        'r2' => (int)$input['r2'],
        'device_id' => $input['id'] ?? 'unknown',
        'received_at' => date('Y-m-d H:i:s')
    ];
    
    // Add to beginning and limit records
    array_unshift($data, $newRecord);
    $data = array_slice($data, 0, MAX_RECORDS);
    
    // Save to file
    if (file_put_contents(DATA_FILE, json_encode($data, JSON_PRETTY_PRINT))) {
        echo json_encode(['success' => true, 'message' => 'Data saved']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to save data']);
    }
}

/**
 * GET: Lấy dữ liệu cho mobile app
 */
elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $hours = isset($_GET['hours']) ? (int)$_GET['hours'] : 24;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
    
    if (!file_exists(DATA_FILE)) {
        echo json_encode(['success' => true, 'data' => []]);
        exit;
    }
    
    $data = json_decode(file_get_contents(DATA_FILE), true) ?: [];
    
    // Filter by time range
    $cutoffTime = (time() - ($hours * 3600)) * 1000; // milliseconds
    $filteredData = array_filter($data, function($record) use ($cutoffTime) {
        return $record['timestamp'] > $cutoffTime;
    });
    
    // Limit results
    $filteredData = array_slice($filteredData, 0, $limit);
    
    // Reverse to get chronological order
    $filteredData = array_reverse($filteredData);
    
    echo json_encode([
        'success' => true,
        'data' => $filteredData,
        'total_records' => count($data),
        'filtered_records' => count($filteredData),
        'server_time' => date('Y-m-d H:i:s')
    ]);
}

else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>
