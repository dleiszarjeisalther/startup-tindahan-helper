<?php
/**
 * SQLite Database Manager for Feedback & Voting System
 * Startup Tindahan Helper — Website & Admin Backend
 */

class FeedbackDb {
    private static ?FeedbackDb $instance = null;
    private PDO $pdo;
    private string $txtExportPath;

    public static function getInstance(): FeedbackDb {
        if (self::$instance === null) {
            self::$instance = new FeedbackDb();
        }
        return self::$instance;
    }

    private function __construct() {
        $dbDir = dirname(__DIR__) . '/data';
        if (!is_dir($dbDir)) {
            @mkdir($dbDir, 0755, true);
        }
        $dbPath = $dbDir . '/feedback.sqlite';
        $this->txtExportPath = dirname(__DIR__) . '/feedback.txt';

        $this->pdo = new PDO('sqlite:' . $dbPath);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        // SQLite Optimizations for Web
        $this->pdo->exec('PRAGMA journal_mode = WAL;');
        $this->pdo->exec('PRAGMA busy_timeout = 5000;');
        $this->pdo->exec('PRAGMA foreign_keys = ON;');

        $this->initializeSchema();
    }

    private function initializeSchema(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS feedback (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                rating INTEGER NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                contact_consent INTEGER NOT NULL DEFAULT 0,
                contact_info TEXT,
                likes INTEGER NOT NULL DEFAULT 0,
                dislikes INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'New',
                client_ip TEXT
            );

            CREATE TABLE IF NOT EXISTS feedback_votes (
                feedback_id TEXT NOT NULL,
                voter_hash TEXT NOT NULL,
                vote_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (feedback_id, voter_hash),
                FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
            CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
            CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
        ");
    }

    public function addFeedback(array $input, string $clientIp = ''): array {
        $name = trim($input['name'] ?? '');
        if (empty($name)) {
            $name = 'Anonymous Suki';
        }

        $category = trim($input['category'] ?? 'Suggestion');
        $allowedCategories = ['Suggestion', 'Bug Report', 'Feature Request', 'User Experience', 'Other'];
        if (!in_array($category, $allowedCategories, true)) {
            $category = 'Suggestion';
        }

        $rating = (int)($input['rating'] ?? 5);
        if ($rating < 1 || $rating > 5) {
            $rating = 5;
        }

        $title = trim($input['title'] ?? '');
        if (empty($title)) {
            throw new InvalidArgumentException('Mangyaring maglagay ng Maikling Pamagat para sa iyong feedback.');
        }
        if (mb_strlen($title) > 120) {
            $title = mb_substr($title, 0, 120);
        }

        $message = trim($input['message'] ?? '');
        if (empty($message)) {
            throw new InvalidArgumentException('Mangyaring isulat ang iyong komento o suhestiyon.');
        }
        if (mb_strlen($message) > 2500) {
            $message = mb_substr($message, 0, 2500);
        }

        $contactConsent = !empty($input['contact_consent']) ? 1 : 0;
        $contactInfo = $contactConsent ? trim($input['contact_info'] ?? '') : '';
        if (mb_strlen($contactInfo) > 120) {
            $contactInfo = mb_substr($contactInfo, 0, 120);
        }

        $id = 'fb_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3));
        $now = date('Y-m-d H:i:s');

        // Check recent spam from same IP within last 30 seconds
        if (!empty($clientIp)) {
            $stmt = $this->pdo->prepare("
                SELECT COUNT(*) FROM feedback 
                WHERE client_ip = ? AND created_at >= datetime('now', '-30 seconds')
            ");
            $stmt->execute([$clientIp]);
            if ((int)$stmt->fetchColumn() > 0) {
                throw new RuntimeException('Masyadong mabilis ang pagpapadala. Mangyaring maghintay ng ilang sandali bago magsumite muli.');
            }
        }

        $stmt = $this->pdo->prepare("
            INSERT INTO feedback (
                id, created_at, name, category, rating, title, message,
                contact_consent, contact_info, likes, dislikes, status, client_ip
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'New', ?)
        ");
        $stmt->execute([
            $id,
            $now,
            $name,
            $category,
            $rating,
            $title,
            $message,
            $contactConsent,
            $contactInfo,
            $clientIp
        ]);

        $this->exportToTextFile();

        return [
            'id' => $id,
            'name' => $name,
            'category' => $category,
            'rating' => $rating,
            'title' => $title,
            'message' => $message,
            'created_at' => $now,
            'status' => 'New'
        ];
    }

    public function castVote(string $feedbackId, string $voterHash, string $voteType): array {
        if (!in_array($voteType, ['like', 'dislike'], true)) {
            throw new InvalidArgumentException('Invalid vote type.');
        }

        $this->pdo->beginTransaction();
        try {
            // Verify feedback exists
            $stmt = $this->pdo->prepare("SELECT likes, dislikes FROM feedback WHERE id = ?");
            $stmt->execute([$feedbackId]);
            $feedback = $stmt->fetch();
            if (!$feedback) {
                throw new RuntimeException('Feedback entry not found.');
            }

            // Check existing vote
            $stmt = $this->pdo->prepare("SELECT vote_type FROM feedback_votes WHERE feedback_id = ? AND voter_hash = ?");
            $stmt->execute([$feedbackId, $voterHash]);
            $existingVote = $stmt->fetchColumn();

            $userAction = '';
            if ($existingVote === false) {
                // New vote
                $insertStmt = $this->pdo->prepare("
                    INSERT INTO feedback_votes (feedback_id, voter_hash, vote_type, created_at)
                    VALUES (?, ?, ?, datetime('now', 'localtime'))
                ");
                $insertStmt->execute([$feedbackId, $voterHash, $voteType]);

                $col = ($voteType === 'like') ? 'likes' : 'dislikes';
                $this->pdo->prepare("UPDATE feedback SET $col = $col + 1 WHERE id = ?")->execute([$feedbackId]);
                $userAction = $voteType;
            } elseif ($existingVote === $voteType) {
                // User clicked same vote -> Toggle off (un-vote)
                $this->pdo->prepare("
                    DELETE FROM feedback_votes WHERE feedback_id = ? AND voter_hash = ?
                ")->execute([$feedbackId, $voterHash]);

                $col = ($voteType === 'like') ? 'likes' : 'dislikes';
                $this->pdo->prepare("UPDATE feedback SET $col = MAX(0, $col - 1) WHERE id = ?")->execute([$feedbackId]);
                $userAction = 'unvoted';
            } else {
                // Switched vote (like -> dislike, or dislike -> like)
                $this->pdo->prepare("
                    UPDATE feedback_votes SET vote_type = ?, created_at = datetime('now', 'localtime')
                    WHERE feedback_id = ? AND voter_hash = ?
                ")->execute([$voteType, $feedbackId, $voterHash]);

                if ($voteType === 'like') {
                    $this->pdo->prepare("UPDATE feedback SET likes = likes + 1, dislikes = MAX(0, dislikes - 1) WHERE id = ?")->execute([$feedbackId]);
                } else {
                    $this->pdo->prepare("UPDATE feedback SET dislikes = dislikes + 1, likes = MAX(0, likes - 1) WHERE id = ?")->execute([$feedbackId]);
                }
                $userAction = $voteType;
            }

            $this->pdo->commit();

            // Fetch fresh counts
            $stmt = $this->pdo->prepare("SELECT likes, dislikes FROM feedback WHERE id = ?");
            $stmt->execute([$feedbackId]);
            $updated = $stmt->fetch();

            $this->exportToTextFile();

            return [
                'feedback_id' => $feedbackId,
                'likes' => (int)$updated['likes'],
                'dislikes' => (int)$updated['dislikes'],
                'user_action' => $userAction
            ];
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function getFeedbacks(array $filters = [], string $voterHash = ''): array {
        $where = [];
        $params = [];

        if (!empty($filters['category'])) {
            $where[] = "category = ?";
            $params[] = $filters['category'];
        }

        if (!empty($filters['rating'])) {
            if ($filters['rating'] === 'positive') {
                $where[] = "rating >= 4";
            } elseif ($filters['rating'] === 'critical' || $filters['rating'] === 'negative') {
                $where[] = "rating <= 2";
            } elseif ($filters['rating'] === 'neutral') {
                $where[] = "rating = 3";
            } elseif (is_numeric($filters['rating'])) {
                $where[] = "rating = ?";
                $params[] = (int)$filters['rating'];
            }
        }

        if (!empty($filters['status'])) {
            $where[] = "status = ?";
            $params[] = $filters['status'];
        }

        $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        $sort = $filters['sort'] ?? 'newest';
        switch ($sort) {
            case 'oldest':
                $orderSql = 'ORDER BY created_at ASC';
                break;
            case 'highest_rating':
                $orderSql = 'ORDER BY rating DESC, created_at DESC';
                break;
            case 'lowest_rating':
                $orderSql = 'ORDER BY rating ASC, created_at DESC';
                break;
            case 'most_liked':
                $orderSql = 'ORDER BY likes DESC, created_at DESC';
                break;
            case 'newest':
            default:
                $orderSql = 'ORDER BY created_at DESC';
                break;
        }

        $limitSql = '';
        if (!empty($filters['limit']) && is_numeric($filters['limit'])) {
            $limitSql = 'LIMIT ' . (int)$filters['limit'];
        }

        $sql = "SELECT * FROM feedback $whereSql $orderSql $limitSql";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $records = $stmt->fetchAll();

        // If voterHash is provided, enrich with user's vote
        if (!empty($voterHash) && !empty($records)) {
            $ids = array_column($records, 'id');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $vStmt = $this->pdo->prepare("
                SELECT feedback_id, vote_type FROM feedback_votes 
                WHERE voter_hash = ? AND feedback_id IN ($placeholders)
            ");
            $vStmt->execute(array_merge([$voterHash], $ids));
            $votesMap = [];
            while ($row = $vStmt->fetch()) {
                $votesMap[$row['feedback_id']] = $row['vote_type'];
            }

            foreach ($records as &$rec) {
                $rec['user_vote'] = $votesMap[$rec['id']] ?? null;
            }
            unset($rec);
        }

        return $records;
    }

    public function updateStatus(string $feedbackId, string $status): bool {
        $allowed = ['New', 'Under Review', 'Planned', 'In Progress', 'Completed', 'Closed'];
        if (!in_array($status, $allowed, true)) {
            throw new InvalidArgumentException('Invalid status value.');
        }

        $stmt = $this->pdo->prepare("UPDATE feedback SET status = ? WHERE id = ?");
        $stmt->execute([$status, $feedbackId]);
        $success = $stmt->rowCount() > 0;
        if ($success) {
            $this->exportToTextFile();
        }
        return $success;
    }

    public function deleteFeedback(string $feedbackId): bool {
        $stmt = $this->pdo->prepare("DELETE FROM feedback WHERE id = ?");
        $stmt->execute([$feedbackId]);
        $success = $stmt->rowCount() > 0;
        if ($success) {
            $this->exportToTextFile();
        }
        return $success;
    }

    public function getSummaryMetrics(): array {
        $total = (int)$this->pdo->query("SELECT COUNT(*) FROM feedback")->fetchColumn();
        $avgRating = (float)$this->pdo->query("SELECT IFNULL(ROUND(AVG(rating), 2), 0.0) FROM feedback")->fetchColumn();
        $pendingReviews = (int)$this->pdo->query("SELECT COUNT(*) FROM feedback WHERE status = 'New'")->fetchColumn();

        $catStmt = $this->pdo->query("
            SELECT category, COUNT(*) as cnt 
            FROM feedback 
            GROUP BY category 
            ORDER BY cnt DESC
        ");
        $categoryBreakdown = [];
        while ($row = $catStmt->fetch()) {
            $categoryBreakdown[$row['category']] = (int)$row['cnt'];
        }

        $statusStmt = $this->pdo->query("
            SELECT status, COUNT(*) as cnt 
            FROM feedback 
            GROUP BY status
        ");
        $statusBreakdown = [];
        while ($row = $statusStmt->fetch()) {
            $statusBreakdown[$row['status']] = (int)$row['cnt'];
        }

        return [
            'total' => $total,
            'average_rating' => $avgRating,
            'pending_reviews' => $pendingReviews,
            'categories' => $categoryBreakdown,
            'statuses' => $statusBreakdown
        ];
    }

    public function exportToTextFile(): bool {
        try {
            $stmt = $this->pdo->query("SELECT * FROM feedback ORDER BY created_at DESC");
            $feedbacks = $stmt->fetchAll();

            $dateStr = date('Y-m-d H:i:s');
            $count = count($feedbacks);

            $out = "======================================================================\n";
            $out .= "STARTUP TINDAHAN HELPER — USER FEEDBACK & SUGGESTIONS EXPORT\n";
            $out .= "Authoritative Source: feedback.sqlite (Auto-Generated)\n";
            $out .= "Export Date: $dateStr\n";
            $out .= "Total Submissions: $count\n";
            $out .= "======================================================================\n\n";

            if ($count === 0) {
                $out .= "Wala pang naisusumiteng feedback o mungkahi sa kasalukuyan.\n";
            } else {
                foreach ($feedbacks as $fb) {
                    $stars = str_repeat('★', (int)$fb['rating']) . str_repeat('☆', 5 - (int)$fb['rating']);
                    $contactText = $fb['contact_consent'] ? "OO (Detalye: {$fb['contact_info']})" : "HINDI (Anonymous / No contact)";

                    $out .= "[ID: {$fb['id']}] [Petsa: {$fb['created_at']}]\n";
                    $out .= "Kategorya: [{$fb['category']}] | Status: [{$fb['status']}]\n";
                    $out .= "Rating: [{$stars}] ({$fb['rating']}/5 Stars)\n";
                    $out .= "Nagpadala: {$fb['name']}\n";
                    $out .= "Consent Makipag-ugnayan: {$contactText}\n";
                    $out .= "Pamagat: {$fb['title']}\n";
                    $out .= "Mensahe:\n  " . str_replace("\n", "\n  ", trim($fb['message'])) . "\n";
                    $out .= "Reaksyon: 👍 {$fb['likes']} Sang-ayon | 👎 {$fb['dislikes']} Hindi Sang-ayon\n";
                    $out .= "----------------------------------------------------------------------\n\n";
                }
            }

            return (bool)@file_put_contents($this->txtExportPath, $out, LOCK_EX);
        } catch (Exception $e) {
            error_log('Failed to export feedback.txt: ' . $e->getMessage());
            return false;
        }
    }
}
