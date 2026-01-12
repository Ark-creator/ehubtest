<?php

// Simple PHP API router to replace Node/Express backend

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// 2. Handle Preflight Requests (OPTIONS method)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 3. Require your Config (Database Connection)
// Make sure this file actually exists!
if (!file_exists(__DIR__ . '/config.php')) {
    http_response_code(500);
    echo json_encode(["error" => "Configuration file missing"]);
    exit;
}

require __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';

// Determine the base path (e.g. "/api") and trim it from the URI
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
if ($scriptDir !== '' && strpos($requestUri, $scriptDir) === 0) {
    $path = substr($requestUri, strlen($scriptDir));
} else {
    $path = $requestUri;
}
$path = '/' . trim($path, '/');

// Basic routing
switch ($method . ' ' . $path) {
    case 'GET /health':
        json_response([
            'status' => 'ok',
            'timestamp' => gmdate('c'),
        ]);
        break;

    case 'POST /auth/login':
        handle_login($pdo);
        break;

    case 'POST /auth/signup':
        handle_signup($pdo);
        break;

    case 'GET /projects':
        handle_get_projects($pdo);
        break;

    case 'POST /projects':
        handle_create_project($pdo);
        break;

    case 'GET /reports':
        handle_get_reports($pdo);
        break;

    case 'POST /reports':
        handle_create_report($pdo);
        break;

    case 'GET /tasks':
        handle_get_tasks($pdo);
        break;

    case 'POST /tasks':
        handle_create_task($pdo);
        break;

    case 'GET /worklogs':
        handle_get_worklogs($pdo);
        break;

    case 'POST /worklogs':
        handle_create_worklog($pdo);
        break;

    case 'GET /materials':
        handle_get_materials($pdo);
        break;

    case 'POST /materials':
        handle_create_material($pdo);
        break;

    case 'GET /users':
        handle_get_users($pdo);
        break;

    case 'POST /users/client':
        handle_create_client($pdo);
        break;

        // create supervisor
    case 'POST /users/supervisor':
        handle_create_supervisor($pdo);
        break;

    case 'POST /auth/logout':
        handle_logout();
        break;

    case 'GET /auth/me':
        handle_me($pdo);
        break;

    case 'GET /debug/test-password':
        // Debug endpoint to test password verification
        $stmt = $pdo->prepare('SELECT email, password_hash FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => 'admin@ehub.com']);
        $user = $stmt->fetch();
        
        $testPassword = 'admin123';
        $result = [
            'email' => $user['email'] ?? 'not found',
            'hash_exists' => !empty($user['password_hash']),
            'hash_length' => strlen($user['password_hash'] ?? ''),
            'hash_prefix' => substr($user['password_hash'] ?? '', 0, 7),
            'actual_hash' => $user['password_hash'] ?? '',
            'test_password' => $testPassword,
            'verification_result' => password_verify($testPassword, $user['password_hash'] ?? ''),
            'php_version' => PHP_VERSION
        ];
        json_response($result);
        break;

    case 'PUT /projects/:id':
        // Handle path parameter parsing manually since switch doesn't support regex directly
        // But for this simple router, we can assume ID is passed in URL logic if we used regex router.
        // Since we don't have regex router, we might need a different approach or just fallback.
        // Actually, let's stick to the current pattern.
        // For simple REST without regex router, we can't easily match /projects/123.
        // We'll use a hack or expected query param if possible, OR just check prefix.
        handle_update_project($pdo, $path);
        break;

    case 'DELETE /projects/:id':
        handle_delete_project($pdo, $path);
        break;
    
    // Using string matching for exact paths for new endpoints
    case 'POST /projects/broadcast-fabricators':
        handle_broadcast_fabricators($pdo);
        break;

    case 'POST /projects/respond-assignment':
        handle_respond_assignment($pdo);
        break;

    // We need to handle dynamic routes manually in the default or before switch
    default:
        // Simple manual router for dynamic paths
        if (preg_match('#^PUT /projects/([^/]+)$#', $method . ' ' . $path, $matches)) {
            handle_update_project($pdo, $matches[1]);
        } elseif (preg_match('#^PUT /reports/([^/]+)$#', $method . ' ' . $path, $matches)) {
            handle_update_report($pdo, $matches[1]);
        } elseif (preg_match('#^DELETE /reports/([^/]+)$#', $method . ' ' . $path, $matches)) {
            handle_delete_report($pdo, $matches[1]);
        } else {
            json_response(['error' => 'Not found'], 404);
        }
}

// --- Handlers ---
function handle_get_reports(PDO $pdo): void
{
    require_login();
    $userId = $_SESSION['user_id'];
    $role = $_SESSION['role'];

    if ($role === 'admin') {
        $sql = 'SELECT * FROM reports ORDER BY created_at DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
    } elseif ($role === 'supervisor') {
        $sql = 'SELECT * FROM reports WHERE created_by = :user_id OR status = "published" ORDER BY created_at DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':user_id' => $userId]);
    } else {
        $sql = 'SELECT * FROM reports WHERE status = "published" ORDER BY created_at DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
    }

    $reports = $stmt->fetchAll();

    foreach ($reports as &$report) {
        $report['data'] = $report['data'] ? json_decode($report['data'], true) : [];
        $report['filters'] = $report['filters'] ? json_decode($report['filters'], true) : [];
    }

    json_response($reports);
}

function handle_create_report(PDO $pdo): void
{
    require_login();

    // Only admin or supervisor can create reports
    if (!in_array($_SESSION['role'], ['admin', 'supervisor'])) {
        json_response(['error' => 'Only admin or supervisor can create reports'], 403);
    }

    $body = sanitize_recursive(json_input());

    if (empty($body['title']) || empty($body['type'])) {
        json_response(['error' => 'Title and type are required'], 400);
    }

    $reportId = 'report-' . time() . '-' . random_int(100, 999);

    $stmt = $pdo->prepare("
        INSERT INTO reports 
        (id, title, description, type, status, project_id, created_by, data, filters)
        VALUES (:id, :title, :description, :type, :status, :project_id, :created_by, :data, :filters)
    ");

    $stmt->execute([
        ':id' => $reportId,
        ':title' => $body['title'],
        ':description' => $body['description'] ?? null,
        ':type' => $body['type'],
        ':status' => $body['status'] ?? 'draft',
        ':project_id' => $body['projectId'] ?? null,
        ':created_by' => $_SESSION['user_id'],
        ':data' => json_encode($body['data'] ?? []),
        ':filters' => json_encode($body['filters'] ?? []),
    ]);

    $stmt = $pdo->prepare('SELECT * FROM reports WHERE id = :id');
    $stmt->execute([':id' => $reportId]);
    $report = $stmt->fetch();

    $report['data'] = $report['data'] ? json_decode($report['data'], true) : [];
    $report['filters'] = $report['filters'] ? json_decode($report['filters'], true) : [];

    json_response($report, 201);
}

function handle_update_report(PDO $pdo, string $reportId): void
{
    require_login();

    // Check ownership or admin
    $check = $pdo->prepare('SELECT created_by FROM reports WHERE id = :id');
    $check->execute([':id' => $reportId]);
    $existing = $check->fetch();

    if (!$existing || ($existing['created_by'] !== $_SESSION['user_id'] && $_SESSION['role'] !== 'admin')) {
        json_response(['error' => 'Unauthorized'], 403);
    }

    $body = sanitize_recursive(json_input());

    $fields = [];
    $params = [':id' => $reportId];

    $allowed = ['title', 'description', 'type', 'status'];
    foreach ($allowed as $field) {
        if (isset($body[$field])) {
            $fields[] = "$field = :$field";
            $params[":$field"] = $body[$field];
        }
    }

    if (isset($body['projectId'])) {
        $fields[] = 'project_id = :project_id';
        $params[':project_id'] = $body['projectId'];
    }

    if (isset($body['data'])) {
        $fields[] = 'data = :data';
        $params[':data'] = json_encode($body['data']);
    }

    if (isset($body['filters'])) {
        $fields[] = 'filters = :filters';
        $params[':filters'] = json_encode($body['filters']);
    }

    if (empty($fields)) {
        json_response(['message' => 'No changes provided']);
    }

    $sql = "UPDATE reports SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $stmt = $pdo->prepare('SELECT * FROM reports WHERE id = :id');
    $stmt->execute([':id' => $reportId]);
    $report = $stmt->fetch();

    $report['data'] = $report['data'] ? json_decode($report['data'], true) : [];
    $report['filters'] = $report['filters'] ? json_decode($report['filters'], true) : [];

    json_response($report);
}

function handle_delete_report(PDO $pdo, string $reportId): void
{
    require_login();

    // Check ownership or admin
    $check = $pdo->prepare('SELECT created_by FROM reports WHERE id = :id');
    $check->execute([':id' => $reportId]);
    $existing = $check->fetch();

    if (!$existing || ($existing['created_by'] !== $_SESSION['user_id'] && $_SESSION['role'] !== 'admin')) {
        json_response(['error' => 'Unauthorized'], 403);
    }

    $stmt = $pdo->prepare('DELETE FROM reports WHERE id = :id');
    $stmt->execute([':id' => $reportId]);

    json_response(['message' => 'Report deleted successfully']);
}
// Update handle_create_project to support broadcasting to all supervisors
function handle_create_project(PDO $pdo): void
{
    require_login();
    $body = sanitize_recursive(json_input());

    $projectId = 'project-' . time();

    $title = $body['name'] ?? $body['title'] ?? null;
    if (!$title) {
        json_response(['error' => 'Project title is required'], 400);
    }

    $pendingSupervisors = [];
    if (!empty($body['broadcastToSupervisors'])) {
        // Fetch all active supervisors
        $stmt = $pdo->query("SELECT id FROM users WHERE role = 'supervisor' AND is_active = 1");
        $supervisors = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $pendingSupervisors = $supervisors;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO projects (id, title, description, status, priority, progress, start_date, due_date, budget, client_id, supervisor_id, fabricator_ids, pending_supervisors)
         VALUES (:id, :title, :description, :status, :priority, :progress, :start_date, :due_date, :budget, :client_id, :supervisor_id, :fabricator_ids, :pending_supervisors)'
    );

    $stmt->execute([
        ':id' => $projectId,
        ':title' => $title,
        ':description' => $body['description'] ?? null,
        ':status' => $body['status'] ?? 'planning',
        ':priority' => $body['priority'] ?? 'medium',
        ':progress' => $body['progress'] ?? 0,
        ':start_date' => $body['startDate'] ?? null,
        ':due_date' => $body['endDate'] ?? ($body['dueDate'] ?? null),
        ':budget' => $body['budget'] ?? null,
        ':client_id' => $body['clientId'] ?? null,
        ':supervisor_id' => $body['supervisorId'] ?? null,
        ':fabricator_ids' => isset($body['fabricatorIds']) ? json_encode($body['fabricatorIds']) : json_encode([]),
        ':pending_supervisors' => json_encode($pendingSupervisors),
    ]);

    $stmt = $pdo->prepare('SELECT * FROM projects WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $projectId]);
    $project = $stmt->fetch();

    json_response($project);
}

function handle_update_project(PDO $pdo, string $id): void
{
    require_login();
    $body = sanitize_recursive(json_input());
    
    // Build dynamic update query
    $fields = [];
    $params = [':id' => $id];
    
    // Allowed fields to update
    $allowed = [
        'title', 'description', 'status', 'priority', 'progress', 
        'start_date', 'due_date', 'budget', 'client_id', 'supervisor_id'
    ];
    
    foreach ($allowed as $field) {
        // Map frontend camelCase to snake_case if needed, but for now assuming frontend sends matching or handled manually
        // Let's handle some common mappings
        $val = null;
        if (isset($body[$field])) $val = $body[$field];
        // Handle camelCase variations if passed from frontend
        if ($field === 'start_date' && isset($body['startDate'])) $val = $body['startDate'];
        if ($field === 'due_date' && isset($body['dueDate'])) $val = $body['dueDate'];
        if ($field === 'client_id' && isset($body['clientId'])) $val = $body['clientId'];
        if ($field === 'supervisor_id' && isset($body['supervisorId'])) $val = $body['supervisorId'];

        if ($val !== null) {
            $fields[] = "$field = :$field";
            $params[":$field"] = $val;
        }
    }

    if (isset($body['fabricatorIds'])) {
        $fields[] = "fabricator_ids = :fabricator_ids";
        $params[':fabricator_ids'] = json_encode($body['fabricatorIds']);
    }

     // Handle broadcast to supervisors on update if requested
    if (!empty($body['broadcastToSupervisors'])) {
         $stmt = $pdo->query("SELECT id FROM users WHERE role = 'supervisor' AND is_active = 1");
         $supervisors = $stmt->fetchAll(PDO::FETCH_COLUMN);
         $fields[] = "pending_supervisors = :pending_supervisors";
         $params[':pending_supervisors'] = json_encode($supervisors);
    }
    
    if (empty($fields)) {
        json_response(['message' => 'No changes provided']);
    }
    
    $sql = "UPDATE projects SET " . implode(', ', $fields) . " WHERE id = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    $stmt = $pdo->prepare('SELECT * FROM projects WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
    $project = $stmt->fetch();
    
    json_response($project);
}

function handle_delete_project(PDO $pdo, string $id): void
{
    require_login();
    // Only admin can delete? For now let supervisor/admin delete
    $stmt = $pdo->prepare('DELETE FROM projects WHERE id = :id');
    $stmt->execute([':id' => $id]);
    json_response(['message' => 'Project deleted']);
}

function handle_broadcast_fabricators(PDO $pdo): void
{
    require_login();
    $body = sanitize_recursive(json_input());
    $projectId = $body['projectId'] ?? null;
    $message = $body['message'] ?? '';

    if (!$projectId) {
        json_response(['error' => 'Project ID is required'], 400);
    }

    // Get all active fabricators
    $stmt = $pdo->query("SELECT id FROM users WHERE role = 'fabricator' AND is_active = 1");
    $fabricators = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (empty($fabricators)) {
         json_response(['message' => 'No active fabricators found']);
    }

    // Create pending assignments structures
    $newAssignments = [];
    foreach ($fabricators as $fabId) {
        $newAssignments[] = [
            'id' => 'pa-' . time() . '-' . substr(md5($fabId), 0, 5),
            'projectId' => $projectId,
            'fabricatorId' => $fabId,
            'assignedBy' => $_SESSION['user_id'],
            'assignedAt' => gmdate('c'),
            'status' => 'pending',
            'message' => $message
        ];
    }

    // Fetch existing pending assignments to merge or replace?
    // Usually "Send to All" might append or replace. Let's append but check duplicates.
    $stmt = $pdo->prepare('SELECT pending_assignments FROM projects WHERE id = :id');
    $stmt->execute([':id' => $projectId]);
    $row = $stmt->fetch();
    
    $existing = json_decode($row['pending_assignments'] ?? '[]', true) ?: [];
    
    // Filter out fabricators already in existing pending
    $existingFabIds = array_column($existing, 'fabricatorId');
    $finalAssignments = $existing;
    
    foreach ($newAssignments as $new) {
        if (!in_array($new['fabricatorId'], $existingFabIds)) {
            $finalAssignments[] = $new;
        }
    }

    $stmt = $pdo->prepare('UPDATE projects SET pending_assignments = :pa, status = :status WHERE id = :id');
    $stmt->execute([
        ':pa' => json_encode($finalAssignments),
        ':status' => 'pending-assignment',
        ':id' => $projectId
    ]);

    json_response(['message' => 'Broadcasted to ' . count($fabricators) . ' fabricators', 'assignments' => $finalAssignments]);
}

function handle_create_supervisor(PDO $pdo): void {
    require_login();
    if ($_SESSION['role'] !== 'admin') {
        json_response(['error' => 'Only administrators can create supervisors'], 403);
    }

    $body = sanitize_input(get_json_input());

    $required = ['name', 'email', 'password', 'phone', 'department'];
    foreach ($required as $field) {
        if (empty($body[$field])) {
            json_response(['error' => ucfirst($field) . ' is required'], 400);
        }
    }

    $name       = trim($body['name']);
    $email      = strtolower(trim($body['email']));
    $password   = $body['password'];
    $phone      = trim($body['phone']);
    $department = trim($body['department']);

    // Basic validation
    if (strlen($password) < 6) {
        json_response(['error' => 'Password must be at least 6 characters'], 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(['error' => 'Invalid email format'], 400);
    }
    if (!preg_match('/^(\+639|09)\d{9}$/', $phone)) {
        json_response(['error' => 'Invalid Philippine phone number format'], 400);
    }

    // Check duplicate
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? OR phone = ?");
    $stmt->execute([$email, $phone]);
    if ($stmt->fetch()) {
        json_response(['error' => 'Email or phone number already registered'], 409);
    }

    // Generate identifiers
    $time = time();
    $secureId = 'SUP' . strtoupper(base_convert($time, 10, 36)) . 
                strtoupper(substr(bin2hex(random_bytes(3)), 0, 4));
    $employeeNumber = 'S' . substr((string)$time, -7) . 
                      str_pad(random_int(0, 999), 3, '0', STR_PAD_LEFT);

    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $userId = 'sup-' . $time . '-' . random_int(100, 999);

    $stmt = $pdo->prepare("
        INSERT INTO users 
        (id, name, email, password_hash, role, phone, department, secure_id, employee_number, is_active, created_at)
        VALUES (?, ?, ?, ?, 'supervisor', ?, ?, ?, ?, 1, NOW())
    ");

    $stmt->execute([
        $userId, $name, $email, $passwordHash, $phone, $department, $secureId, $employeeNumber
    ]);

    json_response([
        'message' => 'Supervisor created successfully',
        'user' => [
            'id'              => $userId,
            'name'            => $name,
            'email'           => $email,
            'role'            => 'supervisor',
            'phone'           => $phone,
            'department'      => $department,
            'secure_id'       => $secureId,
            'employee_number' => $employeeNumber,
        ]
    ], 201);
}

function handle_respond_assignment(PDO $pdo): void
{
    require_login();
    $body = sanitize_recursive(json_input());
    $projectId = $body['projectId'] ?? null;
    $assignmentId = $body['assignmentId'] ?? null; // If accepting specific assignment ID
    $response = $body['response'] ?? 'accepted'; // accepted or declined
    $role = $_SESSION['role'];
    $userId = $_SESSION['user_id'];

    if (!$projectId) {
         json_response(['error' => 'Project ID is required'], 400);
    }
    
    // 1. Handle Supervisor Response (to a pending_supervisors broadcast)
    if ($role === 'supervisor') {
         // Check if this supervisor is in pending_supervisors
         $stmt = $pdo->prepare('SELECT pending_supervisors FROM projects WHERE id = :id');
         $stmt->execute([':id' => $projectId]);
         $proj = $stmt->fetch();
         $pendingSups = json_decode($proj['pending_supervisors'] ?? '[]', true) ?: [];
         
         if (in_array($userId, $pendingSups)) {
             if ($response === 'accepted') {
                 // Assign this supervisor, clear pending
                 $stmt = $pdo->prepare('UPDATE projects SET supervisor_id = :sid, pending_supervisors = NULL WHERE id = :pid');
                 $stmt->execute([':sid' => $userId, ':pid' => $projectId]);
                 json_response(['message' => 'Project accepted', 'status' => 'accepted']);
             } else {
                 // Declined: remove from pending list
                 $newPending = array_values(array_diff($pendingSups, [$userId]));
                 $stmt = $pdo->prepare('UPDATE projects SET pending_supervisors = :ps WHERE id = :pid');
                 $stmt->execute([':ps' => json_encode($newPending), ':pid' => $projectId]);
                 json_response(['message' => 'Project declined', 'status' => 'declined']);
             }
         }
    }

    // 2. Handle Fabricator Response
    if ($role === 'fabricator') {
        $stmt = $pdo->prepare('SELECT pending_assignments, fabricator_ids FROM projects WHERE id = :id');
        $stmt->execute([':id' => $projectId]);
        $proj = $stmt->fetch();
        
        $pending = json_decode($proj['pending_assignments'] ?? '[]', true) ?: [];
        $currentFabs = json_decode($proj['fabricator_ids'] ?? '[]', true) ?: [];
        
        $foundIndex = -1;
        // Find assignment by ID or by fabricatorID if ID not sent
        foreach ($pending as $idx => $assign) {
            if (($assignmentId && $assign['id'] === $assignmentId) || $assign['fabricatorId'] === $userId) {
                $foundIndex = $idx;
                break;
            }
        }
        
        if ($foundIndex !== -1) {
            if ($response === 'accepted') {
                $pending[$foundIndex]['status'] = 'accepted';
                $pending[$foundIndex]['respondedAt'] = gmdate('c');
                
                // Add to main fabricator list if not there
                if (!in_array($userId, $currentFabs)) {
                    $currentFabs[] = $userId;
                }
                
                $stmt = $pdo->prepare('UPDATE projects SET pending_assignments = :pa, fabricator_ids = :fids, status = :status WHERE id = :id');
                $stmt->execute([
                    ':pa' => json_encode($pending),
                    ':fids' => json_encode($currentFabs),
                    ':status' => 'in-progress', // Set to in-progress when someone accepts? Or keep pending-assignment? Let's say in-progress.
                    ':id' => $projectId
                ]);
            } else {
                $pending[$foundIndex]['status'] = 'declined';
                $pending[$foundIndex]['respondedAt'] = gmdate('c');
                
                // If declined, we just update the status in pending list
                $stmt = $pdo->prepare('UPDATE projects SET pending_assignments = :pa WHERE id = :id');
                $stmt->execute([':pa' => json_encode($pending), ':id' => $projectId]);
            }
            json_response(['message' => 'Assignment ' . $response, 'assignments' => $pending]);
        } else {
            json_response(['error' => 'No pending assignment found'], 404);
        }
    }
    
    json_response(['message' => 'No action taken']);
}
function handle_login(PDO $pdo): void
{
    $body = sanitize_recursive(json_input());
    $identifier = $body['identifier'] ?? '';
    $password = $body['password'] ?? '';

    if ($identifier === '' || $password === '') {
        json_response(['error' => 'Identifier and password are required'], 400);
    }

    // Try to match by email, secure_id, employee_number, or id
    // Also handle 'admin' shorthand mapping to the admin user
    $searchId = $identifier;
    if (strtolower($identifier) === 'admin') {
        $stmt = $pdo->prepare('SELECT * FROM users WHERE role = "admin" AND is_active = 1 LIMIT 1');
        $stmt->execute();
    } else {
        $stmt = $pdo->prepare(
            'SELECT * FROM users WHERE (id = :id OR secure_id = :id OR employee_number = :id OR email = :id) AND is_active = 1 LIMIT 1'
        );
        $stmt->execute([':id' => $searchId]);
    }
    $user = $stmt->fetch();

    if (!$user) {
        json_response(['error' => 'User not found'], 404);
    }

    if (!password_verify($password, $user['password_hash'])) {
        json_response(['error' => 'Invalid password'], 401);
    }

    // Establish PHP session
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['role'] = $user['role'];

    // For frontend compatibility, still return a token string
    $token = base64_encode(random_bytes(32));

    unset($user['password_hash']);

    json_response([
        'user' => $user,
        'token' => $token,
    ]);
}

function handle_signup(PDO $pdo): void
{
    $body = sanitize_recursive(json_input());

    $email = isset($body['email']) ? trim(strtolower($body['email'])) : '';
    $password = $body['password'] ?? '';
    $name = trim($body['name'] ?? '');

    if ($email === '' || $password === '' || $name === '') {
        json_response(['error' => 'Email, password, and name are required'], 400);
    }

    // Check existing user
    $check = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $check->execute([':email' => $email]);
    if ($check->fetch()) {
        json_response(['error' => 'User already exists with this email'], 409);
    }

    $secureId = 'FAB' . strtoupper(base_convert(time(), 10, 36)) . strtoupper(substr(bin2hex(random_bytes(2)), 0, 3));
    $employeeNumber = 'EMP' . substr((string)time(), -6) . str_pad((string)random_int(0, 999), 3, '0', STR_PAD_LEFT);
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    $userId = 'user-' . time();

    $stmt = $pdo->prepare(
        'INSERT INTO users (id, name, email, password_hash, role, school, phone, gcash_number, secure_id, employee_number, is_active)
         VALUES (:id, :name, :email, :password_hash, :role, :school, :phone, :gcash_number, :secure_id, :employee_number, 1)'
    );
    $stmt->execute([
        ':id' => $userId,
        ':name' => $name,
        ':email' => $email,
        ':password_hash' => $passwordHash,
        ':role' => 'fabricator',
        ':school' => $body['school'] ?? null,
        ':phone' => $body['phone'] ?? null,
        ':gcash_number' => $body['gcashNumber'] ?? null,
        ':secure_id' => $secureId,
        ':employee_number' => $employeeNumber,
    ]);

    $user = [
        'id' => $userId,
        'name' => $name,
        'email' => $email,
        'role' => 'fabricator',
        'school' => $body['school'] ?? null,
        'phone' => $body['phone'] ?? null,
        'gcash_number' => $body['gcashNumber'] ?? null,
        'secure_id' => $secureId,
        'employee_number' => $employeeNumber,
        'is_active' => 1,
    ];

    // Auto-login new user into session
    $_SESSION['user_id'] = $userId;
    $_SESSION['role'] = 'fabricator';

    $token = base64_encode(random_bytes(32));

    json_response([
        'user' => $user,
        'token' => $token,
    ]);
}

function handle_logout(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params['path'], $params['domain'],
            $params['secure'], $params['httponly']
        );
    }
    session_destroy();
    json_response(['message' => 'Logged out']);
}

function handle_me(PDO $pdo): void
{
    if (empty($_SESSION['user_id'])) {
        json_response(['user' => null]);
    }
    $stmt = $pdo->prepare('SELECT id, name, email, role, school, phone, gcash_number, secure_id, employee_number, is_active, created_at FROM users WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!$user) {
        json_response(['user' => null]);
    }
    json_response(['user' => $user]);
}

function handle_get_projects(PDO $pdo): void
{
    require_login();
    $stmt = $pdo->query('SELECT * FROM projects ORDER BY created_at DESC');
    $projects = $stmt->fetchAll();
    json_response($projects);
}



function handle_get_tasks(PDO $pdo): void
{
    require_login();
    $stmt = $pdo->query('SELECT * FROM tasks ORDER BY created_at DESC');
    $tasks = $stmt->fetchAll();
    json_response($tasks);
}

function handle_create_task(PDO $pdo): void
{
    require_login();
    $body = sanitize_recursive(json_input());
    $taskId = 'task-' . time();

    if (empty($body['projectId']) || empty($body['title'])) {
        json_response(['error' => 'projectId and title are required'], 400);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO tasks (id, project_id, title, description, status, priority, assigned_to, created_by, due_date, estimated_hours, actual_hours)
         VALUES (:id, :project_id, :title, :description, :status, :priority, :assigned_to, :created_by, :due_date, :estimated_hours, :actual_hours)'
    );

    $stmt->execute([
        ':id' => $taskId,
        ':project_id' => $body['projectId'],
        ':title' => $body['title'],
        ':description' => $body['description'] ?? null,
        ':status' => $body['status'] ?? 'pending',
        ':priority' => $body['priority'] ?? 'medium',
        ':assigned_to' => $body['assignedTo'] ?? null,
        ':created_by' => $body['createdBy'] ?? null,
        ':due_date' => $body['dueDate'] ?? null,
        ':estimated_hours' => $body['estimatedHours'] ?? 0,
        ':actual_hours' => $body['actualHours'] ?? 0,
    ]);

    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $taskId]);
    $task = $stmt->fetch();

    json_response($task);
}

function handle_get_worklogs(PDO $pdo): void
{
    require_login();
    $stmt = $pdo->query('SELECT * FROM work_logs ORDER BY created_at DESC');
    $logs = $stmt->fetchAll();
    json_response($logs);
}

function handle_create_worklog(PDO $pdo): void
{
    require_login();
    $body = sanitize_recursive(json_input());
    $workLogId = 'wl-' . time();

    if (empty($body['projectId']) || empty($body['userId']) || empty($body['date']) || !isset($body['hoursWorked'])) {
        json_response(['error' => 'projectId, userId, date, and hoursWorked are required'], 400);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO work_logs (id, project_id, user_id, date, hours_worked, description, progress_percentage)
         VALUES (:id, :project_id, :user_id, :date, :hours_worked, :description, :progress_percentage)'
    );

    $stmt->execute([
        ':id' => $workLogId,
        ':project_id' => $body['projectId'],
        ':user_id' => $body['userId'],
        ':date' => $body['date'],
        ':hours_worked' => $body['hoursWorked'],
        ':description' => $body['description'] ?? null,
        ':progress_percentage' => $body['progressPercentage'] ?? 0,
    ]);

    $stmt = $pdo->prepare('SELECT * FROM work_logs WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $workLogId]);
    $log = $stmt->fetch();

    json_response($log);
}

function handle_get_materials(PDO $pdo): void
{
    require_login();
    $stmt = $pdo->query('SELECT * FROM materials ORDER BY added_at DESC');
    $materials = $stmt->fetchAll();
    json_response($materials);
}

function handle_create_material(PDO $pdo): void
{
    require_login();
    $body = sanitize_recursive(json_input());
    $materialId = 'mat-' . time();

    if (empty($body['projectId']) || empty($body['name']) || !isset($body['quantity'])) {
        json_response(['error' => 'projectId, name, and quantity are required'], 400);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO materials (id, project_id, name, description, quantity, unit, cost_per_unit, total_cost)
         VALUES (:id, :project_id, :name, :description, :quantity, :unit, :cost_per_unit, :total_cost)'
    );

    $stmt->execute([
        ':id' => $materialId,
        ':project_id' => $body['projectId'],
        ':name' => $body['name'],
        ':description' => $body['description'] ?? null,
        ':quantity' => $body['quantity'],
        ':unit' => $body['unit'] ?? null,
        ':cost_per_unit' => $body['costPerUnit'] ?? null,
        ':total_cost' => $body['totalCost'] ?? null,
    ]);

    $stmt = $pdo->prepare('SELECT * FROM materials WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $materialId]);
    $material = $stmt->fetch();

    json_response($material);
}

function handle_get_users(PDO $pdo): void
{
    require_login();
    $stmt = $pdo->query(
        'SELECT id, name, email, role, school, phone, gcash_number, secure_id, employee_number, is_active, created_at
         FROM users ORDER BY created_at DESC'
    );
    $users = $stmt->fetchAll();
    json_response($users);
}

function handle_create_client(PDO $pdo): void
{
    require_login();
    $body = sanitize_recursive(json_input());

    $name = trim($body['name'] ?? '');
    $email = isset($body['email']) ? trim(strtolower($body['email'])) : '';
    $password = $body['password'] ?? '';
    $projectId = $body['projectId'] ?? null;
    $projectName = $body['projectName'] ?? null;

    if ($name === '' || $email === '' || $password === '' || !$projectId) {
        json_response(['error' => 'Name, email, password, and projectId are required'], 400);
    }

    $check = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $check->execute([':email' => $email]);
    if ($check->fetch()) {
        json_response(['error' => 'User already exists with this email'], 409);
    }

    $secureId = 'CLI' . strtoupper(base_convert(time(), 10, 36)) . strtoupper(substr(bin2hex(random_bytes(2)), 0, 3));
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    $userId = 'user-' . time();

    $stmt = $pdo->prepare(
        'INSERT INTO users (id, name, email, password_hash, role, school, phone, secure_id, client_project_id, is_active)
         VALUES (:id, :name, :email, :password_hash, :role, :school, :phone, :secure_id, :client_project_id, 1)'
    );

    $stmt->execute([
        ':id' => $userId,
        ':name' => $name,
        ':email' => $email,
        ':password_hash' => $passwordHash,
        ':role' => 'client',
        ':school' => $projectName,
        ':phone' => $body['phone'] ?? null,
        ':secure_id' => $secureId,
        ':client_project_id' => $projectId,
    ]);

    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch();
    unset($user['password_hash']);

    json_response(['user' => $user]);
}