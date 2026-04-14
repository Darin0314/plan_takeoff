<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/src/config.php';
require_once __DIR__ . '/src/Models/Database.php';
require_once __DIR__ . '/src/Models/Project.php';
require_once __DIR__ . '/src/Models/ProjectFile.php';
require_once __DIR__ . '/src/Models/TakeoffRun.php';
require_once __DIR__ . '/src/Controllers/ProjectController.php';
require_once __DIR__ . '/src/Controllers/UploadController.php';
require_once __DIR__ . '/src/Controllers/TakeoffController.php';

$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = rtrim(preg_replace('#^/api#', '', $uri), '/');
$parts  = explode('/', ltrim($uri, '/'));

try {
    $resource = $parts[0] ?? '';
    $id       = isset($parts[1]) && is_numeric($parts[1]) ? (int)$parts[1] : null;
    $sub      = $parts[2] ?? '';

    if ($resource === 'projects') {
        $ctrl = new ProjectController();

        if ($id && $sub === 'upload' && $method === 'POST') {
            (new UploadController())->store($id);
        } elseif ($id && $sub === 'files' && $method === 'GET') {
            // list files for project — return from withFiles
            $project = Project::withFiles($id);
            echo json_encode(['files' => $project['files'] ?? []]);
        } elseif ($id && $sub === 'takeoffs' && $method === 'POST') {
            (new TakeoffController())->run($id);
        } elseif ($id && $sub === 'takeoffs' && $method === 'GET') {
            (new TakeoffController())->forProject($id);
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
        } else {
            http_response_code(404); echo json_encode(['error' => 'Not found']);
        }

    } elseif ($resource === 'takeoffs') {
        if ($method === 'GET') {
            (new TakeoffController())->show($id);
        } else {
            http_response_code(405); echo json_encode(['error' => 'Method not allowed']);
        }

    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found', 'uri' => $uri]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
