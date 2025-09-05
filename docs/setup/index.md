---
title: Setup & Deployment Guide
description: Complete installation and deployment documentation for Altus 4 from local development to production.
---

# Setup & Deployment Guide

Complete installation and deployment documentation for Altus 4

This guide covers everything from local development setup to production deployment with detailed step-by-step instructions.

## Quick Start

Get Altus 4 running locally in under 5 minutes:

```bash
# Prerequisites: Node.js 18+, MySQL 8.0+, Redis 6.0+

# Clone and install
git clone https://github.com/altus4/core.git
cd altus4
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

Visit `http://localhost:3000/health` to verify the installation.

## Detailed Installation Guide

### System Requirements

#### Minimum Requirements

- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher
- **MySQL**: Version 8.0 or higher
- **Redis**: Version 6.0 or higher
- **Memory**: 2GB RAM
- **Storage**: 1GB available disk space

#### Recommended Requirements

- **Node.js**: Version 20.0 or higher
- **Memory**: 4GB RAM or more
- **Storage**: 5GB available disk space
- **CPU**: 2+ cores for better performance

#### Operating System Support

- **Linux**: Ubuntu 20.04+, CentOS 8+, Debian 11+
- **macOS**: macOS 12+ (Monterey)
- **Windows**: Windows 10/11 with WSL2

### Step 1: Install Prerequisites

#### Node.js Installation

**macOS (using Homebrew):**

```bash
brew install node@20
```

