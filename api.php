<?php
session_start();

// PDF endpoint skips JSON content-type — set after routing
$uri_check = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri_check  = rtrim(preg_replace('#^/api#', '', $uri_check), '/');
$is_pdf = preg_match('#^/takeoffs/\d+/pdf$#', $uri_check);

if (!$is_pdf) {
    header('Content-Type: application/json');
}
header('Access-Control-Allow-Origin: http://localhost:8106');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/src/config.php';
require_once __DIR__ . '/src/Models/Database.php';
require_once __DIR__ . '/src/Models/Project.php';
require_once __DIR__ . '/src/Models/ProjectFile.php';
require_once __DIR__ . '/src/Models/TakeoffRun.php';
require_once __DIR__ . '/src/Controllers/ProjectController.php';
require_once __DIR__ . '/src/Controllers/UploadController.php';
require_once __DIR__ . '/src/Controllers/TakeoffController.php';
require_once __DIR__ . '/src/Controllers/ReportController.php';
require_once __DIR__ . '/src/Models/UnitCost.php';
require_once __DIR__ . '/src/Controllers/CostController.php';
require_once __DIR__ . '/src/Controllers/DiffController.php';
require_once __DIR__ . '/src/Controllers/ProjectCompareController.php';
require_once __DIR__ . '/src/Controllers/ShareController.php';
require_once __DIR__ . '/src/Controllers/SupplierController.php';
require_once __DIR__ . '/src/Controllers/SheetNoteController.php';
require_once __DIR__ . '/src/Controllers/AnnotationController.php';
require_once __DIR__ . '/src/Services/ActivityLogger.php';

$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = rtrim(preg_replace('#^/api#', '', $uri), '/');
$parts  = explode('/', ltrim($uri, '/'));

