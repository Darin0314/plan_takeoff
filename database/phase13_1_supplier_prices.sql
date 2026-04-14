CREATE TABLE IF NOT EXISTS supplier_price_lists (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(200)  NOT NULL,
    description TEXT,
    imported_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by  INT UNSIGNED,
    row_count   INT UNSIGNED  NOT NULL DEFAULT 0,
    INDEX idx_imported (imported_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS supplier_prices (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    list_id     INT UNSIGNED  NOT NULL,
    trade       VARCHAR(50)   NOT NULL,
    category    VARCHAR(100)  NOT NULL,
    description VARCHAR(255)  NOT NULL,
    unit        VARCHAR(50),
    unit_price  DECIMAL(12,4) NOT NULL DEFAULT 0,
    INDEX idx_list   (list_id),
    INDEX idx_trade  (list_id, trade),
    FOREIGN KEY (list_id) REFERENCES supplier_price_lists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
