<?php
class UploadController {
    public function store(int $projectId): void {
        if (!Project::find($projectId)) {
            http_response_code(404);
            echo json_encode(['error' => 'Project not found']);
            return;
        }

        if (empty($_FILES['file'])) {
            http_response_code(422);
            echo json_encode(['error' => 'No file uploaded']);
            return;
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            http_response_code(422);
            echo json_encode(['error' => 'Upload error: ' . $file['error']]);
            return;
        }

        $mime = mime_content_type($file['tmp_name']);
        if ($mime !== 'application/pdf') {
            http_response_code(422);
            echo json_encode(['error' => 'Only PDF files are accepted']);
            return;
        }

        $stored = uniqid('plans_', true) . '.pdf';
        $dest   = UPLOADS_PATH . '/' . $stored;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to store file']);
            return;
        }

        $fileId = ProjectFile::create([
            'project_id'        => $projectId,
            'original_filename' => $file['name'],
            'stored_filename'   => $stored,
            'file_path'         => $dest,
            'file_size'         => $file['size'],
        ]);

        // Kick off async processing via FastAPI
        $this->triggerProcessing($fileId, $dest);

        http_response_code(201);
        echo json_encode(['file_id' => $fileId, 'status' => 'processing']);
    }

    private function triggerProcessing(int $fileId, string $filePath): void {
        $payload = json_encode(['file_id' => $fileId, 'file_path' => $filePath]);
        $ch = curl_init(AI_API_URL . '/process-pdf');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5, // fire-and-forget, don't wait for completion
        ]);
        curl_exec($ch);
        curl_close($ch);
    }

    public function sheets(int $fileId): void {
        $file = ProjectFile::find($fileId);
        if (!$file) { http_response_code(404); echo json_encode(['error' => 'Not found']); return; }
        $sheets = ProjectFile::sheets($fileId);
        echo json_encode(['file' => $file, 'sheets' => $sheets]);
    }
}
