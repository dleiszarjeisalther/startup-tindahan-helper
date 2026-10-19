<?php
/**
 * Test Suite for Website Feedback System & SQLite Database
 * Verifies Tasks 06, 07, 08, 09
 */

require_once __DIR__ . '/../marketing/website/api/FeedbackDb.php';

echo "--- Running Website Feedback & SQLite Backend Tests ---\n";

$db = FeedbackDb::getInstance();

// Test 1: Add Feedback Entry
$testData = [
    'name' => 'Ate Marites',
    'category' => 'Suggestion',
    'rating' => 5,
    'title' => 'Offline Barcode Scanner Sound Test',
    'message' => 'Napakaganda ng app! Baka puwede maglagay ng chime sound kapag successful ang scan ng barcode.',
    'contact_consent' => 1,
    'contact_info' => '09181234567'
];

$added = $db->addFeedback($testData, '127.0.0.1');
assert(!empty($added['id']), 'Feedback ID should be generated');
assert($added['name'] === 'Ate Marites', 'Name should match');
assert($added['rating'] === 5, 'Rating should be 5');
echo "✓ Test 1: Added feedback record successfully (ID: {$added['id']})\n";

$fbId = $added['id'];

// Test 2: Voting & Deduplication
$voterHash1 = hash('sha256', 'voter1_salt');
$voteResult1 = $db->castVote($fbId, $voterHash1, 'like');
assert($voteResult1['likes'] === 1, 'Likes count should be 1');
assert($voteResult1['user_action'] === 'like', 'Action should be like');
echo "✓ Test 2.1: First like vote registered (Likes: {$voteResult1['likes']})\n";

// Test 2.2: Second like by same voter should unvote (toggle off)
$voteResult2 = $db->castVote($fbId, $voterHash1, 'like');
assert($voteResult2['likes'] === 0, 'Likes count should toggle back to 0 on second click');
assert($voteResult2['user_action'] === 'unvoted', 'Action should be unvoted');
echo "✓ Test 2.2: Repeated like by same voter toggled off (Likes: {$voteResult2['likes']})\n";

// Test 2.3: Re-vote and switch from like to dislike
$db->castVote($fbId, $voterHash1, 'like');
$switchResult = $db->castVote($fbId, $voterHash1, 'dislike');
assert($switchResult['likes'] === 0, 'Likes should decrease by 1 when switching to dislike');
assert($switchResult['dislikes'] === 1, 'Dislikes should increase by 1');
echo "✓ Test 2.3: Switched vote from like to dislike (Likes: {$switchResult['likes']}, Dislikes: {$switchResult['dislikes']})\n";

// Test 3: Status Update
$statusUpdated = $db->updateStatus($fbId, 'Planned');
assert($statusUpdated === true, 'Status update should return true');
$feedbacks = $db->getFeedbacks(['status' => 'Planned']);
assert(count($feedbacks) >= 1, 'Should find planned feedback');
echo "✓ Test 3: Status updated to 'Planned' and filtered successfully\n";

// Test 4: Summary Metrics
$metrics = $db->getSummaryMetrics();
assert($metrics['total'] >= 1, 'Total should be at least 1');
assert(isset($metrics['categories']['Suggestion']), 'Category Suggestion should be recorded');
echo "✓ Test 4: Summary metrics calculated correctly (Total: {$metrics['total']}, Avg Rating: {$metrics['average_rating']})\n";

// Test 5: Authoritative Text Export
$txtFile = __DIR__ . '/../marketing/website/feedback.txt';
assert(file_exists($txtFile), 'feedback.txt should exist');
$txtContent = file_get_contents($txtFile);
assert(strpos($txtContent, 'STARTUP TINDAHAN HELPER') !== false, 'feedback.txt should contain header');
assert(strpos($txtContent, $fbId) !== false, 'feedback.txt should contain test feedback ID');
assert(strpos($txtContent, 'Ate Marites') !== false, 'feedback.txt should contain submitter name');
echo "✓ Test 5: feedback.txt generated authoritatively from SQLite\n";

// Cleanup test entry
$db->deleteFeedback($fbId);
echo "✓ Test 6: Cleaned up test record\n";

echo "--- ALL WEBSITE FEEDBACK & SQLITE TESTS PASSED ---\n";
