CREATE DATABASE IF NOT EXISTS plan_takeoff CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE plan_takeoff;

-- Projects: top-level container for a plan set
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    permit_number VARCHAR(100),
    client_name VARCHAR(255),
    project_type ENUM('residential','multi_family','commercial','mixed_use','other') NOT NULL DEFAULT 'residential',
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- Uploaded PDF plan sets
CREATE TABLE IF NOT EXISTS project_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    page_count INT,
    process_status ENUM('pending','processing','complete','error') NOT NULL DEFAULT 'pending',
    process_error TEXT,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project (project_id)
) ENGINE=InnoDB;

-- Individual sheets detected within a PDF
CREATE TABLE IF NOT EXISTS plan_sheets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_id INT NOT NULL,
    page_number INT NOT NULL,                          -- 0-indexed page in PDF
    sheet_number VARCHAR(50),                          -- e.g. A2.5, E1.0, M2.0
    sheet_title VARCHAR(255),                          -- e.g. "ROOF PLAN", "FIRST FLOOR ELECTRICAL"
    sheet_type ENUM(
        'cover','specs','architectural','structural',
        'civil','mechanical','electrical','plumbing',
        'landscape','accessibility','fire','other'
    ) NOT NULL DEFAULT 'other',
    sheet_subtype VARCHAR(100),                        -- e.g. "floor_plan", "roof_plan", "rcp", "elevation", "detail"
    drawing_scale VARCHAR(50),                         -- e.g. "1/8\" = 1'-0\""
    scale_factor DECIMAL(10,6),                        -- pixels per inch at render DPI, for measurement
    page_image_path VARCHAR(500),                      -- rendered page image path
    thumbnail_path VARCHAR(500),
    ai_raw_response TEXT,                              -- raw Claude title block response
    detected_at DATETIME,
    FOREIGN KEY (file_id) REFERENCES project_files(id) ON DELETE CASCADE,
    INDEX idx_file (file_id),
    INDEX idx_type (sheet_type)
) ENGINE=InnoDB;

-- A takeoff run = one trade analysis on a project
CREATE TABLE IF NOT EXISTS takeoff_runs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    trade ENUM(
        'roofing','framing','drywall','electrical',
        'hvac','plumbing','concrete','site_work','all'
    ) NOT NULL,
    status ENUM('pending','processing','complete','error') NOT NULL DEFAULT 'pending',
    error_message TEXT,
    sheets_analyzed JSON,                              -- array of plan_sheet IDs used
    ai_model VARCHAR(100),
    total_input_tokens INT,
    total_output_tokens INT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_trade (project_id, trade)
) ENGINE=InnoDB;

-- Individual line items from a takeoff run
CREATE TABLE IF NOT EXISTS takeoff_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run_id INT NOT NULL,
    category VARCHAR(150) NOT NULL,                    -- e.g. "Shingles", "Exterior Walls", "Outlets"
    description TEXT NOT NULL,
    quantity DECIMAL(12,3),
    unit VARCHAR(50),                                  -- SF, LF, EA, CY, SQ, etc.
    unit_notes VARCHAR(255),                           -- e.g. "includes 10% waste", "per floor"
    source_sheets JSON,                                -- array of sheet IDs + page numbers
    confidence ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
    calc_notes TEXT,                                   -- how the number was derived
    sort_order INT NOT NULL DEFAULT 0,
    FOREIGN KEY (run_id) REFERENCES takeoff_runs(id) ON DELETE CASCADE,
    INDEX idx_run (run_id),
    INDEX idx_category (category)
) ENGINE=InnoDB;
