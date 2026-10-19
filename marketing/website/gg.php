<?php
session_start();
require_once __DIR__ . '/api/FeedbackDb.php';

$feedbackDb = FeedbackDb::getInstance();
$configFile = __DIR__ . '/download_status.json';
$signupsFile = __DIR__ . '/signups.txt';
$logFile = __DIR__ . '/log.txt';
$cacheFile = __DIR__ . '/api/mediafire_cache.json';
$txtFeedbackFile = __DIR__ . '/feedback.txt';

// Default configuration
$defaultConfig = [
    'downloads_enabled' => true,
    'apk_download_url' => 'https://www.mediafire.com/file/g9i9m0xq2pg84b8/tindahan-helper.apk/file',
    'disabled_message' => 'Pansamantalang sarado ang public APK download para sa update. Mangyaring tumawag o mag-text sa 0991 658 9854 para sa direct VIP installation.',
    'contact_number' => '0991 658 9854',
    'admin_pin' => '1234',
    'updated_at' => date('Y-m-d H:i:s')
];

// Load current configuration
if (file_exists($configFile)) {
    $config = json_decode(file_get_contents($configFile), true) ?: $defaultConfig;
    if (!isset($config['apk_download_url'])) {
        $config['apk_download_url'] = $defaultConfig['apk_download_url'];
    }
    if (!isset($config['admin_pin'])) {
        $config['admin_pin'] = '1234';
    }
} else {
    $config = $defaultConfig;
    file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT));
}

// Generate CSRF Token for authenticated session
if (empty($_SESSION['admin_csrf'])) {
    $_SESSION['admin_csrf'] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION['admin_csrf'];

$authError = null;
$message = null;
$messageType = 'success'; // 'success' | 'error'

// Handle Login / Logout POST
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['auth_action'])) {
    if ($_POST['auth_action'] === 'login') {
        $enteredPin = trim($_POST['pin'] ?? '');
        $expectedPin = $config['admin_pin'] ?? '1234';
        if (hash_equals((string)$expectedPin, (string)$enteredPin)) {
            $_SESSION['admin_logged_in'] = true;
            $_SESSION['admin_login_time'] = time();
            header('Location: gg.php');
            exit;
        } else {
            $authError = 'Maling Admin PIN. Pakisubukan muli.';
        }
    } elseif ($_POST['auth_action'] === 'logout') {
        unset($_SESSION['admin_logged_in']);
        session_destroy();
        header('Location: gg.php');
        exit;
    }
}

// Check Authentication
$isAdmin = !empty($_SESSION['admin_logged_in']);

// If not logged in, render PIN login gate
if (!$isAdmin) {
?>
<!DOCTYPE html>
<html lang="tl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login — Startup Tindahan Helper</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="icon" type="image/png" href="./assets/images/favicon.png">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>body { font-family: 'Plus Jakarta Sans', sans-serif; }</style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
    <div class="text-center space-y-2">
      <img src="./assets/images/logo.png" alt="Logo" class="w-14 h-14 mx-auto rounded-2xl shadow-lg border border-emerald-500/30">
      <h1 class="text-xl font-extrabold text-white">Tindahan Helper Admin</h1>
      <p class="text-xs text-slate-400">Ilagay ang 4-digit Security PIN para buksan ang panel</p>
    </div>

    <?php if ($authError): ?>
      <div class="p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-semibold text-center">
        <?= htmlspecialchars($authError) ?>
      </div>
    <?php endif; ?>

    <form method="POST" action="gg.php" class="space-y-4">
      <input type="hidden" name="auth_action" value="login">
      <div>
        <label for="pin" class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 text-center">
          Admin PIN Code
        </label>
        <input type="password" name="pin" id="pin" required autofocus maxlength="12" placeholder="••••" class="w-full text-center text-2xl tracking-[0.3em] font-mono p-3 rounded-xl bg-slate-950 border border-slate-700 text-emerald-400 focus:outline-none focus:border-emerald-500">
        <span class="block text-[11px] text-slate-500 text-center mt-1.5">Default PIN: 1234</span>
      </div>

      <button type="submit" class="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/30 transition-all cursor-pointer">
        I-unlock ang Admin Panel &rarr;
      </button>
    </form>

    <div class="pt-4 border-t border-slate-800 text-center">
      <a href="./index.html" class="text-xs text-slate-500 hover:text-slate-300 transition-colors">
        ← Bumalik sa Website
      </a>
    </div>
  </div>
</body>
</html>
<?php
    exit;
}

