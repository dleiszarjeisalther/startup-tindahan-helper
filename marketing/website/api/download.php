<?php
/**
 * Dynamic Direct APK Downloader with Comprehensive Diagnostics
 * Startup Tindahan Helper
 *
 * Resolves external links (MediaFire, Dropbox, GitHub Releases)
 * into direct 1-click file downloads and logs all actions to log.txt.
 */

$logFile    = dirname(__DIR__) . '/log.txt';
$configFile = dirname(__DIR__) . '/download_status.json';
$cacheFile  = __DIR__ . '/mediafire_cache.json';

function addLog($action, $data = []) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'UNKNOWN';

    $text = "[$timestamp] [IP: $ip] [ACTION: $action]\n";
    foreach ($data as $k => $v) {
        if (is_array($v) || is_object($v)) {
            $v = json_encode($v, JSON_UNESCAPED_SLASHES);
        }
        $text .= "  -> $k: $v\n";
    }
    $text .= "  -> User-Agent: $ua\n";
    $text .= "----------------------------------------------------------------------\n";

    @file_put_contents($logFile, $text, FILE_APPEND | LOCK_EX);
}

// 1. Check download status
$downloadEnabled = true;
$apkUrl = './apk/tindahan-helper.apk';

if (file_exists($configFile)) {
    $cfg = json_decode(file_get_contents($configFile), true);
    if (isset($cfg['downloads_enabled'])) {
        $downloadEnabled = (bool)$cfg['downloads_enabled'];
    }
    if (!empty($cfg['apk_download_url'])) {
        $apkUrl = $cfg['apk_download_url'];
    }
}

// If downloads are blocked by admin via gg.php
if (!$downloadEnabled) {
    addLog('DOWNLOAD_BLOCKED', [
        'reason' => 'Downloads are disabled via gg.php',
        'apk_url' => $apkUrl
    ]);

    header('Content-Type: text/html; charset=utf-8');
    echo "<!DOCTYPE html><html><body style='font-family:sans-serif;text-align:center;padding:50px;background:#0f172a;color:#fff;'>";
    echo "<h2>Pansamantalang Sarado ang Pag-download</h2>";
    echo "<p>Tumawag o mag-text sa <strong>0991 658 9854</strong> para sa direct assistance.</p>";
    echo "<a href='../index.html' style='color:#38bdf8;'>Bumalik sa Website</a>";
    echo "</body></html>";
    exit;
}

// 2. Resolve Direct Link
$directUrl = $apkUrl;
$resolutionMethod = 'DIRECT_URL_NO_RESOLVE_NEEDED';
$diagnosticInfo = [
    'configured_url' => $apkUrl,
    'php_version' => PHP_VERSION,
    'curl_installed' => function_exists('curl_init') ? 'YES' : 'NO',
    'allow_url_fopen' => ini_get('allow_url_fopen') ? 'ENABLED' : 'DISABLED'
];

