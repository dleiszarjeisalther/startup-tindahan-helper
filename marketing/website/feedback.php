<?php
session_start();
require_once __DIR__ . '/api/FeedbackDb.php';

$feedbackDb = FeedbackDb::getInstance();

// Generate CSRF token
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION['csrf_token'];

// Compute anonymized voter hash for like/dislike deduplication
$clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
if (strpos($clientIp, ',') !== false) {
    $clientIp = trim(explode(',', $clientIp)[0]);
}
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'UNKNOWN_UA';
$voterHash = hash('sha256', $clientIp . '|' . $userAgent . '|tindahan_suki_salt_2026');

// AJAX / API Vote Handler
if (isset($_GET['action']) && $_GET['action'] === 'vote' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true) ?: $_POST;

    $reqCsrf = $data['csrf_token'] ?? '';
    if (!hash_equals($csrfToken, $reqCsrf)) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid CSRF token. Please refresh the page.']);
        exit;
    }

    $fbId = trim($data['feedback_id'] ?? '');
    $voteType = trim($data['vote_type'] ?? '');

    try {
        $result = $feedbackDb->castVote($fbId, $voterHash, $voteType);
        echo json_encode(['success' => true] + $result);
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// Form Submission Handler
$formSuccess = null;
$formError = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && (!isset($_GET['action']) || $_GET['action'] !== 'vote')) {
    // Honeypot check (hidden field that only bots fill out)
    if (!empty($_POST['store_website'])) {
        // Silently discard bot spam
        $formSuccess = 'Salamat sa iyong mensahe!';
    } else {
        $submittedCsrf = $_POST['csrf_token'] ?? '';
        if (!hash_equals($csrfToken, $submittedCsrf)) {
            $formError = 'Nag-expire ang iyong session. Pakisubukang muli.';
        } else {
            try {
                $name = trim($_POST['name'] ?? '');
                $category = trim($_POST['category'] ?? 'Suggestion');
                $rating = (int)($_POST['rating'] ?? 5);
                $title = trim($_POST['title'] ?? '');
                $message = trim($_POST['message'] ?? '');
                $consent = isset($_POST['contact_consent']) ? 1 : 0;
                $contactInfo = trim($_POST['contact_info'] ?? '');

                if (empty($title)) {
                    throw new Exception('Mangyaring maglagay ng Maikling Pamagat para sa iyong feedback.');
                }
                if (empty($message)) {
                    throw new Exception('Mangyaring isulat ang iyong mensahe o suhestiyon.');
                }

                $feedbackDb->addFeedback([
                    'name' => $name,
                    'category' => $category,
                    'rating' => $rating,
                    'title' => $title,
                    'message' => $message,
                    'contact_consent' => $consent,
                    'contact_info' => $contactInfo
                ], $clientIp);

                $formSuccess = 'Maraming salamat sa iyong feedback! Malaking tulong ito para mapaganda pa ang Startup Tindahan Helper para sa lahat ng tindera.';
            } catch (Exception $e) {
                $formError = $e->getMessage();
            }
        }
    }
}

// Fetch feedback list
$filterCategory = trim($_GET['category'] ?? '');
$sort = trim($_GET['sort'] ?? 'newest');
$feedbacks = $feedbackDb->getFeedbacks([
    'category' => $filterCategory,
    'sort' => $sort,
    'limit' => 50
], $voterHash);

