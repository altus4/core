-- Migration: Fix API keys key_prefix column length
-- The current VARCHAR(30) is too small for the generated key prefixes
-- Example: 'altus4_sk_live_' (14 chars) + 16 hex chars = 30 chars exactly, but we need some buffer

ALTER TABLE api_keys
MODIFY COLUMN key_prefix VARCHAR(50) NOT NULL COMMENT 'API key prefix for fast lookups - altus4_sk_live_abc123def456';
