<?php
require_once __DIR__ . '/../Services/TakeoffPDF.php';

class ReportController {
    public function pdf(int $runId): void {
        $run = TakeoffRun::find($runId);
        if (!$run) { http_response_code(404); echo json_encode(['error' => 'Not found']); return; }

        $project = Project::find($run['project_id']);
        if (!$project) { http_response_code(404); echo json_encode(['error' => 'Project not found']); return; }

        $items = TakeoffRun::items($runId);

        $pdf = new TakeoffPDF($run['trade'], $project['name']);
        $pdf->AddPage();

        // Project info block
        $pdf->projectBlock($project, $run);
        $pdf->Ln(4);

        if (empty($items)) {
            $pdf->SetFont('Helvetica', 'I', 9);
            $pdf->SetTextColor(148, 163, 184);
            $pdf->Cell(0, 8, 'No items extracted for this takeoff run.', 0, 1, 'C');
        } else {
            // Group by category
            $grouped = [];
            foreach ($items as $item) {
                $cat = $item['category'] ?? 'General';
                $grouped[$cat][] = $item;
            }

            foreach ($grouped as $category => $catItems) {
                $pdf->categoryRow($category, count($catItems));
                $pdf->columnHeaders();
                foreach ($catItems as $i => $item) {
                    $pdf->itemRow($item, $i % 2 === 1);
                }
                $pdf->Ln(3);
            }

            // Summary totals
            $pdf->summaryBlock($items);
        }

        $filename = 'takeoff-' . ($run['trade'] ?? 'all') . '-' . date('Ymd', strtotime($run['completed_at'] ?? 'now')) . '.pdf';
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: no-cache, no-store');
        $pdf->Output('D', $filename);
    }
}