// Handle Authenticated Admin Actions
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    $submittedCsrf = $_POST['csrf_token'] ?? '';
    if (!hash_equals($csrfToken, $submittedCsrf)) {
        $message = '⚠️ Invalid or expired CSRF security token. Pakisubukan muli.';
        $messageType = 'error';
    } else {
        $act = $_POST['action'];

        // 1. Toggle Download Status
        if ($act === 'toggle') {
            $config['downloads_enabled'] = !$config['downloads_enabled'];
            $config['updated_at'] = date('Y-m-d H:i:s');
            file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT));
            $message = $config['downloads_enabled']
                ? '✅ APK Download is now ENABLED (Maaari nang mag-download ang mga users).'
                : '⛔ APK Download is now DISABLED (Naka-block ang download sa website).';
        }
        // 2. Update APK Download Source URL with strict HTTPS validation
        elseif ($act === 'update_apk_url') {
            $rawUrl = trim($_POST['apk_download_url'] ?? '');
            if (empty($rawUrl)) {
                $rawUrl = $defaultConfig['apk_download_url'];
            }

            // Validate URL format and allowed protocols
            if (!filter_var($rawUrl, FILTER_VALIDATE_URL)) {
                $message = '❌ Error: Hindi wastong URL format ang inilagay.';
                $messageType = 'error';
            } elseif (!preg_match('/^https:\/\//i', $rawUrl)) {
                $message = '❌ Error: Kinakailangang HTTPS secure destination link ang gamitin (nagsisimula sa https://).';
                $messageType = 'error';
            } else {
                $config['apk_download_url'] = $rawUrl;
                $config['updated_at'] = date('Y-m-d H:i:s');
                file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT));
                // Invalidate resolver cache so next download resolves fresh URL
                if (file_exists($cacheFile)) {
                    @unlink($cacheFile);
                }
                $message = '✅ Na-update at nai-save ang APK Download Source URL!';
            }
        }
        // 3. Update Disabled Advisory Message
        elseif ($act === 'update_message') {
            $config['disabled_message'] = trim($_POST['disabled_message'] ?? $config['disabled_message']);
            $config['updated_at'] = date('Y-m-d H:i:s');
            file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT));
            $message = '✅ Na-update ang advisory message kapag naka-disable ang download!';
        }
        // 4. Update Admin PIN
        elseif ($act === 'update_pin') {
            $newPin = trim($_POST['new_pin'] ?? '');
            if (strlen($newPin) < 4) {
                $message = '❌ Ang PIN ay dapat mayroong hindi bababa sa 4 na karakter/numero.';
                $messageType = 'error';
            } else {
                $config['admin_pin'] = $newPin;
                $config['updated_at'] = date('Y-m-d H:i:s');
                file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT));
                $message = '✅ Matagumpay na pinalitan ang Admin Security PIN!';
            }
        }
        // 5. Feedback Status Update
        elseif ($act === 'update_feedback_status') {
            $fbId = trim($_POST['feedback_id'] ?? '');
            $newStatus = trim($_POST['status'] ?? 'New');
            try {
                $feedbackDb->updateStatus($fbId, $newStatus);
                $message = "✅ Na-update ang status ng feedback ({$fbId}) sa: {$newStatus}";
            } catch (Exception $e) {
                $message = '❌ Error: ' . $e->getMessage();
                $messageType = 'error';
            }
        }
        // 6. Delete Feedback Entry
        elseif ($act === 'delete_feedback') {
            $fbId = trim($_POST['feedback_id'] ?? '');
            try {
                $feedbackDb->deleteFeedback($fbId);
                $message = "🗑️ Nabura ang feedback ({$fbId}).";
            } catch (Exception $e) {
                $message = '❌ Error: ' . $e->getMessage();
                $messageType = 'error';
            }
        }
        // 7. Regenerate feedback.txt Export
        elseif ($act === 'regenerate_feedback_txt') {
            if ($feedbackDb->exportToTextFile()) {
                $message = '🔄 Matagumpay na na-regenerate ang feedback.txt mula sa SQLite database!';
            } else {
                $message = '❌ Nabigo sa pagsulat ng feedback.txt file.';
                $messageType = 'error';
            }
        }
        // 8. Clear Leads
        elseif ($act === 'clear_leads') {
            file_put_contents($signupsFile, "# STARTUP TINDAHAN HELPER - MGA NAG-SIGN UP\n# Cleared at " . date('Y-m-d H:i:s') . "\n\n");
            $message = '⚠️ Na-clear na ang signups.txt.';
        }
        // 9. Clear Logs
        elseif ($act === 'clear_logs') {
            file_put_contents($logFile, "# STARTUP TINDAHAN HELPER - ACTION LOGS\n# Cleared at " . date('Y-m-d H:i:s') . "\n\n");
            $message = '⚠️ Na-clear na ang log.txt.';
        }
        // 10. Clear Resolver Cache
        elseif ($act === 'clear_cache') {
            if (file_exists($cacheFile)) {
                @unlink($cacheFile);
            }
            $message = '🔄 Na-clear ang MediaFire resolver cache!';
        }
    }
}

