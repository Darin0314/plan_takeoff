<?php

class SupplierController {

    /**
     * POST /supplier-price-lists
     * Multipart form upload: file (CSV), name, description (optional)
     * Auto-parses header row. Expected columns (case-insensitive, flexible):
     *   trade, category, description, unit, unit_price
     */
    public function store(): void {
        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'CSV file required']);
            return;
        }

        $name = trim($_POST['name'] ?? '');
        if (!$name) {
            http_response_code(400);
            echo json_encode(['error' => 'name is required']);
            return;
        }

        $desc = trim($_POST['description'] ?? '') ?: null;

        $path = $_FILES['file']['tmp_name'];
        $handle = fopen($path, 'r');
        if (!$handle) {
            http_response_code(500);
            echo json_encode(['error' => 'Could not open uploaded file']);
            return;
        }

        // Read header row, normalize keys
        $rawHeaders = fgetcsv($handle);
        if (!$rawHeaders) {
            fclose($handle);
            http_response_code(400);
            echo json_encode(['error' => 'CSV appears empty']);
            return;
        }

        $headers = array_map(fn($h) => strtolower(trim(preg_replace('/[^a-z0-9_]/i', '_', $h))), $rawHeaders);

        // Map expected column names to index positions — flexible matching
        $colMap = [];
        $aliases = [
            'trade'       => ['trade', 'trade_name', 'trade_type'],
            'category'    => ['category', 'cat', 'subcategory', 'sub_category'],
            'description' => ['description', 'desc', 'item', 'item_description', 'name'],
            'unit'        => ['unit', 'uom', 'unit_of_measure', 'unit_type'],
            'unit_price'  => ['unit_price', 'price', 'cost', 'unit_cost', 'rate', 'mat_price', 'material_price'],
        ];

        foreach ($aliases as $field => $candidates) {
            foreach ($candidates as $candidate) {
                $idx = array_search($candidate, $headers, true);
                if ($idx !== false) {
                    $colMap[$field] = $idx;
                    break;
                }
            }
        }

        $required = ['trade', 'category', 'description', 'unit_price'];
        foreach ($required as $r) {
            if (!isset($colMap[$r])) {
                fclose($handle);
                http_response_code(400);
                echo json_encode([
                    'error'   => "Missing required column: $r",
                    'headers' => $rawHeaders,
                    'hint'    => "Expected columns: trade, category, description, unit_price (unit is optional)"
                ]);
                return;
            }
        }

        $db = Database::get();

        // Insert price list record
        $stmt = $db->prepare("
            INSERT INTO supplier_price_lists (name, description, created_by)
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$name, $desc, $_SESSION['user_id'] ?? null]);
        $listId = (int)$db->lastInsertId();

        // Bulk-insert rows
        $insertStmt = $db->prepare("
            INSERT INTO supplier_prices (list_id, trade, category, description, unit, unit_price)
            VALUES (?, ?, ?, ?, ?, ?)
        ");

        $count = 0;
        while (($row = fgetcsv($handle)) !== false) {
            $tradeVal    = trim($row[$colMap['trade']]       ?? '');
            $catVal      = trim($row[$colMap['category']]    ?? '');
            $descVal     = trim($row[$colMap['description']] ?? '');
            $unitPriceRaw = trim($row[$colMap['unit_price']] ?? '');
            $unitVal     = isset($colMap['unit']) ? trim($row[$colMap['unit']] ?? '') : '';

            // Skip blank rows
            if ($tradeVal === '' && $descVal === '') continue;

            // Strip currency symbols, commas
            $unitPrice = (float)preg_replace('/[^0-9.\-]/', '', $unitPriceRaw);

            $insertStmt->execute([$listId, $tradeVal, $catVal, $descVal, $unitVal ?: null, $unitPrice]);
            $count++;
        }
        fclose($handle);

        // Update row count
        $db->prepare("UPDATE supplier_price_lists SET row_count = ? WHERE id = ?")
           ->execute([$count, $listId]);

        echo json_encode([
            'list' => [
                'id'          => $listId,
                'name'        => $name,
                'description' => $desc,
                'imported_at' => date('Y-m-d H:i:s'),
                'row_count'   => $count,
            ]
        ]);
    }

    /**
     * GET /supplier-price-lists
     * Returns all lists (no items — just metadata).
     */
    public function index(): void {
        $db   = Database::get();
        $stmt = $db->query("
            SELECT id, name, description, imported_at, row_count
            FROM supplier_price_lists
            ORDER BY imported_at DESC
        ");
        echo json_encode(['lists' => $stmt->fetchAll()]);
    }

    /**
     * DELETE /supplier-price-lists/{id}
     * Removes a price list and all its prices (CASCADE).
     */
    public function destroy(int $id): void {
        $db = Database::get();
        $db->prepare("DELETE FROM supplier_price_lists WHERE id = ?")
           ->execute([$id]);
        echo json_encode(['success' => true]);
    }

    /**
     * GET /takeoffs/{runId}/supplier-match?list={listId}
     *
     * Matches each takeoff item to supplier prices by normalized
     * category + description. For each item returns:
     *   - best_match supplier price row (null if none)
     *   - extended_cost = qty × supplier unit_price
     *   - unit_cost_default = mat+lab from unit_costs defaults
     *   - savings / premium delta vs default
     *
     * Normalization: lowercase, strip punctuation, collapse spaces.
     * Matching strategy:
     *   1. Exact category+description match
     *   2. Description contains match (supplier desc inside item desc or vice versa)
     *   3. Word-intersection score ≥ 0.5 (Jaccard)
     */
    public function supplierMatch(int $runId): void {
        $listId = isset($_GET['list']) ? (int)$_GET['list'] : 0;
        if (!$listId) {
            http_response_code(400);
            echo json_encode(['error' => 'list parameter required']);
            return;
        }

        $db = Database::get();

        // Verify run exists
        $run = $db->prepare("SELECT id, trade FROM takeoff_runs WHERE id = ?");
        $run->execute([$runId]);
        $runRow = $run->fetch();
        if (!$runRow) {
            http_response_code(404);
            echo json_encode(['error' => 'Run not found']);
            return;
        }

        // Verify list exists
        $listStmt = $db->prepare("SELECT id, name FROM supplier_price_lists WHERE id = ?");
        $listStmt->execute([$listId]);
        $list = $listStmt->fetch();
        if (!$list) {
            http_response_code(404);
            echo json_encode(['error' => 'Supplier price list not found']);
            return;
        }

        // Load all items for this run
        $itemStmt = $db->prepare("
            SELECT id, category, description, quantity, unit, unit_notes,
                   confidence, unit_cost_material, unit_cost_labor
            FROM takeoff_items
            WHERE run_id = ?
            ORDER BY sort_order, category, id
        ");
        $itemStmt->execute([$runId]);
        $items = $itemStmt->fetchAll();

        // Load all supplier prices for this list
        $spStmt = $db->prepare("
            SELECT id, trade, category, description, unit, unit_price
            FROM supplier_prices
            WHERE list_id = ?
        ");
        $spStmt->execute([$listId]);
        $supplierPrices = $spStmt->fetchAll();

        // Load unit_cost defaults for default cost comparison
        $ucStmt = $db->prepare("
            SELECT trade, category, description, unit_cost_material, unit_cost_labor
            FROM unit_costs
            WHERE trade = ? OR trade = 'all'
        ");
        $ucStmt->execute([$runRow['trade']]);
        $unitCostDefaults = [];
        foreach ($ucStmt->fetchAll() as $uc) {
            $key = $this->normalize($uc['category'] . ' ' . $uc['description']);
            $unitCostDefaults[$key] = $uc;
        }

        // Build normalized supplier price index
        $spNorm = [];
        foreach ($supplierPrices as $sp) {
            $catNorm  = $this->normalize($sp['category']);
            $descNorm = $this->normalize($sp['description']);
            $spNorm[] = [
                'row'      => $sp,
                'cat_norm' => $catNorm,
                'desc_norm'=> $descNorm,
                'full_norm'=> $catNorm . ' ' . $descNorm,
                'words'    => $this->words($descNorm),
            ];
        }

        $results  = [];
        $matched  = 0;
        $unmatched = 0;
        $totalSupplierCost = 0.0;
        $totalDefaultCost  = 0.0;

        foreach ($items as $item) {
            $catNorm  = $this->normalize($item['category']);
            $descNorm = $this->normalize($item['description']);
            $fullNorm = $catNorm . ' ' . $descNorm;
            $itemWords = $this->words($descNorm);

            $bestMatch  = null;
            $bestScore  = 0.0;
            $matchType  = null;

            foreach ($spNorm as $sp) {
                // 1. Exact category + description
                if ($sp['cat_norm'] === $catNorm && $sp['desc_norm'] === $descNorm) {
                    $bestMatch = $sp['row'];
                    $bestScore = 1.0;
                    $matchType = 'exact';
                    break;
                }

                // 2. Contains match (description substring)
                if (strlen($sp['desc_norm']) >= 4 && strlen($descNorm) >= 4) {
                    if (str_contains($descNorm, $sp['desc_norm']) || str_contains($sp['desc_norm'], $descNorm)) {
                        if (0.9 > $bestScore) {
                            $bestMatch = $sp['row'];
                            $bestScore = 0.9;
                            $matchType = 'contains';
                        }
                        continue;
                    }
                }

                // 3. Jaccard word overlap
                if (!empty($itemWords) && !empty($sp['words'])) {
                    $intersection = count(array_intersect($itemWords, $sp['words']));
                    $union        = count(array_unique(array_merge($itemWords, $sp['words'])));
                    $jaccard      = $union > 0 ? $intersection / $union : 0;
                    if ($jaccard >= 0.5 && $jaccard > $bestScore) {
                        $bestMatch = $sp['row'];
                        $bestScore = $jaccard;
                        $matchType = 'fuzzy';
                    }
                }
            }

            $qty          = (float)($item['quantity'] ?? 0);
            $supplierPrice = $bestMatch ? (float)$bestMatch['unit_price'] : null;
            $extendedCost  = ($supplierPrice !== null) ? round($qty * $supplierPrice, 2) : null;

            // Default cost from item columns or unit_costs table
            $ucKey = $this->normalize($item['category'] . ' ' . $item['description']);
            $matDef = $item['unit_cost_material'] !== null
                ? (float)$item['unit_cost_material']
                : ($unitCostDefaults[$ucKey]['unit_cost_material'] ?? null);
            $labDef = $item['unit_cost_labor'] !== null
                ? (float)$item['unit_cost_labor']
                : ($unitCostDefaults[$ucKey]['unit_cost_labor'] ?? null);
            $defaultUnitCost = ($matDef !== null || $labDef !== null)
                ? round(($matDef ?? 0) + ($labDef ?? 0), 4)
                : null;
            $defaultExtended = $defaultUnitCost !== null ? round($qty * $defaultUnitCost, 2) : null;

            // Delta: supplier vs default (positive = savings, negative = premium)
            $delta = ($extendedCost !== null && $defaultExtended !== null)
                ? round($defaultExtended - $extendedCost, 2)
                : null;

            if ($bestMatch) {
                $matched++;
                $totalSupplierCost += $extendedCost ?? 0;
            } else {
                $unmatched++;
            }
            if ($defaultExtended !== null) {
                $totalDefaultCost += $defaultExtended;
            }

            $results[] = [
                'item_id'            => (int)$item['id'],
                'category'           => $item['category'],
                'description'        => $item['description'],
                'quantity'           => $qty,
                'unit'               => $item['unit'],
                'confidence'         => $item['confidence'],
                // Supplier match
                'matched'            => $bestMatch !== null,
                'match_type'         => $matchType,
                'match_score'        => $bestScore > 0 ? round($bestScore, 3) : null,
                'supplier_price_id'  => $bestMatch ? (int)$bestMatch['id'] : null,
                'supplier_desc'      => $bestMatch ? $bestMatch['description'] : null,
                'supplier_unit'      => $bestMatch ? $bestMatch['unit'] : null,
                'supplier_unit_price'=> $supplierPrice,
                'extended_cost'      => $extendedCost,
                // Default comparison
                'default_unit_cost'  => $defaultUnitCost,
                'default_extended'   => $defaultExtended,
                'delta'              => $delta,
            ];
        }

        $totalSavings = round($totalDefaultCost - $totalSupplierCost, 2);

        echo json_encode([
            'run_id'               => $runId,
            'list_id'              => $listId,
            'list_name'            => $list['name'],
            'matched'              => $matched,
            'unmatched'            => $unmatched,
            'total_items'          => count($items),
            'total_supplier_cost'  => round($totalSupplierCost, 2),
            'total_default_cost'   => round($totalDefaultCost, 2),
            'total_savings'        => $totalSavings,
            'items'                => $results,
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function normalize(string $s): string {
        $s = strtolower($s);
        $s = preg_replace('/[^a-z0-9\s]/', ' ', $s);
        return trim(preg_replace('/\s+/', ' ', $s));
    }

    private function words(string $normalized): array {
        // Filter out short stop words for better Jaccard quality
        $stop = ['a','an','the','of','in','on','at','and','or','for','to','with','per','sf','lf','ea','lb','cy'];
        return array_values(array_filter(
            explode(' ', $normalized),
            fn($w) => strlen($w) >= 3 && !in_array($w, $stop, true)
        ));
    }
}
