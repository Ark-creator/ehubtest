<?php


$allowed_origins = ['http://localhost:3000', 'http://localhost:5174']; 
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle Preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. Start Session AFTER headers are ready
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Database config – adjust to match your phpMyAdmin/MySQL setup if needed
$dbHost = getenv('DB_HOST') ?: 'localhost';
$dbUser = getenv('DB_USER') ?: 'root';         // Fixed: Default XAMPP user
$dbPass = getenv('DB_PASSWORD') ?: '';         // Fixed: Default XAMPP pass is empty
$dbName = getenv('DB_NAME') ?: 'ehubph_pms2';   // Fixed: Corrected typo (ehub_pms -> ehubph_pms)
$dbPort = getenv('DB_PORT') ?: '3306';

try {
    $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

function json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function require_login(): void
{
    if (empty($_SESSION['user_id'])) {
        json_response(['error' => 'Unauthorized'], 401);
    }
}

function sanitize_recursive($value)
{
    if (is_string($value)) {
        // Strip basic script tags
        return preg_replace('#<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>#i', '', $value);
    }
    if (is_array($value)) {
        foreach ($value as $k => $v) {
            $value[$k] = sanitize_recursive($v);
        }
    }
    return $value;
}
