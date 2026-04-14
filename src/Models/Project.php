<?php
class Project {
    public static function all(): array {
        $db = Database::get();
        $stmt = $db->query("
            SELECT p.*,
                COUNT(DISTINCT pf.id) as file_count,
                COUNT(DISTINCT tr.id) as run_count
            FROM projects p
            LEFT JOIN project_files pf ON pf.project_id = p.id
            LEFT JOIN takeoff_runs tr ON tr.project_id = p.id
            GROUP BY p.id
            ORDER BY p.created_at DESC
        ");
        return $stmt->fetchAll();
    }

    public static function find(int $id): ?array {
        $db = Database::get();
        $stmt = $db->prepare("SELECT * FROM projects WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function create(array $data): int {
        $db = Database::get();
        $stmt = $db->prepare("
            INSERT INTO projects (name, address, permit_number, client_name, project_type, notes)
            VALUES (:name, :address, :permit_number, :client_name, :project_type, :notes)
        ");
        $stmt->execute([
            ':name'          => $data['name'],
            ':address'       => $data['address'] ?? null,
            ':permit_number' => $data['permit_number'] ?? null,
            ':client_name'   => $data['client_name'] ?? null,
            ':project_type'  => $data['project_type'] ?? 'residential',
            ':notes'         => $data['notes'] ?? null,
        ]);
        return (int)$db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db = Database::get();
        $stmt = $db->prepare("
            UPDATE projects SET name=:name, address=:address, permit_number=:permit_number,
            client_name=:client_name, project_type=:project_type, notes=:notes
            WHERE id=:id
        ");
        $stmt->execute([
            ':id'            => $id,
            ':name'          => $data['name'],
            ':address'       => $data['address'] ?? null,
            ':permit_number' => $data['permit_number'] ?? null,
            ':client_name'   => $data['client_name'] ?? null,
            ':project_type'  => $data['project_type'] ?? 'residential',
            ':notes'         => $data['notes'] ?? null,
        ]);
    }

    public static function delete(int $id): void {
        $db = Database::get();
        $db->prepare("DELETE FROM projects WHERE id = ?")->execute([$id]);
    }

    public static function withFiles(int $id): ?array {
        $project = self::find($id);
        if (!$project) return null;

        $db = Database::get();
        $stmt = $db->prepare("
            SELECT pf.*, COUNT(ps.id) as sheet_count
            FROM project_files pf
            LEFT JOIN plan_sheets ps ON ps.file_id = pf.id
            WHERE pf.project_id = ?
            GROUP BY pf.id
            ORDER BY pf.uploaded_at DESC
        ");
        $stmt->execute([$id]);
        $project['files'] = $stmt->fetchAll();

        $stmt2 = $db->prepare("
            SELECT tr.*, COUNT(ti.id) as item_count
            FROM takeoff_runs tr
            LEFT JOIN takeoff_items ti ON ti.run_id = tr.id
            WHERE tr.project_id = ?
            GROUP BY tr.id
            ORDER BY tr.created_at DESC
        ");
        $stmt2->execute([$id]);
        $project['runs'] = $stmt2->fetchAll();

        return $project;
    }
}