try {
    $resource = $parts[0] ?? '';
    $id       = isset($parts[1]) && is_numeric($parts[1]) ? (int)$parts[1] : null;
    $sub      = $parts[2] ?? '';

    // ── Auth routes (no session required) ──────────────────────────────────
    if ($resource === 'auth') {
        $action = $parts[1] ?? '';

        if ($action === 'login' && $method === 'POST') {
            $d = json_decode(file_get_contents('php://input'), true) ?? [];
            $db = Database::get();
            $st = $db->prepare("SELECT * FROM users WHERE email = ?");
            $st->execute([$d['email'] ?? '']);
            $user = $st->fetch(PDO::FETCH_ASSOC);
            if (!$user || !password_verify($d['password'] ?? '', $user['password'])) {
                http_response_code(401);
                echo json_encode(['error' => 'Invalid email or password']);
                exit;
            }
            $_SESSION['user_id']    = $user['id'];
            $_SESSION['user_email'] = $user['email'];
            $_SESSION['user_name']  = $user['name'];
            echo json_encode(['user' => ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email']]]);
            exit;

        } elseif ($action === 'logout' && $method === 'POST') {
            session_destroy();
            echo json_encode(['success' => true]);
            exit;

        } elseif ($action === 'me' && $method === 'GET') {
            if (empty($_SESSION['user_id'])) {
                http_response_code(401);
                echo json_encode(['error' => 'Not authenticated']);
                exit;
            }
            echo json_encode(['user' => [
                'id'    => $_SESSION['user_id'],
                'name'  => $_SESSION['user_name'],
                'email' => $_SESSION['user_email'],
            ]]);
            exit;
        }

        http_response_code(404); echo json_encode(['error' => 'Not found']); exit;
    }

    // ── Public share route (no session required) ───────────────────────────
    if ($resource === 'share' && $method === 'GET' && isset($parts[1])) {
        (new ShareController())->publicShow($parts[1]);
        exit;
    }

    // ── Public PDF via share token: GET /takeoffs/{id}/pdf?token={token} ──
    if ($resource === 'takeoffs' && $method === 'GET' && $sub === 'pdf' && !empty($_GET['token'])) {
        $db    = Database::get();
        $stmt  = $db->prepare("SELECT * FROM shared_reports WHERE token = ? AND run_id = ?");
        $stmt->execute([$_GET['token'], $id]);
        $share = $stmt->fetch();
        if ($share && (!$share['expires_at'] || strtotime($share['expires_at']) >= time())) {
            (new ReportController())->pdf($id);
            exit;
        }
        http_response_code(403);
        echo json_encode(['error' => 'Invalid or expired share token']);
        exit;
    }

    // ── Session guard — all other routes require login ─────────────────────
    if (empty($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Not authenticated']);
        exit;
    }

    if ($resource === 'projects' && $id === null && isset($_GET['a']) && $method === 'GET') {
        (new ProjectCompareController())->compare();

    } elseif ($resource === 'projects') {
        $ctrl = new ProjectController();

        if ($id && $sub === 'upload' && $method === 'POST') {
            (new UploadController())->store($id);
        } elseif ($id && $sub === 'sheets' && $method === 'GET') {
            $ctrl->sheets($id);
        } elseif ($id && $sub === 'detect-floors' && $method === 'POST') {
            $ctrl->detectFloors($id);
        } elseif ($id && $sub === 'floor-multipliers' && $method === 'GET') {
            $ctrl->floorMultipliers($id);
        } elseif ($id && $sub === 'detect-unit-types' && $method === 'POST') {
            $ctrl->detectUnitTypes($id);
        } elseif ($id && $sub === 'unit-types' && $method === 'GET') {
            $ctrl->unitTypes($id);
        } elseif ($id && $sub === 'files' && $method === 'GET') {
            // list files for project — return from withFiles
            $project = Project::withFiles($id);
            echo json_encode(['files' => $project['files'] ?? []]);
        } elseif ($id && $sub === 'takeoffs' && ($parts[3] ?? '') === 'all-trades' && $method === 'POST') {
            (new TakeoffController())->runAllTrades($id);
        } elseif ($id && $sub === 'takeoffs' && ($parts[3] ?? '') === 'batch-status' && $method === 'GET') {
            (new TakeoffController())->batchStatus($id);
        } elseif ($id && $sub === 'takeoffs' && $method === 'POST') {
            (new TakeoffController())->run($id);
        } elseif ($id && $sub === 'takeoffs' && $method === 'GET') {
            (new TakeoffController())->forProject($id);
        } elseif ($id && $sub === 'activity' && $method === 'GET') {
            $ctrl->activity($id);
        } elseif ($id && !$sub && $method === 'GET')    { $ctrl->show($id); }
        elseif ($id && !$sub && $method === 'PUT')      { $ctrl->update($id); }
        elseif ($id && !$sub && $method === 'DELETE')   { $ctrl->destroy($id); }
        elseif (!$id && $method === 'GET')              { $ctrl->index(); }
        elseif (!$id && $method === 'POST')             { $ctrl->store(); }
        else { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); }

    } elseif ($resource === 'files') {
        $sub2 = $parts[2] ?? '';
        if ($sub2 === 'sheets' && $method === 'GET') {
            (new UploadController())->sheets($id);
        } elseif ($sub2 === 'active' && $method === 'PUT') {
            (new UploadController())->toggleActive($id);
        } elseif ($sub2 === 'reorder' && $method === 'PUT') {
            (new UploadController())->reorder($id);
        } elseif ($sub2 === 'reprocess' && $method === 'POST') {
            (new UploadController())->reprocess($id);
        } else {
            http_response_code(404); echo json_encode(['error' => 'Not found']);
        }

    } elseif ($resource === 'takeoffs') {
        if ($method === 'GET' && $sub === 'pdf') {
            (new ReportController())->pdf($id);
        } elseif ($method === 'GET' && $sub === 'cost-summary') {
            (new CostController())->costSummary($id);
        } elseif ($method === 'GET' && $sub === 'diff') {
            (new DiffController())->compare($id);
        } elseif ($method === 'GET' && $sub === 'file-breakdown') {
            (new TakeoffController())->fileBreakdown($id);
        } elseif ($method === 'POST' && $sub === 'share') {
            (new ShareController())->create($id);
        } elseif ($method === 'GET' && $sub === 'shares') {
            (new ShareController())->list($id);
        } elseif ($method === 'GET' && $sub === 'supplier-match') {
            (new SupplierController())->supplierMatch($id);
        } elseif ($method === 'GET' && $sub === 'annotations') {
            (new AnnotationController())->forRun($id);
        } elseif ($method === 'GET' && !$sub) {
            (new TakeoffController())->show($id);
        } else {
            http_response_code(405); echo json_encode(['error' => 'Method not allowed']);
        }

    } elseif ($resource === 'shares') {
        $token = $parts[1] ?? '';
        if ($method === 'DELETE' && $token) {
            (new ShareController())->revoke($token);
        } else {
            http_response_code(405); echo json_encode(['error' => 'Method not allowed']);
        }

    } elseif ($resource === 'sheets') {
        $sub2 = $parts[2] ?? '';
        if ($method === 'PUT' && !$sub2) {
            (new ProjectController())->updateSheetMultiplier($id);
        } elseif ($method === 'PUT' && $sub2 === 'unit-type') {
            (new ProjectController())->updateSheetUnitType($id);
        } elseif ($sub2 === 'notes' && $method === 'GET') {
            (new SheetNoteController())->index($id);
        } elseif ($sub2 === 'notes' && $method === 'POST') {
            (new SheetNoteController())->store($id);
        } elseif ($sub2 === 'annotate' && $method === 'POST') {
            (new AnnotationController())->generate($id);
        } elseif ($sub2 === 'annotate' && $method === 'GET') {
            (new AnnotationController())->show($id);
        } else {
            http_response_code(405); echo json_encode(['error' => 'Method not allowed']);
        }

    } elseif ($resource === 'sheet-notes') {
        if ($id && $method === 'DELETE') {
            (new SheetNoteController())->destroy($id);
        } else {
            http_response_code(405); echo json_encode(['error' => 'Method not allowed']);
        }

    } elseif ($resource === 'takeoff-items') {
        $ctrl = new TakeoffController();
        $sub2 = $parts[2] ?? '';
        if ($method === 'PUT' && !$sub2) {
            $ctrl->updateItem($id);
        } elseif ($method === 'POST' && $sub2 === 'reset') {
            $ctrl->resetItem($id);
        } elseif ($method === 'PUT' && $sub2 === 'cost') {
            (new CostController())->setItemCost($id);
        } elseif ($method === 'PUT' && $sub2 === 'annotation') {
            $ctrl->setAnnotation($id);
        } else {
            http_response_code(405); echo json_encode(['error' => 'Method not allowed']);
        }

    } elseif ($resource === 'unit-costs') {
        $ctrl = new CostController();
        if (!$id && $method === 'GET')    { $ctrl->index(); }
        elseif (!$id && $method === 'POST')  { $ctrl->store(); }
        elseif ($id  && $method === 'PUT')   { $ctrl->update($id); }
        elseif ($id  && $method === 'DELETE'){ $ctrl->destroy($id); }
        else { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); }

    } elseif ($resource === 'supplier-price-lists') {
        $ctrl = new SupplierController();
        if (!$id && $method === 'GET')       { $ctrl->index(); }
        elseif (!$id && $method === 'POST')  { $ctrl->store(); }
        elseif ($id  && $method === 'DELETE'){ $ctrl->destroy($id); }
        else { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); }

    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found', 'uri' => $uri]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
