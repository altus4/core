---
title: Database Design & Architecture
description: Comprehensive database architecture documentation for Altus 4 including schema design, migrations, and optimization strategies.
---

# Database Design & Architecture

Comprehensive Database Architecture Documentation

Altus 4 uses a sophisticated database architecture that supports both metadata storage and multi-tenant user database connections. This document covers the complete database design, schema architecture, migration system, and optimization strategies.

## Database Architecture Overview

### Dual Database Architecture

Altus 4 operates with a dual database architecture:

```mermaid
graph TB
    subgraph "Altus 4 Core System"
        API[API Layer]
        Services[Service Layer]
    end

    subgraph "Metadata Storage"
        MetaDB[(Primary Database<br/>altus4_metadata)]
        MetaDB --> Users[users table]
        MetaDB --> ApiKeys[api_keys table]
        MetaDB --> Searches[searches table]
        MetaDB --> Analytics[analytics table]
        MetaDB --> Databases[databases table]
    end

    subgraph "User Databases"
        UserDB1[(User Database 1<br/>Customer Data)]
        UserDB2[(User Database 2<br/>Customer Data)]
        UserDBN[(User Database N<br/>Customer Data)]
    end

    Services --> MetaDB
    Services --> UserDB1
    Services --> UserDB2
    Services --> UserDBN

    style MetaDB fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    style UserDB1 fill:#e3f2fd,stroke:#2196f3
    style UserDB2 fill:#e3f2fd,stroke:#2196f3
    style UserDBN fill:#e3f2fd,stroke:#2196f3
```

### Database Responsibilities

#### 1. **Primary Database (Metadata Storage)**

- **Purpose**: Store Altus 4 system metadata and configuration
- **Database**: `altus4_metadata`
- **Contents**: Users, API keys, search history, analytics, database connections
- **Management**: Fully managed by Altus 4 with migrations

#### 2. **User Databases (Search Targets)**

- **Purpose**: Customer databases that Altus 4 searches
- **Management**: Read-only access, customer-managed
- **Requirements**: MySQL 8.0+ with FULLTEXT indexes
- **Connection**: Secure connection pooling per database

## Primary Database Schema

### Core Tables Overview

```mermaid
erDiagram
    users {
        char(36) id PK
        varchar(255) name
        varchar(255) email UK
        varchar(255) password
        varchar(50) role
        timestamp created_at
        timestamp updated_at
    }

    api_keys {
        char(36) id PK
        char(36) user_id FK
        varchar(30) key_prefix
        varchar(64) key_hash
        varchar(255) name
        enum environment
        json permissions
        enum rate_limit_tier
        timestamp expires_at
        timestamp last_used
        varchar(45) last_used_ip
        int usage_count
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    databases {
        char(36) id PK
        char(36) user_id FK
        varchar(255) name
        varchar(255) host
        int port
        varchar(255) database_name
        varchar(255) username
        text password_encrypted
        boolean ssl_enabled
        json connection_config
        boolean is_active
        timestamp last_connected
        timestamp created_at
        timestamp updated_at
    }

    searches {
        char(36) id PK
        char(36) user_id FK
        char(36) database_id FK
        varchar(1000) query
        enum search_mode
        json search_params
        int result_count
        int execution_time_ms
        json categories
        timestamp created_at
    }

    analytics {
        char(36) id PK
        char(36) user_id FK
        date analytics_date
        varchar(255) metric_name
        json metric_data
        timestamp created_at
        timestamp updated_at
    }

    users ||--o{ api_keys : "has many"
    users ||--o{ databases : "owns"
    users ||--o{ searches : "performs"
    users ||--o{ analytics : "generates"
    databases ||--o{ searches : "searched in"
```

### Table Specifications

#### 1. `users` Table

**Purpose**: Store user account information and authentication data

```sql
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,  -- bcrypt hashed
  role VARCHAR(50) DEFAULT 'user', -- 'user' or 'admin'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_created_at (created_at)
);
```