**Ubuntu/Debian:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows:**
Download from [nodejs.org](https://nodejs.org) or use Chocolatey:

```powershell
choco install nodejs
```

**Verify installation:**

```bash
node --version  # Should be 18.0.0 or higher
npm --version   # Should be 8.0.0 or higher
```

#### MySQL Installation

**macOS:**

```bash
brew install mysql@8.0
brew services start mysql
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install mysql-server-8.0
sudo systemctl start mysql
sudo systemctl enable mysql
```

**Windows:**
Download from [MySQL website](https://dev.mysql.com/downloads/installer/) and follow the installer.

**Secure MySQL installation:**

```bash
sudo mysql_secure_installation
```

#### Redis Installation

**macOS:**

```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**

```bash
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Windows:**
Use WSL2 or Docker:

```bash
# Using Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

**Verify Redis:**

```bash
redis-cli ping
# Should return: PONG
```

### Step 2: Database Setup

#### Create MySQL Database and User

```sql
-- Connect to MySQL as root
mysql -u root -p

-- Create database
CREATE DATABASE altus4_metadata CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER 'altus4_user'@'localhost' IDENTIFIED BY 'your_secure_password';
CREATE USER 'altus4_user'@'%' IDENTIFIED BY 'your_secure_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON altus4_metadata.* TO 'altus4_user'@'localhost';
GRANT ALL PRIVILEGES ON altus4_metadata.* TO 'altus4_user'@'%';
FLUSH PRIVILEGES;

-- Verify user creation
SELECT User, Host FROM mysql.user WHERE User = 'altus4_user';

-- Exit MySQL
EXIT;
```

#### Test Database Connection

```bash
mysql -u altus4_user -p -h localhost altus4_metadata
```

### Database Migrations

Altus 4 includes a migration system for managing database schema changes automatically.

#### Migration System Overview

- **Migration files** are stored in the `migrations/` directory
- Each migration has an `up` script (e.g., `001_create_users_table.up.sql`) and a `down` script (e.g., `001_create_users_table.down.sql`)
- The migration tool uses your environment variables for database connectivity
- Migrations are applied in order based on their numeric prefix

#### Available Migration Commands

```bash
# Apply all migrations (recommended for setup)
npm run migrate

# Apply migrations explicitly (same as above)
npm run migrate:up

# Rollback all migrations (be careful in production!)
npm run migrate:down

# Show migration status and available migrations
npm run migrate:status
```

#### Environment Configuration for Migrations

The migration system uses these environment variables:

```bash
DB_HOST=localhost        # Database host
DB_PORT=3306            # Database port (defaults to 3306)
DB_USERNAME=altus4_user # Database username
DB_PASSWORD=password    # Database password
DB_DATABASE=altus4_metadata # Database name
```

Set these in your `.env` file, and the migration script will automatically load them.

#### Migration Best Practices

1. **Always run migrations after cloning** the repository
2. **Check migration status** before applying: `npm run migrate:status`
3. **Backup your database** before running migrations in production
4. **Test migrations** in development first
5. **Never modify existing migration files** - create new ones instead

#### Manual Migration Script Usage

You can also run the migration script directly:

```bash
# Make script executable and run
chmod +x bin/migrate.sh

# Apply migrations
./bin/migrate.sh up

# Rollback migrations
./bin/migrate.sh down

# Show detailed migration status
./bin/migrate.sh status
```

#### Optimize MySQL for Full-text Search

Add these configurations to your MySQL configuration file (`/etc/mysql/mysql.conf.d/mysqld.cnf` on Ubuntu):

```ini
[mysqld]
# Full-text search optimizations
ft_min_word_len = 2
innodb_ft_min_token_size = 2
innodb_ft_max_token_size = 84

# Performance optimizations
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
max_connections = 200
query_cache_type = 1
query_cache_size = 64M

# Character set
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
```

Restart MySQL after making changes:

```bash
sudo systemctl restart mysql
```

### Step 3: Project Installation

#### Clone Repository

```bash
git clone https://github.com/altus4/core.git
cd altus4
```

#### Install Dependencies

```bash
# Install all dependencies
npm install

# Verify installation
npm list --depth=0
```

#### Build Project

```bash
# Build TypeScript to JavaScript
npm run build

# Run database migrations
npm run migrate

# Verify build
ls -la dist/
```

### Step 4: Configuration

#### Environment Variables

Create environment configuration:

```bash
# Copy example environment file
cp .env.example .env

# Generate secure secrets (JWT for legacy endpoints only)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

Edit `.env` file with your configuration:

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=altus4_user
DB_PASSWORD=your_secure_password
DB_DATABASE=altus4_metadata

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Security Configuration
JWT_SECRET=your_32_character_secret_key_here  # For legacy endpoints only
ENCRYPTION_KEY=your_32_character_encryption_key
JWT_EXPIRES_IN=7d  # For legacy endpoints only
BCRYPT_ROUNDS=12

# AI Configuration (optional)
OPENAI_API_KEY=sk-your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=1000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Performance Settings
ENABLE_QUERY_LOGGING=false
ENABLE_PERFORMANCE_MONITORING=true
```

#### Configuration Validation

Validate your configuration:

```bash
# Test configuration
npm run config:validate

# Test database connection
npm run db:test

# Test Redis connection
npm run cache:test
```

### Step 5: Testing Installation

#### Run Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration

# Run tests with coverage
npm run test:coverage
```

#### Start Development Server

```bash
# Start in development mode with hot reload
npm run dev
```

The server should start on `http://localhost:3000`. You should see:

```text
Altus 4 Server started on port 3000
🌍 Environment: development
Health check: http://localhost:3000/health
Database connected successfully
Redis connected successfully
```

#### Verify Installation

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "0.1.0",
  "uptime": 1.234
}
```

Test database health:

```bash
curl http://localhost:3000/health/db
```

Test Redis health:

```bash
curl http://localhost:3000/health/redis
```

### Step 6: Initial Setup

#### Create First User and API Key

```bash
# 1. Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!",
    "name": "Admin User"
  }'

# 2. Login to get JWT token (for initial setup only)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!"
  }'

# 3. Create your first API key (using JWT from step 2)
curl -X POST http://localhost:3000/api/management/setup \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Save the API key from step 3 - this is what you'll use for all API requests going forward.

#### Add Database Connection

```bash
curl -X POST http://localhost:3000/api/databases \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Database",
    "host": "localhost",
    "port": 3306,
    "database": "my_app_database",
    "username": "db_user",
    "password": "db_password"
  }'
```

#### Test Search Functionality

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test search",
    "databases": ["database_id_from_previous_step"],
    "searchMode": "natural",
    "limit": 10
  }'
```

## Development Environment

### IDE Setup

#### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.associations": {
    ".env*": "dotenv"
  }
}
```

#### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vsliveshare.vsliveshare"
  ]
}
```

### Development Scripts

```bash
# Development server with hot reload
npm run dev

# Build project
npm run build

