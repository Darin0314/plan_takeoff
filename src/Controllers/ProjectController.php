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
                   ps.sheet_type, ps.drawing_scale, ps.page_image_path, ps.thumbnail_path
            FROM plan_sheets ps
            JOIN project_files pf ON pf.id = ps.file_id
            WHERE pf.project_id = ?
            ORDER BY ps.file_id, ps.page_number
        ");
        $stmt->execute([$projectId]);
        echo json_encode(['sheets' => $stmt->fetchAll()]);
    }
}
