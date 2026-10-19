<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed']);
    exit;
}

// Read JSON input or form POST data
$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

if (!$data) {
    $data = $_POST;
}

$name = isset($data['name']) ? trim($data['name']) : '';
$phone = isset($data['phone']) ? trim($data['phone']) : '';
$store = isset($data['store']) ? trim($data['store']) : 'N/A';
$location = isset($data['location']) ? trim($data['location']) : 'N/A';
$timestamp = date('Y-m-d H:i:s');
$ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';

if (empty($name) || empty($phone)) {
    echo json_encode(['success' => false, 'message' => 'Pangalan at cellphone number ay kailangan.']);
    exit;
}

// Check if download is enabled or disabled from download_status.json
$configFile = dirname(__DIR__) . '/download_status.json';
$downloadEnabled = true;
if (file_exists($configFile)) {
    $cfg = json_decode(file_get_contents($configFile), true);
    if (isset($cfg['downloads_enabled'])) {
        $downloadEnabled = (bool)$cfg['downloads_enabled'];
    }
}

// Set status: SUCCESS or UNSUCCESSFUL
$downloadStatus = $downloadEnabled 
    ? "SUCCESS (APK Downloaded)" 
    : "UNSUCCESSFUL (Download Disabled / Priority Waitlist)";

// Path to signups.txt in website root
$filePath = dirname(__DIR__) . '/signups.txt';

$entry = "====================================================\n";
$entry .= "Date/Time : " . $timestamp . "\n";
$entry .= "Pangalan  : " . $name . "\n";
$entry .= "Cellphone : " . $phone . "\n";
$entry .= "Tindahan  : " . $store . "\n";
$entry .= "Barangay  : " . $location . "\n";
$entry .= "Download  : " . $downloadStatus . "\n";
$entry .= "IP        : " . $ip . "\n";
$entry .= "====================================================\n\n";

$apkUrl = './apk/tindahan-helper.apk';
if (isset($cfg['apk_download_url']) && !empty($cfg['apk_download_url'])) {
    $apkUrl = $cfg['apk_download_url'];
}

$saved = @file_put_contents($filePath, $entry, FILE_APPEND | LOCK_EX);

// Write to action log.txt
$logFile = dirname(__DIR__) . '/log.txt';
$logEntry = "[" . date('Y-m-d H:i:s') . "] [IP: $ip] [ACTION: USER_SIGNUP]\n";
$logEntry .= "  -> Name: $name\n";
$logEntry .= "  -> Phone: $phone\n";
$logEntry .= "  -> Store: $store\n";
$logEntry .= "  -> Location: $location\n";
$logEntry .= "  -> Download Status: $downloadStatus\n";
$logEntry .= "  -> File Saved: " . ($saved !== false ? 'YES' : 'NO') . "\n";
$logEntry .= "----------------------------------------------------------------------\n";
@file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);

if ($saved !== false) {
    echo json_encode([
        'success' => true,
        'downloads_enabled' => $downloadEnabled,
        'download_status' => $downloadStatus,
        'message' => 'Matagumpay na naitala ang iyong sign-up sa signups.txt!',
        'download_url' => $downloadEnabled ? './api/download.php' : null
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Hindi ma-save sa signups.txt. Pakisuri ang permissions.'
    ]);
}
