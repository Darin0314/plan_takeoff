<?php
require_once __DIR__ . '/../fpdf.php';

class TakeoffPDF extends FPDF {
    private string $trade;
    private string $projectName;

    // Brand palette
    const BG_DARK  = [15,  23,  42];   // slate-900
    const BG_MID   = [30,  41,  59];   // slate-800
    const ACCENT   = [59, 130, 246];   // blue-500
    const TEXT_HI  = [255, 255, 255];
    const TEXT_MID = [148, 163, 184];  // slate-400
    const TEXT_LO  = [100, 116, 139];  // slate-500
    const AMBER    = [251, 191,  36];
    const GREEN    = [ 74, 222, 128];
    const YELLOW   = [250, 204,  21];
    const RED      = [248, 113, 113];

    const TRADE_COLORS = [
        'roofing'    => [249, 115,  22],
        'framing'    => [217, 119,   6],
        'drywall'    => [161, 161, 170],
        'electrical' => [234, 179,   8],
        'hvac'       => [ 14, 165, 233],
        'plumbing'   => [ 59, 130, 246],
        'concrete'   => [120, 113, 108],
        'site_work'  => [ 34, 197,  94],
        'all'        => [139,  92, 246],
    ];

    public function __construct(string $trade, string $projectName) {
        parent::__construct('P', 'mm', 'Letter');
        $this->trade       = $trade;
        $this->projectName = $projectName;
        $this->SetMargins(14, 14, 14);
        $this->SetAutoPageBreak(true, 18);
        $this->SetFont('Helvetica', '', 9);
    }

    private function tradeColor(): array {
        return self::TRADE_COLORS[$this->trade] ?? self::ACCENT;
    }

    private function tradeLabel(): string {
        $labels = [
            'roofing'=>'Roofing','framing'=>'Framing','drywall'=>'Drywall',
            'electrical'=>'Electrical','hvac'=>'HVAC','plumbing'=>'Plumbing',
            'concrete'=>'Concrete','site_work'=>'Site Work','all'=>'All Trades',
        ];
        return $labels[$this->trade] ?? ucfirst($this->trade);
    }

    public function Header() {
        $tc = $this->tradeColor();

        // Dark header bar
        $this->SetFillColor(...self::BG_DARK);
        $this->Rect(0, 0, 216, 18, 'F');

        // Accent left stripe
        $this->SetFillColor(...$tc);
        $this->Rect(0, 0, 3, 18, 'F');

        // Project name
        $this->SetFont('Helvetica', 'B', 11);
        $this->SetTextColor(...self::TEXT_HI);
        $this->SetXY(6, 4);
        $this->Cell(130, 6, $this->cleanStr($this->projectName), 0, 0, 'L');

        // Trade badge (right side)
        $this->SetFont('Helvetica', 'B', 9);
        $badgeW = $this->GetStringWidth($this->tradeLabel()) + 8;
        $this->SetFillColor(...$tc);
        $this->SetXY(202 - $badgeW, 5.5);
        $this->SetTextColor(...self::BG_DARK);
        $this->RoundedRect(202 - $badgeW, 5.5, $badgeW, 7, 2, 'F');
        $this->SetXY(202 - $badgeW, 6);
        $this->Cell($badgeW, 6, $this->tradeLabel(), 0, 0, 'C');

        $this->SetY(20);
    }

    public function Footer() {
        $this->SetY(-14);
        $this->SetFillColor(...self::BG_DARK);
        $this->Rect(0, $this->GetY(), 216, 20, 'F');
        $this->SetFont('Helvetica', '', 7.5);
        $this->SetTextColor(...self::TEXT_LO);
        $this->Cell(0, 6, 'Plan Takeoff AI  |  Generated ' . date('F j, Y  g:i A'), 0, 0, 'L');
        $this->SetFont('Helvetica', '', 7.5);
        $this->Cell(0, 6, 'Page ' . $this->PageNo(), 0, 0, 'R');
    }

