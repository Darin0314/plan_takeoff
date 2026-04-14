<?php
class ProjectFile {
    public static function find(int $id): ?array {
        $db = Database::get();
        $stmt = $db->prepare("SELECT * FROM project_files WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function create(array $data): int {
        $db = Database::get();
        $stmt = $db->prepare("
            INSERT INTO project_files (project_id, original_filename, stored_filename, file_path, file_size)
            VALUES (:project_id, :original_filename, :stored_filename, :file_path, :file_size)
        ");
        $stmt->execute([
            ':project_id'       => $data['project_id'],
            ':original_filename'=> $data['original_filename'],
            ':stored_filename'  => $data['stored_filename'],
            ':file_path'        => $data['file_path'],
            ':file_size'        => $data['file_size'] ?? null,
        ]);
        return (int)Database::get()->lastInsertId();
    }

    public static function updateStatus(int $id, string $status, ?int $pageCount = null, ?string $error = null): void {
        $db = Database::get();
        $stmt = $db->prepare("
            UPDATE project_files SET process_status=:status, page_count=:page_count, process_error=:error
            WHERE id=:id
        ");
        $stmt->execute([':status' => $status, ':page_count' => $pageCount, ':error' => $error, ':id' => $id]);
    }

    public static function sheets(int $fileId): array {
        $db = Database::get();
        $stmt = $db->prepare("SELECT * FROM plan_sheets WHERE file_id = ? ORDER BY page_number ASC");
        $stmt->execute([$fileId]);
        return $stmt->fetchAll();
    }
}
