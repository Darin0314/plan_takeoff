<?php
class ProjectController {
    public function index(): void {
        $projects = Project::all();
        echo json_encode(['projects' => $projects]);
    }

    public function show(int $id): void {
        $project = Project::withFiles($id);
        if (!$project) { http_response_code(404); echo json_encode(['error' => 'Not found']); return; }
        echo json_encode(['project' => $project]);
    }

    public function store(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($data['name'])) {
            http_response_code(422);
            echo json_encode(['error' => 'Name is required']);
            return;
        }
        $id = Project::create($data);
        http_response_code(201);
        echo json_encode(['id' => $id, 'project' => Project::find($id)]);
    }

    public function update(int $id): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (!Project::find($id)) { http_response_code(404); echo json_encode(['error' => 'Not found']); return; }
        Project::update($id, $data);
        echo json_encode(['project' => Project::find($id)]);
    }

    public function destroy(int $id): void {
        if (!Project::find($id)) { http_response_code(404); echo json_encode(['error' => 'Not found']); return; }
        Project::delete($id);
        echo json_encode(['success' => true]);
    }

    public function sheets(int $projectId): void {
        if (!Project::find($projectId)) { http_response_code(404); echo json_encode(['error' => 'Not found']); return; }
        $db   = Database::get();
        $stmt = $db->prepare("
            SELECT ps.id, ps.file_id, ps.page_number, ps.sheet_number, ps.sheet_title,
                   ps.sheet_type, ps.drawing_scale, ps.page_image_path, ps.thumbnail_path,
                   ps.floor_multiplier, ps.floor_multiplier_note
            FROM plan_sheets ps
            JOIN project_files pf ON pf.id = ps.file_id
            WHERE pf.project_id = ?
            ORDER BY ps.file_id, ps.page_number
        ");
        $stmt->execute([$projectId]);
        echo json_encode(['sheets' => $stmt->fetchAll()]);
    }

    public function detectFloors(int $projectId): void {
        if (!Project::find($projectId)) { http_response_code(404); echo json_encode(['error' => 'Not found']); return; }
        $payload = json_encode(['project_id' => $projectId]);
        $ch = curl_init(AI_API_URL . '/detect-floors');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
        ]);
        curl_exec($ch);
        curl_close($ch);
        echo json_encode(['status' => 'detecting', 'project_id' => $projectId]);
    }

    public function floorMultipliers(int $projectId): void {
        if (!Project::find($projectId)) { http_response_code(404); echo json_encode(['error' => 'Not found']); return; }
        $db   = Database::get();
        $stmt = $db->prepare("
            SELECT ps.id, ps.sheet_number, ps.sheet_title, ps.sheet_type,
                   ps.floor_multiplier, ps.floor_multiplier_note
            FROM plan_sheets ps
            JOIN project_files pf ON pf.id = ps.file_id
            WHERE pf.project_id = ?
            ORDER BY ps.file_id, ps.page_number
        ");
        $stmt->execute([$projectId]);
        echo json_encode(['sheets' => $stmt->fetchAll()]);
    }

    public function updateSheetMultiplier(int $sheetId): void {
        $db   = Database::get();
        $stmt = $db->prepare("SELECT id FROM plan_sheets WHERE id = ?");
        $stmt->execute([$sheetId]);
        if (!$stmt->fetch()) { http_response_code(404); echo json_encode(['error' => 'Sheet not found']); return; }

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $mult = isset($data['floor_multiplier']) ? (float)$data['floor_multiplier'] : null;
        $note = isset($data['floor_multiplier_note']) ? trim($data['floor_multiplier_note']) : null;

        if ($mult === null || $mult < 1) {
            http_response_code(422);
            echo json_encode(['error' => 'floor_multiplier must be ≥ 1']);
            return;
        }

        $db->prepare("UPDATE plan_sheets SET floor_multiplier = ?, floor_multiplier_note = ? WHERE id = ?")
           ->execute([$mult, $note, $sheetId]);

        $stmt = $db->prepare("SELECT id, sheet_number, sheet_title, floor_multiplier, floor_multiplier_note FROM plan_sheets WHERE id = ?");
        $stmt->execute([$sheetId]);
        echo json_encode(['sheet' => $stmt->fetch()]);
    }
}