// Fetch feedback list with filters and sorting
$filterCategory = trim($_GET['fb_category'] ?? '');
$filterRating = trim($_GET['fb_rating'] ?? '');
$filterStatus = trim($_GET['fb_status'] ?? '');
$sort = trim($_GET['fb_sort'] ?? 'newest');

$feedbacks = $feedbackDb->getFeedbacks([
    'category' => $filterCategory,
    'rating' => $filterRating,
    'status' => $filterStatus,
    'sort' => $sort,
    'limit' => 100
]);

$metrics = $feedbackDb->getSummaryMetrics();
$signupsContent = file_exists($signupsFile) ? file_get_contents($signupsFile) : 'Wala pang nag-sign up.';
$logsContent = file_exists($logFile) ? file_get_contents($logFile) : 'Wala pang laman ang log.txt.';
$hasCachedResolver = file_exists($cacheFile);
$cacheInfo = $hasCachedResolver ? json_decode(file_get_contents($cacheFile), true) : null;
?>
<!DOCTYPE html>
<html lang="tl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Control Panel — Startup Tindahan Helper</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="icon" type="image/png" href="./assets/images/favicon.png">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>body { font-family: 'Plus Jakarta Sans', sans-serif; }</style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen py-8 px-4 sm:px-6">

  <div class="max-w-4xl mx-auto space-y-6">

    <!-- Top Header -->
    <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
      <div class="flex items-center gap-3">
        <img src="./assets/images/logo.png" alt="Logo" class="w-12 h-12 rounded-2xl shadow-lg border border-emerald-500/30">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-extrabold text-white tracking-tight">Tindahan Helper Admin Control</h1>
            <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">VIP Panel</span>
          </div>
          <p class="text-xs text-slate-400">Pamahalaan ang APK Download link, user feedback, at diagnostic logs</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <a href="./feedback.php" target="_blank" class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-emerald-500 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
          💬 Buksan ang feedback.php &rarr;
        </a>
        <a href="./index.html" target="_blank" class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-300 hover:text-white transition-colors">
          🌐 Website
        </a>
        <form method="POST" class="inline">
          <input type="hidden" name="auth_action" value="logout">
          <button type="submit" class="px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-xs font-semibold text-red-300 transition-colors cursor-pointer">
            I-lock / Logout
          </button>
        </form>
      </div>
    </header>

    <!-- Alert Banner -->
    <?php if (!empty($message)): ?>
      <div class="p-4 rounded-2xl <?= $messageType === 'error' ? 'bg-red-950/80 border-red-500/50 text-red-200' : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200' ?> border text-sm font-semibold flex items-center justify-between shadow-lg">
        <span><?= htmlspecialchars($message) ?></span>
      </div>
    <?php endif; ?>

    <!-- CARD 1: APK Download Status & Toggle -->
    <div class="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Kasalukuyang Status ng Public APK Download:</span>
          <div class="flex items-center gap-3">
            <?php if ($config['downloads_enabled']): ?>
              <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold text-sm">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ENABLED (Bukas ang Download para sa publiko)
              </span>
            <?php else: ?>
              <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 font-bold text-sm">
                <span class="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                DISABLED (Naka-block ang Download sa website)
              </span>
            <?php endif; ?>
          </div>
          <p class="text-xs text-slate-500 mt-2">Huling binago: <?= htmlspecialchars($config['updated_at']) ?></p>
        </div>

        <form method="POST">
          <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
          <input type="hidden" name="action" value="toggle">
          <?php if ($config['downloads_enabled']): ?>
            <button type="submit" class="w-full sm:w-auto px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-sm shadow-lg shadow-red-950 transition-all cursor-pointer">
              ⛔ I-DISABLE ang APK Download
            </button>
          <?php else: ?>
            <button type="submit" class="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-950 transition-all cursor-pointer">
              ✅ I-ENABLE ang APK Download
            </button>
          <?php endif; ?>
        </form>
      </div>
    </div>

    <!-- CARD 2: Editable APK Download Link (Task 05) -->
    <div class="p-6 sm:p-7 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-extrabold text-white flex items-center gap-2">
            <span>☁️</span> Editable APK Download Link (MediaFire / Cloud HTTPS)
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            Palitan ang MediaFire o Cloud APK URL nang hindi binabago ang source code. Awtomatikong gagamitin ito ng public download script.
          </p>
        </div>
        <span class="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-mono">
          Task 05 Active
        </span>
      </div>

      <form method="POST" class="space-y-3">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
        <input type="hidden" name="action" value="update_apk_url">
        <div>
          <label for="apkUrlInput" class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
            Configured MediaFire o Cloud HTTPS APK Link:
          </label>
          <input 
            type="url" 
            name="apk_download_url" 
            id="apkUrlInput"
            required
            pattern="https://.*"
            value="<?= htmlspecialchars($config['apk_download_url'] ?? '') ?>" 
            placeholder="https://www.mediafire.com/file/.../tindahan-helper.apk/file" 
            class="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
          >
          <span class="block text-[11px] text-slate-500 mt-1">
            Dapat magsimula sa <code class="text-slate-400">https://</code> upang maprotektahan ang mga tinderang nagda-download.
          </span>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button type="submit" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer">
            💾 I-save ang Bagong APK Link
          </button>
          <button 
            type="button" 
            onclick="navigator.clipboard.writeText(document.getElementById('apkUrlInput').value); alert('Na-copy ang APK link!');"
            class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            📋 Kopyahin ang Link
          </button>
        </div>
      </form>
    </div>

    <!-- CARD 3: Comprehensive Feedback Management Dashboard (Task 07, 08, 09) -->
    <div class="p-6 sm:p-7 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
      
      <!-- Dashboard Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-extrabold text-white flex items-center gap-2">
              <span>⭐</span> Feedback & Suggestions Dashboard
            </h2>
            <span class="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold">
              SQLite Backed
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            Repasuhin, i-organisa, at i-update ang status ng mga mungkahi ng mga sari-sari store owner.
          </p>
        </div>

        <!-- Export Actions (Task 07) -->
        <div class="flex items-center gap-2">
          <form method="POST" class="inline">
            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
            <input type="hidden" name="action" value="regenerate_feedback_txt">
            <button type="submit" title="I-sync ang feedback.txt mula sa SQLite" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer">
              🔄 Sync Export
            </button>
          </form>

          <a href="./feedback.txt" download class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5">
            <span>📥</span> I-download ang feedback.txt
          </a>
        </div>
      </div>

      <!-- Summary Metrics Cards (Task 09) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
          <span class="text-xs text-slate-400 font-semibold block">Kabuuang Feedback</span>
          <span class="text-2xl font-extrabold text-white mt-1 block"><?= $metrics['total'] ?></span>
          <span class="text-[10px] text-slate-500">Mula sa feedback.php</span>
        </div>
        <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
          <span class="text-xs text-slate-400 font-semibold block">Average Rating</span>
          <span class="text-2xl font-extrabold text-amber-400 mt-1 block">⭐ <?= number_format($metrics['average_rating'], 2) ?></span>
          <span class="text-[10px] text-slate-500">1 hanggang 5 stars</span>
        </div>
        <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
          <span class="text-xs text-slate-400 font-semibold block">Bagong Mungkahi</span>
          <span class="text-2xl font-extrabold text-emerald-400 mt-1 block"><?= $metrics['pending_reviews'] ?></span>
          <span class="text-[10px] text-slate-500">Status: 'New'</span>
        </div>
        <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
          <span class="text-xs text-slate-400 font-semibold block">Top Category</span>
          <?php 
            $topCat = !empty($metrics['categories']) ? array_key_first($metrics['categories']) : 'Wala pa';
            $topCatCount = !empty($metrics['categories']) ? reset($metrics['categories']) : 0;
          ?>
          <span class="text-sm font-extrabold text-cyan-400 mt-1 block truncate"><?= htmlspecialchars($topCat) ?></span>
          <span class="text-[10px] text-slate-500"><?= $topCatCount ?> entries</span>
        </div>
      </div>

      <!-- Filters & Sorting Bar -->
      <form method="GET" class="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-wrap items-center gap-3">
        <!-- Category Filter -->
        <div class="flex-1 min-w-[130px]">
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Kategorya</label>
          <select name="fb_category" onchange="this.form.submit()" class="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500">
            <option value="">Lahat ng Kategorya</option>
            <option value="Suggestion" <?= $filterCategory === 'Suggestion' ? 'selected' : '' ?>>Suggestions (<?= $metrics['categories']['Suggestion'] ?? 0 ?>)</option>
            <option value="Feature Request" <?= $filterCategory === 'Feature Request' ? 'selected' : '' ?>>Feature Requests (<?= $metrics['categories']['Feature Request'] ?? 0 ?>)</option>
            <option value="Bug Report" <?= $filterCategory === 'Bug Report' ? 'selected' : '' ?>>Bug Reports (<?= $metrics['categories']['Bug Report'] ?? 0 ?>)</option>
            <option value="User Experience" <?= $filterCategory === 'User Experience' ? 'selected' : '' ?>>User Experience (<?= $metrics['categories']['User Experience'] ?? 0 ?>)</option>
            <option value="Other" <?= $filterCategory === 'Other' ? 'selected' : '' ?>>Other (<?= $metrics['categories']['Other'] ?? 0 ?>)</option>
          </select>
        </div>

        <!-- Rating Filter -->
        <div class="flex-1 min-w-[130px]">
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Rating</label>
          <select name="fb_rating" onchange="this.form.submit()" class="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500">
            <option value="">Lahat ng Rating</option>
            <option value="positive" <?= $filterRating === 'positive' ? 'selected' : '' ?>>Positive (4-5★)</option>
            <option value="critical" <?= $filterRating === 'critical' ? 'selected' : '' ?>>Critical / Negative (1-2★)</option>
            <option value="neutral" <?= $filterRating === 'neutral' ? 'selected' : '' ?>>Neutral (3★)</option>
          </select>
        </div>

        <!-- Status Filter -->
        <div class="flex-1 min-w-[130px]">
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Status</label>
          <select name="fb_status" onchange="this.form.submit()" class="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500">
            <option value="">Lahat ng Status</option>
            <option value="New" <?= $filterStatus === 'New' ? 'selected' : '' ?>>New</option>
            <option value="Under Review" <?= $filterStatus === 'Under Review' ? 'selected' : '' ?>>Under Review</option>
            <option value="Planned" <?= $filterStatus === 'Planned' ? 'selected' : '' ?>>Planned</option>
            <option value="In Progress" <?= $filterStatus === 'In Progress' ? 'selected' : '' ?>>In Progress</option>
            <option value="Completed" <?= $filterStatus === 'Completed' ? 'selected' : '' ?>>Completed</option>
            <option value="Closed" <?= $filterStatus === 'Closed' ? 'selected' : '' ?>>Closed</option>
          </select>
        </div>

        <!-- Sort Option -->
        <div class="flex-1 min-w-[130px]">
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Pagkaka-ayos</label>
          <select name="fb_sort" onchange="this.form.submit()" class="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500">
            <option value="newest" <?= $sort === 'newest' ? 'selected' : '' ?>>Pinakabago (Newest)</option>
            <option value="oldest" <?= $sort === 'oldest' ? 'selected' : '' ?>>Pinakaluma (Oldest)</option>
            <option value="most_liked" <?= $sort === 'most_liked' ? 'selected' : '' ?>>Pinakamaraming Like 👍</option>
            <option value="highest_rating" <?= $sort === 'highest_rating' ? 'selected' : '' ?>>Mataas na Rating ⭐</option>
            <option value="lowest_rating" <?= $sort === 'lowest_rating' ? 'selected' : '' ?>>Mababang Rating</option>
          </select>
        </div>
      </form>

      <!-- Feedback List / Table -->
      <?php if (empty($feedbacks)): ?>
        <div class="p-8 text-center rounded-2xl bg-slate-950 border border-slate-800">
          <span class="text-3xl block mb-2">📭</span>
          <p class="text-sm font-semibold text-slate-300">Walang natagpuang feedback batay sa napiling filter.</p>
        </div>
      <?php else: ?>
        <div class="space-y-3">
          <?php foreach ($feedbacks as $fb): ?>
            <div class="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 hover:border-slate-700 transition-all">
              
              <!-- Top Row: Date, Submitter, Category, Stars -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-2">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-mono text-[11px] text-slate-500"><?= date('Y-m-d H:i', strtotime($fb['created_at'])) ?></span>
                  <span class="text-xs font-bold text-white"><?= htmlspecialchars($fb['name']) ?></span>
                  <span class="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                    <?= htmlspecialchars($fb['category']) ?>
                  </span>
                  <?php if (!empty($fb['contact_consent']) && !empty($fb['contact_info'])): ?>
                    <span class="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px] font-semibold" title="<?= htmlspecialchars($fb['contact_info']) ?>">
                      📞 <?= htmlspecialchars($fb['contact_info']) ?>
                    </span>
                  <?php endif; ?>
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-amber-400 text-xs tracking-wider font-mono">
                    <?= str_repeat('★', (int)$fb['rating']) . str_repeat('☆', 5 - (int)$fb['rating']) ?>
                  </span>
                  <span class="text-xs text-slate-400 font-bold">(<?= $fb['rating'] ?>/5)</span>
                </div>
              </div>

              <!-- Title & Message -->
              <div>
                <h4 class="text-sm font-bold text-white"><?= htmlspecialchars($fb['title']) ?></h4>
                <p class="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap"><?= htmlspecialchars($fb['message']) ?></p>
              </div>

              <!-- Reactions & Status Controls -->
              <div class="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div class="flex items-center gap-3 text-slate-400">
                  <span>👍 <strong class="text-emerald-400"><?= (int)$fb['likes'] ?></strong> Sang-ayon</span>
                  <span>👎 <strong class="text-red-400"><?= (int)$fb['dislikes'] ?></strong> Hindi Sang-ayon</span>
                </div>

                <!-- Status Update Form -->
                <div class="flex items-center gap-2">
                  <form method="POST" class="flex items-center gap-1.5">
                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
                    <input type="hidden" name="action" value="update_feedback_status">
                    <input type="hidden" name="feedback_id" value="<?= htmlspecialchars($fb['id']) ?>">
                    
                    <select name="status" onchange="this.form.submit()" class="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none focus:border-emerald-500">
                      <?php foreach (['New', 'Under Review', 'Planned', 'In Progress', 'Completed', 'Closed'] as $st): ?>
                        <option value="<?= $st ?>" <?= $fb['status'] === $st ? 'selected' : '' ?>><?= $st ?></option>
                      <?php endforeach; ?>
                    </select>
                  </form>

                  <!-- Delete Feedback Button -->
                  <form method="POST" onsubmit="return confirm('Sigurado ka bang nais mong burahin ang feedback na ito?');">
                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
                    <input type="hidden" name="action" value="delete_feedback">
                    <input type="hidden" name="feedback_id" value="<?= htmlspecialchars($fb['id']) ?>">
                    <button type="submit" class="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 text-xs transition-colors cursor-pointer" title="Burahin ang feedback">
                      ✕
                    </button>
                  </form>
                </div>
              </div>

            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>

    <!-- CARD 4: Disabled Advisory Message Customizer -->
    <div class="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
      <h2 class="text-base font-extrabold text-white">Mensahe kapag Naka-Disable ang Download</h2>
      <p class="text-xs text-slate-400">
        Ito ang mensaheng lalabas sa modal o alert kapag sinubukan ng user na mag-download habang naka-disable:
      </p>
      <form method="POST" class="space-y-3">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
        <input type="hidden" name="action" value="update_message">
        <textarea name="disabled_message" rows="3" class="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"><?= htmlspecialchars($config['disabled_message']) ?></textarea>
        <button type="submit" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all shadow-md cursor-pointer">
          💾 I-save ang Mensahe
        </button>
      </form>
    </div>

    <!-- CARD 5: Admin Security PIN Customizer -->
    <div class="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
      <h2 class="text-base font-extrabold text-white">Palitan ang Admin PIN Code</h2>
      <p class="text-xs text-slate-400">
        I-update ang 4-digit code para protektahan ang Admin Control panel na ito mula sa unauthorized access.
      </p>
      <form method="POST" class="flex flex-wrap items-center gap-3">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
        <input type="hidden" name="action" value="update_pin">
        <input type="password" name="new_pin" required placeholder="Bagong PIN (hal. 1234)" maxlength="12" class="p-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-emerald-400 font-mono focus:outline-none focus:border-emerald-500">
        <button type="submit" class="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-all cursor-pointer">
          Baguhin ang PIN
        </button>
      </form>
    </div>

    <!-- CARD 6: Sign-ups & Leads Viewer (signups.txt) -->
    <div class="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-extrabold text-white">Talaan ng mga Nag-Sign Up (signups.txt)</h2>
          <p class="text-xs text-slate-400">Lahat ng detalye mula sa website pre-registration form</p>
        </div>
        <a href="./signups.txt" download class="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-400 transition-colors">
          I-download ang signups.txt
        </a>
      </div>

      <pre class="w-full max-h-60 overflow-y-auto p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 whitespace-pre-wrap select-all"><?= htmlspecialchars($signupsContent) ?></pre>

      <form method="POST" onsubmit="return confirm('Sigurado ka bang gusto mong burahin ang laman ng signups.txt?');">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
        <input type="hidden" name="action" value="clear_leads">
        <button type="submit" class="text-xs text-red-400 hover:text-red-300 underline cursor-pointer">
          I-clear ang signups.txt listahan
        </button>
      </form>
    </div>

    <!-- CARD 7: Action & Diagnostic Logs Viewer (log.txt) -->
    <div class="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-extrabold text-white flex items-center gap-2">
            <span>🔍</span> Diagnostic Action Logs (<span class="font-mono text-cyan-400 text-xs">log.txt</span>)
          </h2>
          <p class="text-xs text-slate-400">
            Dito nakikita ang live actions kapag nag-download ang user (cURL status, MediaFire resolver, at fallback).
          </p>
        </div>
        <div class="flex items-center gap-2">
          <form method="POST" class="inline">
            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
            <input type="hidden" name="action" value="clear_cache">
            <button type="submit" title="I-clear ang cached direct link" class="px-3 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-colors cursor-pointer">
              🔄 Clear Resolver Cache
            </button>
          </form>
          <a href="./log.txt" download class="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 transition-colors">
            I-download ang log.txt
          </a>
        </div>
      </div>

      <?php if ($hasCachedResolver && isset($cacheInfo['direct_url'])): ?>
        <div class="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between gap-2">
          <div class="truncate">
            <span class="font-bold">⚡ Active Cached Direct Link:</span>
            <code class="font-mono text-emerald-400 ml-1"><?= htmlspecialchars(substr($cacheInfo['direct_url'], 0, 75)) ?>...</code>
          </div>
          <span class="shrink-0 text-slate-400">Expires: <?= date('H:i:s', $cacheInfo['expires_at']) ?></span>
        </div>
      <?php endif; ?>

      <pre class="w-full max-h-72 overflow-y-auto p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300 whitespace-pre-wrap select-all"><?= htmlspecialchars($logsContent) ?></pre>

      <form method="POST" onsubmit="return confirm('Sigurado ka bang gusto mong burahin ang laman ng log.txt?');">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
        <input type="hidden" name="action" value="clear_logs">
        <button type="submit" class="text-xs text-red-400 hover:text-red-300 underline cursor-pointer">
          I-clear ang log.txt listahan
        </button>
      </form>
    </div>

  </div>

</body>
</html>
