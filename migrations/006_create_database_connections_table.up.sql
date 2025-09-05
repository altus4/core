-- Migration: Create database_connections table for user database management
CREATE TABLE IF NOT EXISTS database_connections (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INT NOT NULL DEFAULT 3306,
  database_name VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  password TEXT NOT NULL, -- Encrypted password
  ssl_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  connection_status ENUM('connected', 'disconnected', 'error') DEFAULT 'disconnected',
  last_tested TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes for performance
  INDEX idx_user_id (user_id),
  INDEX idx_active_connections (is_active),
  INDEX idx_connection_status (connection_status),

  -- Foreign key constraint
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
