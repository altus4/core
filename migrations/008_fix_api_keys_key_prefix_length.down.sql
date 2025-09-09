-- Rollback migration: Revert API keys key_prefix column length back to VARCHAR(30)
-- This should only be used if no data exists that would be truncated

ALTER TABLE api_keys
MODIFY COLUMN key_prefix VARCHAR(30) NOT NULL COMMENT 'API key prefix for fast lookups';