// Case A: MediaFire Link -> Resolve to direct CDN download link
if (strpos($apkUrl, 'mediafire.com/file/') !== false) {
    $cachedDirect = null;
    $cacheExpired = false;

    // Check cache (valid for 2 hours)
    if (file_exists($cacheFile)) {
        $cache = json_decode(file_get_contents($cacheFile), true);
        if ($cache && isset($cache['direct_url'], $cache['expires_at'])) {
            if (time() < $cache['expires_at']) {
                $cachedDirect = $cache['direct_url'];
            } else {
                $cacheExpired = true;
            }
        }
    }

    if ($cachedDirect) {
        $directUrl = $cachedDirect;
        $resolutionMethod = 'CACHE_HIT';
        $diagnosticInfo['cache_status'] = 'Active (expires in ' . ($cache['expires_at'] - time()) . 's)';
        $diagnosticInfo['resolved_url'] = $directUrl;
    } else {
        $diagnosticInfo['cache_status'] = $cacheExpired ? 'Expired' : 'Not found / First run';
        $html = false;
        $fetchError = '';
        $httpCode = 0;

        // Method 1: Try cURL
        if (function_exists('curl_init')) {
            $ch = curl_init($apkUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 12);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $html = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErrno = curl_errno($ch);
            $curlError = curl_error($ch);
            curl_close($ch);

            $diagnosticInfo['curl_attempt'] = [
                'http_code' => $httpCode,
                'errno' => $curlErrno,
                'error' => $curlError ?: 'None',
                'html_length' => $html ? strlen($html) : 0
            ];

            if ($curlErrno !== 0) {
                $fetchError .= "cURL error ($curlErrno): $curlError. ";
            }
        } else {
            $diagnosticInfo['curl_attempt'] = 'cURL function is not enabled on this PHP server';
        }

        // Method 2: Fallback to file_get_contents if cURL failed or returned empty
        if ((!$html || strlen($html) < 200) && ini_get('allow_url_fopen')) {
            $context = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n",
                    'timeout' => 12,
                    'follow_location' => 1
                ],
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false
                ]
            ]);
            $html = @file_get_contents($apkUrl, false, $context);
            $diagnosticInfo['file_get_contents_attempt'] = [
                'success' => $html !== false,
                'html_length' => $html ? strlen($html) : 0
            ];
            if ($html === false) {
                $lastErr = error_get_last();
                $fetchError .= "file_get_contents error: " . ($lastErr['message'] ?? 'Unknown stream error');
            }
        }

        // Parse HTML for direct download button
        $resolved = null;
        $matchedPattern = 'NONE';

        if ($html && strlen($html) > 500) {
            if (preg_match('/aria-label=["\']Download file["\'][^>]*href=["\']([^"\']+)["\']/i', $html, $m)) {
                $resolved = $m[1];
                $matchedPattern = 'aria-label';
            } elseif (preg_match('/href=["\']([^"\']+)["\'][^>]*id=["\']downloadButton["\']/i', $html, $m)) {
                $resolved = $m[1];
                $matchedPattern = 'href_before_id_downloadButton';
            } elseif (preg_match('/id=["\']downloadButton["\'][^>]*href=["\']([^"\']+)["\']/i', $html, $m)) {
                $resolved = $m[1];
                $matchedPattern = 'id_downloadButton_before_href';
            }
        }

        $diagnosticInfo['html_parsing'] = [
            'matched_pattern' => $matchedPattern,
            'resolved_url' => $resolved ?: 'NULL'
        ];

        if ($resolved && filter_var($resolved, FILTER_VALIDATE_URL)) {
            $directUrl = $resolved;
            $resolutionMethod = 'LIVE_SCRAPE_SUCCESS';

            // Cache for 2 hours (7200 seconds)
            @file_put_contents($cacheFile, json_encode([
                'direct_url' => $directUrl,
                'expires_at' => time() + 7200,
                'updated_at' => date('Y-m-d H:i:s')
            ], JSON_PRETTY_PRINT));

            $diagnosticInfo['cache_saved'] = true;
        } else {
            // Scrape failed - fallback to configured URL
            $resolutionMethod = 'SCRAPE_FAILED_FALLBACK_TO_ORIGINAL';
            $diagnosticInfo['failure_reason'] = $fetchError ?: 'Could not extract direct CDN link from MediaFire HTML response. MediaFire may have returned a bot captcha, or outbound network is restricted by the web host.';
            if ($html) {
                $diagnosticInfo['html_snippet'] = substr(strip_tags($html), 0, 300);
            }
        }
    }
}
// Case B: Dropbox link -> Ensure ?dl=1 for instant direct download
elseif (strpos($apkUrl, 'dropbox.com') !== false) {
    $directUrl = preg_replace('/\?dl=[0-9]$/', '?dl=1', $apkUrl);
    if (strpos($directUrl, '?dl=1') === false) {
        $directUrl .= (strpos($directUrl, '?') !== false ? '&dl=1' : '?dl=1');
    }
    $resolutionMethod = 'DROPBOX_DIRECT_CONVERT';
    $diagnosticInfo['converted_url'] = $directUrl;
}

// 3. Log everything to log.txt
$diagnosticInfo['final_redirect_url'] = $directUrl;
$diagnosticInfo['resolution_method'] = $resolutionMethod;

addLog('DOWNLOAD_RESOLVED', $diagnosticInfo);

// 4. Send 302 Redirect directly to target
header('Cache-Control: no-cache, must-revalidate');
header('Location: ' . $directUrl, true, 302);
exit;