**Key Features:**

- **UUID Primary Key**: Globally unique identifiers
- **Email Uniqueness**: Enforced at database level
- **Password Security**: bcrypt hashed with salt rounds
- **Role-Based Access**: Simple role system (user/admin)
- **Audit Trail**: Created/updated timestamps

#### 2. `api_keys` Table

**Purpose**: Store API key metadata and usage tracking

```sql
CREATE TABLE api_keys (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  key_prefix VARCHAR(30) NOT NULL,     -- 'altus4_sk_live_abc123'
  key_hash VARCHAR(64) NOT NULL,       -- SHA-256 hash of full key
  name VARCHAR(255) NOT NULL,          -- 'Production Server'
  environment ENUM('test', 'live') NOT NULL DEFAULT 'test',
  permissions JSON DEFAULT ('["search"]'), -- ["search", "analytics", "admin"]
  rate_limit_tier ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
  rate_limit_custom JSON NULL,         -- Custom rate limits if needed
  expires_at TIMESTAMP NULL,           -- NULL = never expires
  last_used TIMESTAMP NULL,
  last_used_ip VARCHAR(45) NULL,       -- IPv4/IPv6 support
  usage_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes for performance
  INDEX idx_key_prefix (key_prefix),
  INDEX idx_key_hash (key_hash),
  INDEX idx_user_id (user_id),
  INDEX idx_environment (environment),
  INDEX idx_active_keys (is_active, expires_at),
  INDEX idx_last_used (last_used),

  -- Foreign key constraint
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Key Features:**

- **Secure Storage**: Only hash stored, never full key
- **Prefix Indexing**: Fast lookup by key prefix
- **Tiered Permissions**: Granular permission system
- **Usage Tracking**: Monitor API key usage patterns
- **Environment Separation**: Test vs live key isolation
- **Expiration Support**: Optional key expiration

#### 3. `databases` Table

**Purpose**: Store user database connection configurations

```sql
CREATE TABLE databases (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,          -- User-friendly name
  host VARCHAR(255) NOT NULL,
  port INT NOT NULL DEFAULT 3306,
  database_name VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  password_encrypted TEXT NOT NULL,    -- AES-256 encrypted
  ssl_enabled BOOLEAN DEFAULT false,
  connection_config JSON NULL,         -- Additional connection options
  is_active BOOLEAN DEFAULT true,
  last_connected TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_active (is_active),
  INDEX idx_last_connected (last_connected),
  UNIQUE KEY unique_user_database (user_id, host, port, database_name),

  -- Foreign key constraint
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Key Features:**

- **Encrypted Credentials**: AES-256 encryption for passwords
- **Connection Pooling**: Support for connection pool configuration
- **SSL Support**: Secure database connections
- **Health Monitoring**: Track connection status and last usage
- **Uniqueness**: Prevent duplicate database connections per user

#### 4. `searches` Table

**Purpose**: Log search operations for analytics and debugging

```sql
CREATE TABLE searches (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  database_id CHAR(36) NULL,           -- NULL for multi-database searches
  query VARCHAR(1000) NOT NULL,
  search_mode ENUM('natural', 'boolean', 'semantic') DEFAULT 'natural',
  search_params JSON NULL,             -- Additional search parameters
  result_count INT NOT NULL DEFAULT 0,
  execution_time_ms INT NOT NULL DEFAULT 0,
  categories JSON NULL,                -- AI-generated categories
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for analytics queries
  INDEX idx_user_id (user_id),
  INDEX idx_database_id (database_id),
  INDEX idx_search_mode (search_mode),
  INDEX idx_created_at (created_at),
  INDEX idx_execution_time (execution_time_ms),
  FULLTEXT INDEX ft_query (query),

  -- Foreign key constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (database_id) REFERENCES databases(id) ON DELETE SET NULL
);
```

**Key Features:**

- **Search Analytics**: Track all search operations
- **Performance Monitoring**: Execution time tracking
- **Query Analysis**: Full-text search on queries themselves
- **Categorization**: Store AI-generated result categories
- **Multi-Database Support**: Handle searches across multiple databases

#### 5. `analytics` Table

**Purpose**: Store aggregated analytics and metrics data

```sql
CREATE TABLE analytics (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  analytics_date DATE NOT NULL,
  metric_name VARCHAR(255) NOT NULL,   -- 'daily_searches', 'popular_queries'
  metric_data JSON NOT NULL,           -- Flexible metric storage
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes for analytics queries
  INDEX idx_user_id (user_id),
  INDEX idx_date (analytics_date),
  INDEX idx_metric_name (metric_name),
  UNIQUE KEY unique_user_date_metric (user_id, analytics_date, metric_name),

  -- Foreign key constraint
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Key Features:**

- **Flexible Metrics**: JSON storage for various metric types
- **Time-Series Data**: Date-based analytics storage
- **Aggregation Support**: Pre-computed analytics for performance
- **Uniqueness**: Prevent duplicate metrics per user/date

## Migration System

### Migration Architecture

Altus 4 uses a SQL-based migration system with up/down scripts:

```
migrations/
├── 001_create_users_table.up.sql
├── 001_create_users_table.down.sql
├── 002_create_searches_table.up.sql
├── 002_create_searches_table.down.sql
├── 003_create_analytics_table.up.sql
├── 003_create_analytics_table.down.sql
├── 004_create_api_keys_table.up.sql
├── 004_create_api_keys_table.down.sql
├── 005_update_users_table_for_api_keys.up.sql
├── 005_update_users_table_for_api_keys.down.sql
└── README.txt
```

### Migration Management

#### Running Migrations

```bash
# Apply all pending migrations
npm run migrate

# Apply migrations explicitly
npm run migrate:up

# Rollback all migrations
npm run migrate:down

# Check migration status
npm run migrate:status
```

#### Migration Script

The migration system uses a bash script that:

1. **Loads Environment Variables**: From `.env` file
2. **Validates Database Connection**: Ensures database is accessible
3. **Tracks Migration State**: Uses a `migrations` table
4. **Applies Changes Sequentially**: In numerical order
5. **Handles Errors Gracefully**: Stops on first error

```bash
#!/bin/bash
# bin/migrate.sh

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Validate required variables
if [ -z "$DB_HOST" ] || [ -z "$DB_USERNAME" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_DATABASE" ]; then
    echo "Error: Missing required database environment variables"
    exit 1
fi

# Create migrations tracking table
mysql -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD" "$DB_DATABASE" << EOF
CREATE TABLE IF NOT EXISTS migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOF

# Apply migrations based on command
case "$1" in
    "up")
        apply_migrations_up
        ;;
    "down")
        apply_migrations_down
        ;;
    "status")
        show_migration_status
        ;;
    *)
        echo "Usage: $0 {up|down|status}"
        exit 1
        ;;
