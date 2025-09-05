---
title: Quick Start Guide
description: Get Altus 4 running in 5 minutes with this step-by-step quick start guide.
---

# Quick Start Guide

Get Altus 4 running in 5 minutes

This guide will get you up and running with Altus 4 as quickly as possible. For detailed installation instructions, see the [complete setup guide](./index.md).

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** installed
- **MySQL 8.0+** running and accessible
- **Redis 6.0+** running (optional but recommended)
- **OpenAI API key** (optional, for AI features)

## Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/altus4/core.git
cd altus4

# Install dependencies
npm install
```

## Step 2: Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit the .env file with your settings
nano .env
```

**Minimum required environment variables:**

```bash
# Database Configuration (Primary - for metadata storage)
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_DATABASE=altus4

# Authentication
JWT_SECRET=your_very_long_and_secure_jwt_secret_key_here_at_least_32_characters

# Redis Configuration (optional but recommended)
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI Integration (optional - for AI features)
OPENAI_API_KEY=sk-your_openai_api_key_here
```

## Step 3: Database Setup

**Option 1: Docker Environment (Recommended)**

```bash
# Start Docker services (MySQL + Redis) with automatic setup
npm run dev:start
```

This will:

- Start MySQL and Redis containers
- Create the `altus4` database automatically
- Run all database migrations
- Wait for services to be healthy

**Option 2: Manual Database Setup**

Create the MySQL database manually:

```sql
-- Connect to MySQL as root
mysql -u root -p

-- Create database
CREATE DATABASE altus4 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Step 4: Run Migrations

```bash
# Apply database migrations
npm run migrate

# Check migration status
npm run migrate:status
```

Expected output:

```text
✅ Migration 001_create_users_table.up.sql applied
✅ Migration 002_create_searches_table.up.sql applied
✅ Migration 003_create_analytics_table.up.sql applied
✅ Migration 004_create_api_keys_table.up.sql applied
✅ Migration 005_update_users_table_for_api_keys.up.sql applied
✅ Migration 006_create_database_connections_table.up.sql applied
✅ Migration 007_create_search_analytics_table.up.sql applied
```

## Step 5: Start the Server

```bash
# Start development server
npm run dev
```

Expected output:

```text
🚀 Altus 4 Server started on port 3000
🌍 Environment: development
📊 Health check: http://localhost:3000/health
```

## Step 6: Verify Installation

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "0.2.1",
  "uptime": 1.234
}
```

## Step 7: Create Your First API Key

### Register a User Account

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "secure_password123",
    "name": "Admin User"
  }'
```

### Login and Get JWT Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "secure_password123"
  }'
```

Save the JWT token from the response.

### Create Your First API Key

```bash
curl -X POST http://localhost:3000/api/v1/management/setup \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Save the API key from the response** - you'll need it for all future requests!

## Step 8: Test Your First Search

### Add a Database Connection

```bash
curl -X POST http://localhost:3000/api/v1/databases \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Test Database",
    "host": "localhost",
    "port": 3306,
    "database": "your_existing_db",
    "username": "db_user",
    "password": "db_password"
  }'
```

### Execute Your First Search

```bash
curl -X POST http://localhost:3000/api/v1/search \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test search",
    "databases": ["DATABASE_ID_FROM_PREVIOUS_STEP"],
    "searchMode": "natural",
    "limit": 10
  }'
```

## Success

You now have Altus 4 running locally! Here's what you can do next:

### Explore the API

- **[API Reference](../api/)** - Complete API documentation
- **[Search Operations](../api/search.md)** - Advanced search features
- **[Database Management](../api/database.md)** - Managing connections

### Try Advanced Features

- **[AI-Enhanced Search](../examples/ai-integration.md)** - Semantic search with OpenAI
- **[Multi-Database Search](../examples/multi-database.md)** - Search across multiple databases
- **[Analytics & Insights](../api/analytics.md)** - Search trends and performance

### Development

- **[Development Guide](../development/)** - Contributing to Altus 4
- **[Testing Guide](../testing/)** - Running and writing tests

## Troubleshooting

### Common Issues

**Database Connection Failed**

```bash
# Check MySQL is running
sudo systemctl status mysql

# Test connection manually
mysql -h localhost -u altus4_user -p altus4_meta
```

**Redis Connection Issues**

```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Start Redis if not running
redis-server
```

**Port Already in Use**

```bash
# Change port in .env file
PORT=3001

# Or kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

**Migration Errors**

```bash
# Check database exists and user has permissions
mysql -u altus4_user -p -e "SHOW DATABASES;"

# Reset migrations if needed
npm run migrate:down
npm run migrate:up
```

### Getting Help

- **[Complete Setup Guide](./index.md)** - Detailed installation instructions
- **[Development Guide](../development/)** - Development environment setup
- **[GitHub Issues](https://github.com/altus4/core/issues)** - Report bugs or get help
- **[GitHub Discussions](https://github.com/altus4/core/discussions)** - Community support

---

**Ready to build amazing search experiences?** Check out the [examples section](../examples/) for practical implementations!