    // ── Project info block ─────────────────────────────────────────────────
    public function projectBlock(array $project, array $run): void {
        $y = $this->GetY();
        $this->SetFillColor(...self::BG_MID);
        $this->Rect(14, $y, 188, 22, 'F');

        $this->SetFont('Helvetica', '', 8);
        $col1 = 16;
        $col2 = 110;

        // Col 1
        $this->SetXY($col1, $y + 2);
        $this->SetTextColor(...self::TEXT_MID);
        $this->Cell(20, 5, 'Client:', 0);
        $this->SetTextColor(...self::TEXT_HI);
        $this->Cell(70, 5, $this->cleanStr($project['client_name'] ?? '—'), 0, 2);

        $this->SetX($col1);
        $this->SetTextColor(...self::TEXT_MID);
        $this->Cell(20, 5, 'Address:', 0);
        $this->SetTextColor(...self::TEXT_HI);
        $this->Cell(70, 5, $this->cleanStr($project['address'] ?? '—'), 0, 2);

        $this->SetX($col1);
        $this->SetTextColor(...self::TEXT_MID);
        $this->Cell(20, 5, 'Permit:', 0);
        $this->SetTextColor(...self::TEXT_HI);
        $this->Cell(70, 5, $this->cleanStr($project['permit_number'] ?? '—'), 0);

        // Col 2
        $this->SetXY($col2, $y + 2);
        $this->SetTextColor(...self::TEXT_MID);
        $this->Cell(22, 5, 'Trade:', 0);
        $this->SetTextColor(...self::TEXT_HI);
        $this->Cell(70, 5, $this->tradeLabel(), 0, 2);

        $this->SetX($col2);
        $this->SetTextColor(...self::TEXT_MID);
        $this->Cell(22, 5, 'AI Model:', 0);
        $this->SetTextColor(...self::TEXT_HI);
        $this->Cell(70, 5, $this->cleanStr($run['ai_model'] ?? 'Claude Haiku'), 0, 2);

        $this->SetX($col2);
        $this->SetTextColor(...self::TEXT_MID);
        $this->Cell(22, 5, 'Completed:', 0);
        $this->SetTextColor(...self::TEXT_HI);
        $ts = $run['completed_at'] ? date('M j, Y', strtotime($run['completed_at'])) : '—';
        $this->Cell(70, 5, $ts, 0);

        $this->SetY($y + 26);
    }

    // ── Category heading row ───────────────────────────────────────────────
    public function categoryRow(string $category, int $count): void {
        $this->CheckPageBreak(10);
        $tc = $this->tradeColor();
        $y  = $this->GetY();

        $this->SetFillColor(...$tc);
        $this->Rect(14, $y, 3, 7, 'F');

        $this->SetFillColor(22, 33, 54);
        $this->Rect(17, $y, 185, 7, 'F');

        $this->SetFont('Helvetica', 'B', 8.5);
        $this->SetTextColor(...self::TEXT_HI);
        $this->SetXY(19, $y + 1);
        $this->Cell(140, 5, $this->cleanStr($category), 0, 0, 'L');
        $this->SetFont('Helvetica', '', 7.5);
        $this->SetTextColor(...self::TEXT_LO);
        $this->Cell(0, 5, $count . ' item' . ($count !== 1 ? 's' : ''), 0, 0, 'R');
        $this->Ln(8);
    }

    // ── Column header row ──────────────────────────────────────────────────
    public function columnHeaders(): void {
        $this->SetFont('Helvetica', 'B', 7);
        $this->SetTextColor(...self::TEXT_LO);
        $this->SetFillColor(20, 27, 45);
        $this->SetX(14);
        $this->Cell(85, 5, 'DESCRIPTION', 0, 0, 'L', true);
        $this->Cell(22, 5, 'QUANTITY',    0, 0, 'R', true);
        $this->Cell(14, 5, 'UNIT',        0, 0, 'L', true);
        $this->Cell(45, 5, 'NOTES',       0, 0, 'L', true);
        $this->Cell(22, 5, 'CONFIDENCE',  0, 0, 'C', true);
        $this->Ln(5);
    }