esac
```

### Migration Best Practices

#### 1. **Atomic Migrations**

Each migration should be atomic and reversible:

```sql
-- 006_add_user_preferences.up.sql
START TRANSACTION;

ALTER TABLE users
ADD COLUMN preferences JSON NULL,
ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';

CREATE INDEX idx_users_timezone ON users(timezone);

COMMIT;
```

```sql
-- 006_add_user_preferences.down.sql
START TRANSACTION;

DROP INDEX idx_users_timezone ON users;

ALTER TABLE users
DROP COLUMN preferences,
DROP COLUMN timezone;

COMMIT;
```

#### 2. **Data Migrations**

Handle data transformations carefully:

```sql
-- 007_migrate_search_data.up.sql
START TRANSACTION;

-- Add new column
ALTER TABLE searches ADD COLUMN search_metadata JSON NULL;

-- Migrate existing data
UPDATE searches
SET search_metadata = JSON_OBJECT(
    'legacy_params', search_params,
    'migrated_at', NOW()
)
WHERE search_params IS NOT NULL;

-- Remove old column after data migration
ALTER TABLE searches DROP COLUMN search_params;

COMMIT;
```

#### 3. **Index Management**

Create indexes concurrently when possible:

```sql
-- 008_add_performance_indexes.up.sql
-- Add indexes for better query performance
CREATE INDEX CONCURRENTLY idx_searches_user_created
ON searches(user_id, created_at);

