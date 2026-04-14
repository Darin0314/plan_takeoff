<?php
class SheetNoteController {

    public function index(int $sheetId): void {
        $db   = Database::connect();
        $stmt = $db->prepare("
            SELECT sn.id, sn.sheet_id, sn.x_pct, sn.y_pct, sn.note, sn.color,
                   sn.created_at, u.name AS user_name
            FROM sheet_notes sn
            LEFT JOIN users u ON u.id = sn.created_by
            WHERE sn.sheet_id = ?
            ORDER BY sn.created_at ASC
        ");
        $stmt->execute([$sheetId]);
        echo json_encode(['notes' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    public function store(int $sheetId): void {
        $data  = json_decode(file_get_contents('php://input'), true) ?? [];
        $xPct  = isset($data['x_pct'])  ? (float) $data['x_pct']  : null;
        $yPct  = isset($data['y_pct'])  ? (float) $data['y_pct']  : null;
        $note  = trim($data['note']  ?? '');
        $color = trim($data['color'] ?? 'yellow');

        if ($xPct === null || $yPct === null || $note === '') {
            http_response_code(422);
            echo json_encode(['error' => 'x_pct, y_pct, and note are required']);
            return;
        }

        $validColors = ['yellow','red','green','blue','purple'];
        if (!in_array($color, $validColors)) $color = 'yellow';

        $db   = Database::connect();
        $stmt = $db->prepare("
            INSERT INTO sheet_notes (sheet_id, x_pct, y_pct, note, color, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$sheetId, $xPct, $yPct, $note, $color, $_SESSION['user_id'] ?? null]);
        $noteId = (int) $db->lastInsertId();

        $fetch = $db->prepare("
            SELECT sn.id, sn.sheet_id, sn.x_pct, sn.y_pct, sn.note, sn.color,
                   sn.created_at, u.name AS user_name
            FROM sheet_notes sn
            LEFT JOIN users u ON u.id = sn.created_by
            WHERE sn.id = ?
        ");
        $fetch->execute([$noteId]);
        $row = $fetch->fetch(PDO::FETCH_ASSOC);

        http_response_code(201);
        echo json_encode(['note' => $row]);
    }

    public function destroy(int $noteId): void {
        $db   = Database::connect();
        $stmt = $db->prepare("SELECT id FROM sheet_notes WHERE id = ?");
        $stmt->execute([$noteId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            return;
        }

        $db->prepare("DELETE FROM sheet_notes WHERE id = ?")->execute([$noteId]);
        echo json_encode(['success' => true]);
    }
}
