<?php
class TakeoffController {
    public function run(int $projectId): void {
        $project = Project::find($projectId);
        if (!$project) { http_response_code(404); echo json_encode(['error' => 'Not found']); return; }

        $data  = json_decode(file_get_contents('php://input'), true) ?? [];
        $trade = $data['trade'] ?? 'all';

        $validTrades = ['roofing','framing','drywall','electrical','hvac','plumbing','concrete','site_work','all'];
        if (!in_array($trade, $validTrades)) {
            http_response_code(422);
            echo json_encode(['error' => 'Invalid trade']);
            return;
        }

        $runId = TakeoffRun::create($projectId, $trade);

        // Trigger async takeoff via FastAPI
        $payload = json_encode(['run_id' => $runId, 'project_id' => $projectId, 'trade' => $trade]);
        $ch = curl_init(AI_API_URL . '/run-takeoff');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
        ]);
        curl_exec($ch);
        curl_close($ch);

        http_response_code(201);
        echo json_encode(['run_id' => $runId, 'status' => 'processing']);
    }

    public function show(int $runId): void {
        $run = TakeoffRun::find($runId);
        if (!$run) { http_response_code(404); echo json_encode(['error' => 'Not found']); return; }
        $items = TakeoffRun::items($runId);
        echo json_encode(['run' => $run, 'items' => $items]);
    }

    public function forProject(int $projectId): void {
        $runs = TakeoffRun::forProject($projectId);
        echo json_encode(['runs' => $runs]);
    }

    public function updateItem(int $itemId): void {
        $item = TakeoffRun::findItem($itemId);
        if (!$item) { http_response_code(404); echo json_encode(['error' => 'Not found']); return; }

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $qty  = isset($data['quantity']) ? (float)$data['quantity'] : null;
        $unit = trim($data['unit'] ?? $item['unit'] ?? '');

        if ($qty === null || $qty < 0) {
            http_response_code(422);
            echo json_encode(['error' => 'quantity must be a non-negative number']);
            return;
        }

        TakeoffRun::updateItem($itemId, $qty, $unit);
        echo json_encode(['item' => TakeoffRun::findItem($itemId)]);
    }

    public function resetItem(int $itemId): void {
        $item = TakeoffRun::findItem($itemId);
        if (!$item) { http_response_code(404); echo json_encode(['error' => 'Not found']); return; }
        TakeoffRun::resetItem($itemId);
        echo json_encode(['item' => TakeoffRun::findItem($itemId)]);
    }
}