CREATE INDEX CONCURRENTLY idx_api_keys_usage
ON api_keys(usage_count, last_used);
```

## User Database Requirements

### FULLTEXT Index Requirements

User databases must have FULLTEXT indexes for search functionality:

```sql
-- Example user database schema
CREATE TABLE articles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(100),
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Required: FULLTEXT index for search
    FULLTEXT KEY ft_title_content (title, content),
    FULLTEXT KEY ft_title (title),
    FULLTEXT KEY ft_content (content)
);

CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    price DECIMAL(10,2),

    -- Required: FULLTEXT index for search
    FULLTEXT KEY ft_name_description (name, description),
    FULLTEXT KEY ft_name (name)
);
```

### Schema Discovery

Altus 4 automatically discovers user database schemas:

```typescript
interface DiscoveredSchema {
  database: string;
  tables: TableInfo[];
}

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  fulltextIndexes: FullTextIndex[];
  estimatedRows: number;
  lastAnalyzed: Date;
}

interface FullTextIndex {
  name: string;
  columns: string[];
  type: 'FULLTEXT';
  cardinality?: number;
}
```

### Connection Requirements

#### 1. **User Permissions**

User database connections require specific permissions:

```sql
-- Create read-only user for Altus 4
CREATE USER 'altus4_search'@'%' IDENTIFIED BY 'secure_password';

-- Grant necessary permissions
GRANT SELECT ON your_database.* TO 'altus4_search'@'%';
GRANT SHOW VIEW ON your_database.* TO 'altus4_search'@'%';

-- For schema discovery
GRANT SELECT ON information_schema.* TO 'altus4_search'@'%';

FLUSH PRIVILEGES;
```

#### 2. **Connection Security**

- **SSL Encryption**: Recommended for production
- **IP Whitelisting**: Restrict access to Altus 4 servers
- **Connection Limits**: Configure appropriate connection limits
- **Timeout Settings**: Set reasonable timeout values

## Database Optimization

### 1. **Query Optimization**

#### FULLTEXT Search Optimization

```sql
-- Optimize FULLTEXT search performance
SET GLOBAL ft_min_word_len = 2;
SET GLOBAL innodb_ft_min_token_size = 2;

-- For boolean mode searches
SET GLOBAL ft_boolean_syntax = '+ -><()~*:""&|';

-- Restart MySQL to apply changes
```

#### Index Strategies

```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_searches_user_date ON searches(user_id, created_at);
CREATE INDEX idx_api_keys_active_tier ON api_keys(is_active, rate_limit_tier);

-- Covering indexes for frequently accessed columns
CREATE INDEX idx_databases_user_active_name ON databases(user_id, is_active, name);
```

### 2. **Connection Pool Optimization**

```typescript
// Optimized connection pool configuration
const poolConfig = {
  connectionLimit: 10, // Max connections per pool
  acquireTimeout: 60000, // 60 seconds to get connection
  timeout: 60000, // 60 seconds query timeout
  reconnect: true, // Auto-reconnect on connection loss
  idleTimeout: 300000, // 5 minutes idle timeout

  // SSL configuration
  ssl: {
    rejectUnauthorized: false,
    ca: fs.readFileSync('ca-cert.pem'),
    key: fs.readFileSync('client-key.pem'),
    cert: fs.readFileSync('client-cert.pem'),
  },
};
```

### 3. **Performance Monitoring**

#### Query Performance Tracking

```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1; -- Log queries > 1 second