$metrics = $feedbackDb->getSummaryMetrics();
?>
<!DOCTYPE html>
<html lang="tl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Help Us Improve Startup Tindahan Helper! — Feedback & Suggestions</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="icon" type="image/png" href="./assets/images/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .star-rating input[type="radio"] { display: none; }
    .star-rating label { cursor: pointer; transition: transform 0.15s ease, color 0.15s ease; }
    .star-rating label:hover { transform: scale(1.15); }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen py-8 px-4 sm:px-6">

  <!-- Main Container -->
  <div class="max-w-2xl mx-auto space-y-8">

    <!-- Top Navigation Header -->
    <header class="flex items-center justify-between border-b border-slate-800 pb-5">
      <a href="./index.html" class="flex items-center gap-3 group">
        <img src="./assets/images/logo.png" alt="Logo" class="w-10 h-10 rounded-xl shadow-md border border-emerald-500/30">
        <div>
          <span class="text-xs uppercase tracking-wider font-bold text-emerald-400 block">Startup Tindahan Helper</span>
          <span class="text-sm font-extrabold text-white group-hover:text-emerald-300 transition-colors">Feedback & Mungkahi</span>
        </div>
      </a>
      <a href="./index.html" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500/50 text-xs font-semibold text-slate-300 hover:text-white transition-all">
        <span>← Bumalik sa Home</span>
      </a>
    </header>

    <!-- Hero Pitch Banner -->
    <div class="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-2xl">
      <div class="absolute -right-10 -bottom-10 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <span class="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider mb-3">
        Suhestiyon at Kumento
      </span>
      <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
        Help Us Improve Startup Tindahan Helper!
      </h1>
      <p class="text-sm text-slate-300 mt-3 leading-relaxed">
        May suggestion ka ba? May feature bang gusto mong idagdag? May problema ka bang napansin? Share mo sa amin! Your feedback helps us make the app more useful for sari-sari store owners.
      </p>

      <!-- Quick Metrics Strip -->
      <div class="grid grid-cols-3 gap-2 mt-6 pt-5 border-t border-slate-800/80 text-center">
        <div>
          <span class="block text-xl font-extrabold text-emerald-400"><?= $metrics['total'] ?></span>
          <span class="text-xs text-slate-400">Total Feedback</span>
        </div>
        <div>
          <span class="block text-xl font-extrabold text-amber-400">⭐ <?= number_format($metrics['average_rating'], 1) ?></span>
          <span class="text-xs text-slate-400">Average Rating</span>
        </div>
        <div>
          <span class="block text-xl font-extrabold text-cyan-400"><?= $metrics['statuses']['Completed'] ?? 0 ?></span>
          <span class="text-xs text-slate-400">Features Na-actionan</span>
        </div>
      </div>
    </div>

    <!-- Alert Notifications -->
    <?php if ($formSuccess): ?>
      <div class="p-5 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-sm font-medium flex items-start gap-3 shadow-lg">
        <span class="text-xl">✅</span>
        <div class="space-y-1">
          <p class="font-bold text-white"><?= htmlspecialchars($formSuccess) ?></p>
          <p class="text-xs text-emerald-300/80">Naka-record na ito sa database at makikita ng aming development team.</p>
        </div>
      </div>
    <?php endif; ?>

    <?php if ($formError): ?>
      <div class="p-5 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-200 text-sm font-medium flex items-start gap-3 shadow-lg">
        <span class="text-xl">⚠️</span>
        <div>
          <p class="font-bold text-white">May kaunting aberya:</p>
          <p class="text-xs text-red-300 mt-0.5"><?= htmlspecialchars($formError) ?></p>
        </div>
      </div>
    <?php endif; ?>

    <!-- Feedback Submission Form Card -->
    <div class="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
      <div class="border-b border-slate-800 pb-4">
        <h2 class="text-lg font-bold text-white flex items-center gap-2">
          <span>✍️</span> Ipadala ang Iyong Mungkahi
        </h2>
        <p class="text-xs text-slate-400 mt-1">
          Hindi kailangang 5-star ang rating para makapag-submit ng mungkahi o problema. Malugod naming tatanggapin ang totoo mong karanasan.
        </p>
      </div>

      <form method="POST" action="feedback.php" class="space-y-5" id="feedbackForm">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
        <!-- Anti-bot honeypot field -->
        <div style="display:none;" aria-hidden="true">
          <input type="text" name="store_website" tabindex="-1" autocomplete="off">
        </div>

        <!-- 1. Star Rating (Interactive 1-5 Stars) -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
            Kamusta ang iyong karanasan sa app? (Star Rating)
          </label>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1.5 star-rating" id="starContainer">
              <?php for ($i = 1; $i <= 5; $i++): ?>
                <label class="star-label text-2xl text-slate-600 hover:text-amber-400 cursor-pointer" data-rating="<?= $i ?>" title="<?= $i ?> Bituin">
                  <input type="radio" name="rating" value="<?= $i ?>" <?= $i === 5 ? 'checked' : '' ?>>
                  <span class="star-icon">★</span>
                </label>
              <?php endfor; ?>
            </div>
            <span id="ratingDescription" class="text-xs font-semibold text-amber-400 ml-2">
              5/5 Stars — Sobrang Ganda!
            </span>
          </div>
        </div>

        <!-- 2. Category Selector -->
        <div>
          <label for="category" class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
            Kategorya ng Iyong Feedback <span class="text-emerald-400">*</span>
          </label>
          <select name="category" id="category" class="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium">
            <option value="Suggestion" selected>💡 Suggestion (Mungkahi)</option>
            <option value="Feature Request">✨ Feature Request (Bagong Tampok na Gusto Mo)</option>
            <option value="Bug Report">🐛 Bug Report (May Error o Problema)</option>
            <option value="User Experience">📱 User Experience (Dali ng Paggamit)</option>
            <option value="Other">💬 Other (Iba Pa)</option>
          </select>
        </div>

        <!-- 3. Name Field (Optional / Anonymous) -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label for="name" class="text-xs font-bold uppercase tracking-wider text-slate-300">
              Iyong Pangalan
            </label>
            <span class="text-xs text-slate-500">Opsyonal (Puwede anonymous)</span>
          </div>
          <input type="text" name="name" id="name" placeholder="Halimbawa: Ate Maria (Pasig City)" maxlength="60" class="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500">
        </div>

        <!-- 4. Feedback Title -->
        <div>
          <label for="title" class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
            Maikling Pamagat <span class="text-emerald-400">*</span>
          </label>
          <input type="text" name="title" id="title" required placeholder="Halimbawa: Dagdag na tunog kapag nag-scan ng barcode" maxlength="120" class="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium">
        </div>

        <!-- 5. Detailed Message -->
        <div>
          <label for="message" class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
            Detalyadong Mensahe / Paliwanag <span class="text-emerald-400">*</span>
          </label>
          <textarea name="message" id="message" rows="4" required placeholder="Ikuwento kung ano ang nangyari o paano makakatulong ang naisip mong pagbabago sa iyong sari-sari store..." maxlength="2500" class="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed"></textarea>
        </div>

        <!-- 6. Consent to Contact -->
        <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <label class="flex items-start gap-3 cursor-pointer select-none">
            <input type="checkbox" name="contact_consent" id="contactConsent" value="1" class="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-700 bg-slate-900">
            <span class="text-xs text-slate-300 font-medium leading-relaxed">
              Pumapayag akong makontak ng development team para sa karagdagang tanong o tulong tungkol sa aking feedback.
            </span>
          </label>

          <div id="contactInfoBox" style="display:none;" class="pt-2">
            <input type="text" name="contact_info" id="contactInfo" placeholder="Cellphone Number o Facebook / Email..." maxlength="120" class="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <!-- Submit Button -->
        <button type="submit" class="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-900/40 transition-all flex items-center justify-center gap-2 tracking-wide cursor-pointer">
          <span>🚀</span> Send My Feedback
        </button>
      </form>
    </div>

    <!-- Public Feedback Wall & Upvoting -->
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <span>💬</span> Mga Feedback ng Ibang Tindera
          </h2>
          <p class="text-xs text-slate-400">Mag-thumbs up sa mga mungkahing gusto mo ring maipatupad!</p>
        </div>

        <!-- Category & Sort Filter Controls -->
        <form method="GET" class="flex flex-wrap items-center gap-2">
          <select name="category" onchange="this.form.submit()" class="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-emerald-500">
            <option value="">Lahat ng Kategorya</option>
            <option value="Suggestion" <?= $filterCategory === 'Suggestion' ? 'selected' : '' ?>>Suggestions</option>
            <option value="Feature Request" <?= $filterCategory === 'Feature Request' ? 'selected' : '' ?>>Feature Requests</option>
            <option value="Bug Report" <?= $filterCategory === 'Bug Report' ? 'selected' : '' ?>>Bug Reports</option>
            <option value="User Experience" <?= $filterCategory === 'User Experience' ? 'selected' : '' ?>>User Experience</option>
          </select>

          <select name="sort" onchange="this.form.submit()" class="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-emerald-500">
            <option value="newest" <?= $sort === 'newest' ? 'selected' : '' ?>>Pinakabago</option>
            <option value="most_liked" <?= $sort === 'most_liked' ? 'selected' : '' ?>>Pinakamaraming Sang-ayon 👍</option>
            <option value="highest_rating" <?= $sort === 'highest_rating' ? 'selected' : '' ?>>Mataas na Rating ⭐</option>
          </select>
        </form>
      </div>

      <!-- Feed List -->
      <?php if (empty($feedbacks)): ?>
        <div class="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
          <span class="text-3xl block mb-2">🌱</span>
          <p class="text-sm font-semibold text-slate-300">Wala pang feedback sa kategoryang ito.</p>
          <p class="text-xs text-slate-500 mt-1">Ikaw ang unang mag-iwan ng mungkahi sa itaas!</p>
        </div>
      <?php else: ?>
        <div class="space-y-3">
          <?php foreach ($feedbacks as $fb): ?>
            <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-3 hover:border-slate-700 transition-all">
              
              <!-- Card Header -->
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-bold text-white"><?= htmlspecialchars($fb['name']) ?></span>
                    <span class="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                      <?= htmlspecialchars($fb['category']) ?>
                    </span>
                    <?php if ($fb['status'] === 'Completed'): ?>
                      <span class="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold">✓ Naipatupad</span>
                    <?php elseif ($fb['status'] === 'Planned'): ?>
                      <span class="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">📅 Nakaplano</span>
                    <?php endif; ?>
                  </div>
                  <span class="text-[11px] text-slate-500 block mt-0.5"><?= date('M d, Y h:i A', strtotime($fb['created_at'])) ?></span>
                </div>

                <!-- Star Rating Display -->
                <div class="text-amber-400 text-xs tracking-wider shrink-0" title="<?= $fb['rating'] ?> of 5 stars">
                  <?= str_repeat('★', (int)$fb['rating']) . str_repeat('☆', 5 - (int)$fb['rating']) ?>
                </div>
              </div>

              <!-- Title & Message -->
              <div>
                <h3 class="text-sm font-extrabold text-white leading-snug"><?= htmlspecialchars($fb['title']) ?></h3>
                <p class="text-xs text-slate-300 mt-1.5 leading-relaxed whitespace-pre-wrap"><?= htmlspecialchars($fb['message']) ?></p>
              </div>

              <!-- Voting Footer (Like / Dislike) -->
              <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span class="text-[11px] text-slate-500">Sumasang-ayon ka ba rito?</span>
                <div class="flex items-center gap-2">
                  <!-- Like Button -->
                  <button 
                    type="button" 
                    onclick="handleVote('<?= htmlspecialchars($fb['id']) ?>', 'like')" 
                    id="like-btn-<?= htmlspecialchars($fb['id']) ?>"
                    class="vote-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all <?= ($fb['user_vote'] ?? '') === 'like' ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-sm' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700' ?>"
                  >
                    <span>👍</span>
                    <span id="like-count-<?= htmlspecialchars($fb['id']) ?>"><?= (int)$fb['likes'] ?></span>
                  </button>

                  <!-- Dislike Button -->
                  <button 
                    type="button" 
                    onclick="handleVote('<?= htmlspecialchars($fb['id']) ?>', 'dislike')" 
                    id="dislike-btn-<?= htmlspecialchars($fb['id']) ?>"
                    class="vote-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all <?= ($fb['user_vote'] ?? '') === 'dislike' ? 'bg-red-600/30 border-red-500 text-red-300 shadow-sm' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700' ?>"
                  >
                    <span>👎</span>
                    <span id="dislike-count-<?= htmlspecialchars($fb['id']) ?>"><?= (int)$fb['dislikes'] ?></span>
                  </button>
                </div>
              </div>

            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>

    <!-- Footer -->
    <footer class="pt-8 border-t border-slate-900 text-center text-xs text-slate-500 space-y-2">
      <p>Startup Tindahan Helper &copy; <?= date('Y') ?>. Likha para sa bawat sari-sari store owner sa Pilipinas.</p>
      <p class="text-[11px] text-slate-600">Makipag-ugnayan sa Creator: <strong>0991 658 9854</strong></p>
    </footer>

  </div>

  <!-- Interactive Client-side Script -->
  <script>
    const csrfToken = "<?= htmlspecialchars($csrfToken) ?>";

    // Star Rating Selection
    const starLabels = document.querySelectorAll('.star-label');
    const ratingDesc = document.getElementById('ratingDescription');
    const descMap = {
      1: '1/5 Stars — Maraming dapat ayusin 🙁',
      2: '2/5 Stars — Medyo mahirap gamitin 😐',
      3: '3/5 Stars — Sakto lang, puwede na 🙂',
      4: '4/5 Stars — Maganda at maaasahan! 😊',
      5: '5/5 Stars — Sobrang Ganda at Sulit! ⭐'
    };

    function updateStars(val) {
      starLabels.forEach((label) => {
        const rating = parseInt(label.getAttribute('data-rating'), 10);
        if (rating <= val) {
          label.classList.remove('text-slate-600');
          label.classList.add('text-amber-400');
        } else {
          label.classList.remove('text-amber-400');
          label.classList.add('text-slate-600');
        }
      });
      if (ratingDesc) {
        ratingDesc.textContent = descMap[val] || `${val}/5 Stars`;
      }
    }

    starLabels.forEach((label) => {
      label.addEventListener('click', () => {
        const val = parseInt(label.getAttribute('data-rating'), 10);
        const radio = label.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        updateStars(val);
      });
    });

    // Default to 5 stars
    updateStars(5);

    // Contact Consent Toggle
    const consentCb = document.getElementById('contactConsent');
    const contactInfoBox = document.getElementById('contactInfoBox');
    if (consentCb && contactInfoBox) {
      consentCb.addEventListener('change', () => {
        contactInfoBox.style.display = consentCb.checked ? 'block' : 'none';
        if (consentCb.checked) {
          document.getElementById('contactInfo').focus();
        }
      });
    }

    // Like / Dislike Ajax Handler
    async function handleVote(feedbackId, voteType) {
      const likeBtn = document.getElementById(`like-btn-${feedbackId}`);
      const dislikeBtn = document.getElementById(`dislike-btn-${feedbackId}`);
      const likeCount = document.getElementById(`like-count-${feedbackId}`);
      const dislikeCount = document.getElementById(`dislike-count-${feedbackId}`);

      try {
        const response = await fetch('feedback.php?action=vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feedback_id: feedbackId,
            vote_type: voteType,
            csrf_token: csrfToken
          })
        });

        const data = await response.json();
        if (!response.ok || data.error) {
          alert(data.error || 'Failed to submit vote');
          return;
        }

        // Update counts
        if (likeCount) likeCount.textContent = data.likes;
        if (dislikeCount) dislikeCount.textContent = data.dislikes;

        // Update active styles
        if (data.user_action === 'like') {
          likeBtn.className = 'vote-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-sm';
          dislikeBtn.className = 'vote-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700';
        } else if (data.user_action === 'dislike') {
          dislikeBtn.className = 'vote-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all bg-red-600/30 border-red-500 text-red-300 shadow-sm';
          likeBtn.className = 'vote-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700';
        } else {
          // unvoted
          likeBtn.className = 'vote-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700';
          dislikeBtn.className = 'vote-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700';
        }
      } catch (err) {
        console.error('Vote failed:', err);
      }
    }
  </script>
</body>
</html>
