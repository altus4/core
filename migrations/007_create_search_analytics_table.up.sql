-- Migration: Create search_analytics table for detailed search tracking
CREATE TABLE IF NOT EXISTS search_analytics (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  query_text TEXT NOT NULL,
  search_mode VARCHAR(50) DEFAULT 'standard',
  database_id VARCHAR(255) NULL,
  result_count INT DEFAULT 0,
  execution_time_ms INT DEFAULT 0,
  clicked_results JSON NULL,
  satisfaction_rating TINYINT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for performance
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_query_text (query_text(255)),
  INDEX idx_search_mode (search_mode),
  INDEX idx_database_id (database_id),

  -- Foreign key constraint
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