-- Monitor FULLTEXT search performance
SELECT
    table_schema,
    table_name,
    index_name,
    cardinality,
    pages
FROM information_schema.statistics
WHERE index_type = 'FULLTEXT';
```

#### Connection Monitoring

```typescript
// Monitor connection pool health
export class DatabaseService {
  async getPoolStats(databaseId: string): Promise<PoolStats> {
    const pool = this.pools.get(databaseId);
    if (!pool) throw new Error('Pool not found');

    return {
      totalConnections: pool.config.connectionLimit,
      activeConnections: pool._allConnections.length,
      idleConnections: pool._freeConnections.length,
      queuedRequests: pool._connectionQueue.length,
    };
  }
}
```

## Backup and Recovery

### 1. **Backup Strategy**

#### Automated Backups

```bash
#!/bin/bash
# backup-database.sh

DB_NAME="altus4_metadata"
BACKUP_DIR="/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup with compression
mysqldump \
  --host="$DB_HOST" \
  --user="$DB_USERNAME" \
  --password="$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  "$DB_NAME" | gzip > "$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"

# Retain only last 30 days of backups
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +30 -delete
```

#### Point-in-Time Recovery

```ini
# Enable binary logging for point-in-time recovery
[mysqld]
log-bin=mysql-bin
binlog-format=ROW
expire_logs_days=7
```

### 2. **Disaster Recovery**

#### Recovery Procedures

```bash
# Restore from backup
gunzip < /backups/mysql/altus4_metadata_20240115_120000.sql.gz | \
mysql -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD" "$DB_NAME"

# Apply binary logs for point-in-time recovery
mysqlbinlog --start-datetime="2024-01-15 12:00:00" \
           --stop-datetime="2024-01-15 14:30:00" \
           mysql-bin.000001 | \
mysql -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD"
```

## Security Considerations

### 1. **Data Encryption**

#### At Rest Encryption

```sql
-- Enable encryption at rest
CREATE TABLE sensitive_data (
    id INT PRIMARY KEY,
    encrypted_data VARBINARY(255)
) ENCRYPTION='Y';
```

#### In Transit Encryption

```typescript
// SSL connection configuration
const sslConfig = {
  ssl: {
    ca: fs.readFileSync('ca-cert.pem'),
    key: fs.readFileSync('client-key.pem'),
    cert: fs.readFileSync('client-cert.pem'),
    rejectUnauthorized: true,
  },
};
```

### 2. **Access Control**

#### Database User Privileges

```sql
-- Principle of least privilege
CREATE USER 'altus4_app'@'%' IDENTIFIED BY 'secure_password';

-- Grant only necessary permissions
GRANT SELECT, INSERT, UPDATE ON altus4_metadata.users TO 'altus4_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON altus4_metadata.api_keys TO 'altus4_app'@'%';
GRANT SELECT, INSERT ON altus4_metadata.searches TO 'altus4_app'@'%';
GRANT SELECT, INSERT, UPDATE ON altus4_metadata.analytics TO 'altus4_app'@'%';

-- Read-only access to user databases
GRANT SELECT ON user_database.* TO 'altus4_search'@'%';
```

### 3. **Audit Logging**

```sql
-- Enable audit logging
INSTALL PLUGIN audit_log SONAME 'audit_log.so';
SET GLOBAL audit_log_policy = 'ALL';
SET GLOBAL audit_log_format = 'JSON';
```

## Related Documentation

- **[Service Layer Architecture](./services.md)** - How services interact with databases
- **[Security Model](./security.md)** - Comprehensive security architecture
- **[API Reference](../api/database.md)** - Database management API endpoints
- **[Deployment Guide](../deployment/)** - Production database setup

---

**The database architecture provides a solid foundation for Altus 4's multi-tenant search capabilities while maintaining security, performance, and scalability.**
