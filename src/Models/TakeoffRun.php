<?php
class TakeoffRun {
    public static function find(int $id): ?array {
        $db = Database::get();
        $stmt = $db->prepare("SELECT * FROM takeoff_runs WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function create(int $projectId, string $trade): int {
        $db = Database::get();
        $stmt = $db->prepare("
            INSERT INTO takeoff_runs (project_id, trade, status)
            VALUES (:project_id, :trade, 'pending')
        ");
        $stmt->execute([':project_id' => $projectId, ':trade' => $trade]);
        return (int)$db->lastInsertId();
    }

    public static function updateStatus(int $id, string $status, array $extra = []): void {
        $db = Database::get();
        $sets = ['status=:status'];
        $params = [':status' => $status, ':id' => $id];

        if ($status === 'processing') {
            $sets[] = 'started_at=NOW()';
        }
        if ($status === 'complete' || $status === 'error') {
            $sets[] = 'completed_at=NOW()';
        }
        foreach (['error_message','sheets_analyzed','ai_model','total_input_tokens','total_output_tokens'] as $field) {
            if (isset($extra[$field])) {
                $sets[] = "{$field}=:{$field}";
                $params[":{$field}"] = $extra[$field];
            }
        }

        $sql = "UPDATE takeoff_runs SET " . implode(', ', $sets) . " WHERE id=:id";
        $db->prepare($sql)->execute($params);
    }

    public static function items(int $runId): array {
        $db = Database::get();
        $stmt = $db->prepare("SELECT * FROM takeoff_items WHERE run_id = ? ORDER BY sort_order, category, id");
        $stmt->execute([$runId]);
        return $stmt->fetchAll();
    }

    public static function insertItem(int $runId, array $item, int $order = 0): void {
        $db = Database::get();
        $stmt = $db->prepare("
            INSERT INTO takeoff_items (run_id, category, description, quantity, unit, unit_notes, source_sheets, confidence, calc_notes, sort_order)
            VALUES (:run_id, :category, :description, :quantity, :unit, :unit_notes, :source_sheets, :confidence, :calc_notes, :sort_order)
        ");
        $stmt->execute([
            ':run_id'       => $runId,
            ':category'     => $item['category'],
            ':description'  => $item['description'],
            ':quantity'     => $item['quantity'] ?? null,
            ':unit'         => $item['unit'] ?? null,
            ':unit_notes'   => $item['unit_notes'] ?? null,
            ':source_sheets'=> isset($item['source_sheets']) ? json_encode($item['source_sheets']) : null,
            ':confidence'   => $item['confidence'] ?? 'medium',
            ':calc_notes'   => $item['calc_notes'] ?? null,
            ':sort_order'   => $order,
        ]);
    }

    public static function findItem(int $itemId): ?array {
        $db = Database::get();
        $stmt = $db->prepare("SELECT * FROM takeoff_items WHERE id = ?");
        $stmt->execute([$itemId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function updateItem(int $itemId, float $quantity, string $unit): void {
        $db   = Database::get();
        $item = self::findItem($itemId);
        if (!$item) return;

        // Capture original AI quantity on first override
        $origQty   = $item['is_override'] ? $item['original_quantity'] : $item['quantity'];
        $isOverride = ($quantity != $origQty || $unit !== ($item['unit'] ?? '')) ? 1 : 0;

        $stmt = $db->prepare("
            UPDATE takeoff_items
               SET quantity = :qty, unit = :unit,
                   is_override = :override, original_quantity = :orig
             WHERE id = :id
        ");
        $stmt->execute([
            ':qty'      => $quantity,
            ':unit'     => $unit,
            ':override' => $isOverride,
            ':orig'     => $origQty,
            ':id'       => $itemId,
        ]);
    }

    public static function resetItem(int $itemId): void {
        $db = Database::get();
        $stmt = $db->prepare("
            UPDATE takeoff_items
               SET quantity = original_quantity, is_override = 0, original_quantity = NULL
             WHERE id = :id AND is_override = 1
        ");
        $stmt->execute([':id' => $itemId]);
    }

    public static function forProject(int $projectId): array {
        $db = Database::get();
        $stmt = $db->prepare("
            SELECT tr.*, COUNT(ti.id) as item_count
            FROM takeoff_runs tr
            LEFT JOIN takeoff_items ti ON ti.run_id = tr.id
            WHERE tr.project_id = ?
            GROUP BY tr.id
            ORDER BY tr.created_at DESC
        ");
        $stmt->execute([$projectId]);
        return $stmt->fetchAll();
    }
}