    // ── Item row ───────────────────────────────────────────────────────────
    public function itemRow(array $item, bool $shade): void {
        $this->CheckPageBreak(14);

        // Measure description height
        $descLines  = $this->countLines($this->cleanStr($item['description'] ?? ''), 83);
        $notesLines = $this->countLines($this->cleanStr($item['unit_notes'] ?? ''), 43);
        $calcLines  = $item['calc_notes']
            ? $this->countLines('* ' . $this->cleanStr($item['calc_notes']), 83)
            : 0;
        $rowH = max(6, ($descLines + $calcLines) * 4.5, $notesLines * 4.5);

        $y = $this->GetY();
        if ($shade) {
            $this->SetFillColor(22, 33, 54);
            $this->Rect(14, $y, 188, $rowH + 1, 'F');
        }

        $isOverride = !empty($item['is_override']);

        // Description
        $this->SetFont('Helvetica', '', 8);
        $this->SetTextColor(...self::TEXT_HI);
        $this->SetXY(15, $y + 0.5);
        $this->MultiCell(83, 4.5, $this->cleanStr($item['description'] ?? ''), 0, 'L');

        // Calc notes (smaller, below description)
        if ($item['calc_notes']) {
            $this->SetFont('Helvetica', 'I', 6.5);
            $this->SetTextColor(...self::TEXT_LO);
            $this->SetX(15);
            $this->MultiCell(83, 4, '* ' . $this->cleanStr($item['calc_notes']), 0, 'L');
        }

        // Quantity (right-aligned in col)
        $this->SetFont('Helvetica', $isOverride ? 'B' : '', 8.5);
        $this->SetTextColor(...($isOverride ? self::AMBER : self::TEXT_HI));
        $qtyStr = $item['quantity'] !== null ? number_format((float)$item['quantity'], 2, '.', ',') : '—';
        $this->SetXY(98, $y + 0.5);
        $this->Cell(22, $rowH, $qtyStr, 0, 0, 'R');

        // Original AI value (struck-through appearance: print, then draw line)
        if ($isOverride && $item['original_quantity'] !== null) {
            $origStr = number_format((float)$item['original_quantity'], 2, '.', ',');
            $this->SetFont('Helvetica', '', 6.5);
            $this->SetTextColor(...self::TEXT_LO);
            $this->SetXY(98, $y + 5);
            $origW = $this->GetStringWidth($origStr);
            $this->Cell(22, 4, $origStr, 0, 0, 'R');
            // Strike-through line
            $ox = 120 - $origW - 1;
            $oy = $y + 7.2;
            $this->SetDrawColor(...self::TEXT_LO);
            $this->Line($ox, $oy, $ox + $origW, $oy);
        }

        // Unit
        $this->SetFont('Helvetica', '', 8);
        $this->SetTextColor(...self::TEXT_MID);
        $this->SetXY(121, $y + 0.5);
        $this->Cell(13, $rowH, $this->cleanStr($item['unit'] ?? ''), 0, 0, 'L');

        // Notes
        $this->SetFont('Helvetica', '', 7.5);
        $this->SetTextColor(...self::TEXT_MID);
        $this->SetXY(134, $y + 0.5);
        $this->MultiCell(43, 4.5, $this->cleanStr($item['unit_notes'] ?? ''), 0, 'L');

        // Confidence badge
        [$confColor, $confLabel] = match($item['confidence'] ?? 'medium') {
            'high'  => [self::GREEN,  'HIGH'],
            'low'   => [self::RED,    'LOW'],
            default => [self::YELLOW, 'MED'],
        };
        $this->SetFont('Helvetica', 'B', 6.5);
        $this->SetTextColor(...self::BG_DARK);
        $this->SetFillColor(...$confColor);
        $bx = 179; $bw = 20; $bh = 5;
        $by = $y + ($rowH / 2) - ($bh / 2);
        $this->RoundedRect($bx, $by, $bw, $bh, 1.5, 'F');
        $this->SetXY($bx, $by);
        $this->Cell($bw, $bh, $confLabel, 0, 0, 'C');

        $this->SetY($y + $rowH + 1.5);
    }