# Run built project
npm start

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Linting and formatting
npm run lint
npm run lint:fix
npm run format
npm run format:check

# Type checking
npm run type-check

# Database operations
npm run migrate         # Run all database migrations
npm run migrate:up      # Apply migrations (explicit up)
npm run migrate:down    # Rollback migrations
npm run migrate:status  # Show migration status
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

**Error:** `Access denied for user 'altus4_user'@'localhost'`

**Solutions:**

```sql
-- Check user exists
SELECT User, Host FROM mysql.user WHERE User = 'altus4_user';

-- Reset user password
ALTER USER 'altus4_user'@'localhost' IDENTIFIED BY 'new_password';

-- Check permissions
SHOW GRANTS FOR 'altus4_user'@'localhost';

-- Grant all permissions
GRANT ALL PRIVILEGES ON altus4_metadata.* TO 'altus4_user'@'localhost';
FLUSH PRIVILEGES;
```

#### 2. Redis Connection Issues

**Error:** `Redis connection failed: ECONNREFUSED`

**Solutions:**

```bash
# Check Redis status
redis-cli ping

# Start Redis service
sudo systemctl start redis-server

# Check Redis configuration
cat /etc/redis/redis.conf | grep bind

# Test connection with custom host/port
redis-cli -h localhost -p 6379 ping
```

#### 3. Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solutions:**

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port in .env
PORT=3001
```

#### 4. OpenAI API Issues

**Error:** `Invalid API key` or rate limit errors

**Solutions:**

- Verify API key in OpenAI dashboard
- Check API usage and billing
- Implement retry logic for rate limits
- Use API key with sufficient credits

#### 5. Full-text Search Not Working

**Error:** Search returns no results despite data existing

**Solutions:**

```sql
-- Check if FULLTEXT indexes exist
SHOW INDEX FROM your_table WHERE Index_type = 'FULLTEXT';

-- Create FULLTEXT index
ALTER TABLE your_table ADD FULLTEXT(column1, column2);

-- Repair table if needed
REPAIR TABLE your_table;

-- Check MySQL full-text configuration
SHOW VARIABLES LIKE 'ft_%';
```

### Performance Issues

#### 1. Slow Search Responses

**Diagnostics:**

```bash
# Enable query logging
export ENABLE_QUERY_LOGGING=true

# Monitor Redis performance
redis-cli --latency

# Check MySQL performance
mysqladmin -u root -p processlist
```

**Solutions:**

- Add proper database indexes
- Optimize MySQL configuration
- Increase Redis memory
- Enable query caching

#### 2. High Memory Usage

**Diagnostics:**

```bash
# Monitor memory usage
node --inspect server.js

# Check for memory leaks
npm run test:memory
```

**Solutions:**

- Implement connection pooling
- Add garbage collection tuning
- Optimize cache TTL values
- Monitor for memory leaks

### Logging and Debugging

#### Enable Debug Logging

```bash
# Set log level to debug
export LOG_LEVEL=debug

# Enable SQL query logging
export ENABLE_QUERY_LOGGING=true

# Enable performance monitoring
export ENABLE_PERFORMANCE_MONITORING=true
```

#### Access Log Files

```bash
# Application logs
tail -f logs/combined.log

# Error logs
tail -f logs/error.log

# Search-specific logs
grep "Search" logs/combined.log
```

## Production Deployment

See [Production Deployment Guide](../deployment/production.md) for detailed production setup instructions including:

- Docker deployment
- Load balancer configuration
- SSL/TLS setup
- Monitoring and alerting
- Backup strategies
- Security hardening

## Next Steps

After successful installation:

1. **Read the API Documentation**: [API Reference](../api/)
2. **Explore Examples**: [Code Examples](../examples/)
3. **Understand the Architecture**: [Architecture Guide](../architecture/)
4. **Contributing**: [Development Guide](../development/)

## Support

If you encounter issues not covered in this guide:

- Review the troubleshooting sections in this guide
- Search [GitHub Issues](https://github.com/altus4/core/issues)
- Join our [Community Discussions](https://github.com/altus4/core/discussions)
- Contact support: <support@altus4.dev>

---

**Congratulations! You now have Altus 4 running and ready to enhance your MySQL search capabilities with AI-powered features.**
