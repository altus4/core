-- Migration: Revert users table changes (robust order and checks)
-- 1) Drop indexes first (they may reference columns being dropped)
SET @exists := (SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_email_active');
SET @sql := IF(@exists > 0, 'ALTER TABLE `users` DROP INDEX `idx_email_active`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_last_active');
SET @sql := IF(@exists > 0, 'ALTER TABLE `users` DROP INDEX `idx_last_active`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Drop columns if they exist
SET @exists := (SELECT COUNT(1) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'password_hash');
SET @sql := IF(@exists > 0, 'ALTER TABLE `users` DROP COLUMN `password_hash`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(1) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'is_active');
SET @sql := IF(@exists > 0, 'ALTER TABLE `users` DROP COLUMN `is_active`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(1) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'last_active');
SET @sql := IF(@exists > 0, 'ALTER TABLE `users` DROP COLUMN `last_active`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Restore password to NOT NULL, normalizing nulls if any exist
UPDATE users SET password = '' WHERE password IS NULL;
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NOT NULL;
