<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$configFile = dirname(__DIR__) . '/download_status.json';

if (file_exists($configFile)) {
    echo file_get_contents($configFile);
} else {
    echo json_encode([
        'downloads_enabled' => true,
        'disabled_message' => 'Pansamantalang sarado ang public APK download para sa update. Mangyaring tumawag o mag-text sa 0991 658 9854.',
        'contact_number' => '0991 658 9854'
    ]);
}
