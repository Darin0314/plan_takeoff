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
}
