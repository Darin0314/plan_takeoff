<?php
class AnnotationController {

    /**
     * POST /sheets/{id}/annotate?trade={trade}
     * Calls FastAPI to generate the annotated image, then returns the result.
     */
    public function generate(int $sheetId): void {
        $trade = $_GET['trade'] ?? '';
        $validTrades = ['roofing','framing','drywall','electrical','hvac','plumbing','concrete','site_work'];
        if (!in_array($trade, $validTrades)) {
            http_response_code(422);
            echo json_encode(['error' => 'Invalid trade']);
            return;
        }

        $url = AI_API_URL . '/sheets/' . $sheetId . '/annotate?trade=' . urlencode($trade);
        $ch  = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => '',
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 60, // annotation can take a moment
        ]);
        $body   = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status !== 200) {
            http_response_code(502);
            echo json_encode(['error' => 'Annotation service error', 'detail' => $body]);
            return;
        }

        http_response_code(200);
        echo $body;
    }

    /**
     * GET /sheets/{id}/annotate?trade={trade}
     * Returns existing annotation record from DB (no AI call).
     */
    public function show(int $sheetId): void {
        $trade = $_GET['trade'] ?? '';
        if (!$trade) {
            http_response_code(422);
            echo json_encode(['error' => 'trade parameter required']);
            return;
        }

        $db   = Database::connect();
        $stmt = $db->prepare("
            SELECT id, trade, annotated_image_path, region_count, created_at
            FROM sheet_annotations
            WHERE sheet_id = ? AND trade = ?
        ");
        $stmt->execute([$sheetId, $trade]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            echo json_encode(['exists' => false]);
            return;
        }

        echo json_encode(array_merge(['exists' => true], $row));
    }

    /**
     * GET /takeoffs/{runId}/annotations
     * Returns all annotation records for all source sheets in a run.
     */
    public function forRun(int $runId): void {
        $trade = $_GET['trade'] ?? '';
        $db    = Database::connect();

        $sql = "
            SELECT sa.id, sa.sheet_id, sa.trade, sa.annotated_image_path,
                   sa.region_count, sa.created_at,
                   ps.sheet_number, ps.sheet_title, ps.page_number
            FROM sheet_annotations sa
            JOIN plan_sheets ps ON ps.id = sa.sheet_id
            JOIN (
                SELECT DISTINCT ps2.id AS sid
                FROM takeoff_items ti
                JOIN plan_sheets ps2 ON FIND_IN_SET(ps2.sheet_number, ti.source_sheets) > 0
                WHERE ti.run_id = :runId
            ) src ON src.sid = sa.sheet_id
            WHERE 1=1
        ";
        $params = ['runId' => $runId];
        if ($trade) {
            $sql .= ' AND sa.trade = :trade';
            $params['trade'] = $trade;
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        echo json_encode(['annotations' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }
}