    // ── Summary totals block ───────────────────────────────────────────────
    public function summaryBlock(array $items): void {
        $this->Ln(4);
        $this->CheckPageBreak(30);
        $y = $this->GetY();

        $this->SetFillColor(...self::BG_MID);
        $this->Rect(14, $y, 188, 22, 'F');

        $total    = count($items);
        $overridden = count(array_filter($items, fn($i) => !empty($i['is_override'])));
        $hi     = count(array_filter($items, fn($i) => ($i['confidence'] ?? '') === 'high'));
        $med    = count(array_filter($items, fn($i) => ($i['confidence'] ?? '') === 'medium'));
        $lo     = count(array_filter($items, fn($i) => ($i['confidence'] ?? '') === 'low'));

        $stats = [
            ['Total Items',   $total,      self::TEXT_HI],
            ['High Conf.',    $hi,         self::GREEN],
            ['Med Conf.',     $med,        self::YELLOW],
            ['Low Conf.',     $lo,         self::RED],
            ['Overridden',    $overridden, self::AMBER],
        ];

        $colW = 188 / count($stats);
        foreach ($stats as $i => [$label, $val, $color]) {
            $cx = 14 + $i * $colW;
            $this->SetFont('Helvetica', 'B', 12);
            $this->SetTextColor(...$color);
            $this->SetXY($cx, $y + 3);
            $this->Cell($colW, 8, (string)$val, 0, 0, 'C');

            $this->SetFont('Helvetica', '', 7);
            $this->SetTextColor(...self::TEXT_LO);
            $this->SetXY($cx, $y + 12);
            $this->Cell($colW, 5, strtoupper($label), 0, 0, 'C');
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    private function CheckPageBreak(float $h): void {
        if ($this->GetY() + $h > $this->PageBreakTrigger) {
            $this->AddPage();
        }
    }

    private function countLines(string $text, float $w): int {
        if (!$text) return 0;
        $this->SetFont('Helvetica', '', 8);
        return count(explode("\n", wordwrap($text, (int)($w / 1.8), "\n", true)));
    }

    private function cleanStr(string $s): string {
        // FPDF requires ISO-8859-1; strip non-latin chars
        return iconv('UTF-8', 'ISO-8859-1//TRANSLIT//IGNORE', $s) ?: $s;
    }

    // Rounded rectangle (FPDF doesn't include one natively)
    private function RoundedRect(float $x, float $y, float $w, float $h, float $r, string $style = ''): void {
        $k  = $this->k;
        $hp = $this->h;
        if ($style === 'F') {
            $op = 'f';
        } elseif ($style === 'FD' || $style === 'DF') {
            $op = 'B';
        } else {
            $op = 'S';
        }
        $MyArc = 4 / 3 * (sqrt(2) - 1);
        $this->_out(sprintf('%.2F %.2F m', ($x + $r) * $k, ($hp - $y) * $k));
        $xc = $x + $w - $r; $yc = $y + $r;
        $this->_out(sprintf('%.2F %.2F l', $xc * $k, ($hp - $y) * $k));
        $this->_Arc($xc + $r * $MyArc, $yc - $r, $xc + $r, $yc - $r * $MyArc, $xc + $r, $yc);
        $xc = $x + $w - $r; $yc = $y + $h - $r;
        $this->_out(sprintf('%.2F %.2F l', ($x + $w) * $k, ($hp - $yc) * $k));
        $this->_Arc($xc + $r, $yc + $r * $MyArc, $xc + $r * $MyArc, $yc + $r, $xc, $yc + $r);
        $xc = $x + $r; $yc = $y + $h - $r;
        $this->_out(sprintf('%.2F %.2F l', $xc * $k, ($hp - ($y + $h)) * $k));
        $this->_Arc($xc - $r * $MyArc, $yc + $r, $xc - $r, $yc + $r * $MyArc, $xc - $r, $yc);
        $xc = $x + $r; $yc = $y + $r;
        $this->_out(sprintf('%.2F %.2F l', $x * $k, ($hp - $yc) * $k));
        $this->_Arc($xc - $r, $yc - $r * $MyArc, $xc - $r * $MyArc, $yc - $r, $xc, $yc - $r);
        $this->_out($op);
    }

    private function _Arc(float $x1, float $y1, float $x2, float $y2, float $x3, float $y3): void {
        $h = $this->h;
        $this->_out(sprintf(
            '%.2F %.2F %.2F %.2F %.2F %.2F c',
            $x1 * $this->k, ($h - $y1) * $this->k,
            $x2 * $this->k, ($h - $y2) * $this->k,
            $x3 * $this->k, ($h - $y3) * $this->k
        ));
    }
}
