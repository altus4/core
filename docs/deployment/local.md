---
title: Local Development Setup
description: Complete guide to setting up Altus 4 for local development with detailed installation instructions and configuration.
---

# Local Development Setup

This guide walks you through setting up Altus 4 for local development on your machine.

## Prerequisites

### System Requirements

- **Node.js**: Version 18 or higher
- **npm**: Version 9 or higher (comes with Node.js)
- **Git**: For version control
- **MySQL**: Version 8.0 or higher
- **Redis**: Version 6.0 or higher (optional but recommended)

### Platform-Specific Installation

#### macOS

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Install MySQL
brew install mysql
brew services start mysql

# Install Redis
brew install redis
brew services start redis
```

#### Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql

# Install Redis
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### Windows

```powershell
# Install Node.js from https://nodejs.org/
# Or use Chocolatey
choco install nodejs

# Install MySQL
choco install mysql

# Install Redis
choco install redis-64
```

## Project Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/altus4-core.git
cd altus4-core
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create your local environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your local configuration:

```bash
# Application Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_DATABASE=altus4

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT Configuration (for legacy endpoints)
JWT_SECRET=your_development_jwt_secret_at_least_32_chars

# OpenAI Configuration (optional)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Logging Configuration
LOG_LEVEL=debug
LOG_FORMAT=pretty

# Development Features
ENABLE_CORS=true
ENABLE_MORGAN_LOGGING=true
ENABLE_SWAGGER=true
```

### 4. Database Setup

#### Option 1: Docker Environment (Recommended)

The easiest way to set up the development environment is using the provided Docker configuration:

```bash
# Start complete development environment
npm run dev:start
```

This command will:

- Start MySQL 8.0 and Redis 7 containers
- Create the `altus4` database automatically
- Run all database migrations
- Wait for services to be healthy
- Display connection information

#### Option 2: Manual Database Setup

If you prefer to use your own MySQL installation:

```bash
# Connect to MySQL as root
mysql -u root -p

# Create database
CREATE DATABASE altus4 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

#### Run Database Migrations

```bash
# Run database schema creation
npm run db:migrate

# Seed development data (optional)
npm run db:seed
```

### 5. Verify Setup

Test your database connection:

```bash
npm run db:test
```

Expected output:

```
✓ Database connection successful
✓ All required tables exist
✓ FULLTEXT indexes are properly configured
```

## Development Commands

### Start Development Server

```bash
# Start with hot reloading
npm run dev

# Start with debugging
npm run dev:debug

# Start with specific port
PORT=4000 npm run dev
```

### Database Operations

```bash
# Run migrations
npm run migrate

# Check migration status
npm run migrate:status

# Rollback migration
npm run migrate:down

# Start Docker environment with automatic setup
npm run dev:start

# Stop Docker environment
npm run dev:stop

# Reset Docker environment (clean slate)
npm run dev:reset

# View Docker service logs
npm run dev:logs
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --testPathPattern=search

# Run tests with coverage
npm run test:coverage

# Run integration tests only
npm run test:integration
```

### Code Quality

```bash
# Run type checking
npm run typecheck

# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check Prettier formatting
npm run format:check

# Run complete quality check
npm run check

# Fix all issues automatically
npm run fix

# Complete validation (check + test)
npm run validate
```

## Script Organization

Altus 4 uses an organized script structure in the `bin/` directory:

```text
bin/
├── dev/                    # 🐳 Development Environment
│   ├── start.sh           # Start Docker services + migrations
│   ├── stop.sh            # Stop Docker services
│   ├── reset.sh           # Reset development environment
│   └── docker-compose.yml # Docker services configuration
├── db/                     # 🗄️ Database Operations
│   └── migrate.sh         # Database migration management
├── security/               # 🔐 Security & Authentication
│   ├── generate-jwt-secret.sh # Generate JWT secrets
│   ├── setup-gpg.sh       # GPG configuration
│   └── verify-commits.sh  # Commit signature verification
├── test/                   # 🧪 Testing Utilities
│   └── test-hooks.sh      # Git hooks testing
├── dev-start*             # 🚀 Convenience shortcuts
├── dev-stop*              # 🛑
├── dev-reset*             # 🔄
├── migrate*               # 📊
└── README.md              # 📖 Documentation
```

### Direct Script Usage

You can also run scripts directly:

```bash
# Development environment
./bin/dev-start            # Start Docker services
./bin/dev-stop             # Stop Docker services
./bin/dev-reset            # Reset environment

# Database operations
./bin/migrate up           # Run migrations
./bin/migrate status       # Check status
./bin/migrate down         # Rollback

# Security operations
./bin/security/generate-jwt-secret.sh
./bin/security/setup-gpg.sh
./bin/security/verify-commits.sh

# Testing
./bin/test/test-hooks.sh
```

## Development Database Schema

### Core Tables

The development database includes these main tables:

```sql
-- Users table
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  tier ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- API keys table
CREATE TABLE api_keys (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  key_hash VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  tier ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
  permissions JSON,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_key_hash (key_hash),
  INDEX idx_user_active (user_id, is_active)
);

-- User databases table
CREATE TABLE databases (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INTEGER DEFAULT 3306,
  username VARCHAR(255) NOT NULL,
  password_encrypted TEXT NOT NULL,
  database_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_connected_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_active (user_id, is_active)
);
```

### Test Data Seeding

The seed script creates sample data for development:

```bash
# Create test user
INSERT INTO users (id, email, password_hash, name, tier) VALUES
('dev-user-1', 'dev@altus4.com', '$2b$10$...', 'Development User', 'pro');

# Create test API key
INSERT INTO api_keys (id, user_id, key_hash, name, tier) VALUES
('dev-key-1', 'dev-user-1', 'hashed_key', 'Development Key', 'pro');

# Create test database connection
INSERT INTO databases (id, user_id, name, host, username, password_encrypted, database_name) VALUES
('dev-db-1', 'dev-user-1', 'Test Blog DB', 'localhost', 'blog_user', 'encrypted_password', 'blog_test');
```

## Development Tools

### VS Code Configuration

Recommended VS Code extensions:

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml"
  ]
}
```

VS Code settings (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.env.local": true
  }
}
```

### Debug Configuration

VS Code debug configuration (`.vscode/launch.json`):

```json
{
  "version": "0.2.1",
  "configurations": [
    {
      "name": "Debug Altus 4",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/index.js",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "envFile": "${workspaceFolder}/.env.local",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--detectOpenHandles"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

## API Testing

### Using cURL

Test the API endpoints locally:

```bash
# Health check
curl http://localhost:3000/health

# Register a test user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Create API key (using JWT from login)
curl -X POST http://localhost:3000/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"name":"Test API Key"}'
```

### Using Postman

Import the Postman collection:

```bash
# Export Postman collection for development
npm run postman:export
```

### Swagger Documentation

Access interactive API documentation at:

```
http://localhost:3000/api/docs
```

## Development Workflow

### Feature Development

1. Create feature branch: `git checkout -b feature/new-search-mode`
2. Make changes and write tests
3. Run tests: `npm test`
4. Run linting: `npm run lint:fix`
5. Commit changes: `git commit -m "feat: add new search mode"`
6. Push and create pull request

### Database Schema Changes

1. Create migration: `npm run db:create-migration add_new_table`
2. Edit migration file in `migrations/` directory
3. Run migration: `npm run db:migrate`
4. Test migration: `npm run db:rollback && npm run db:migrate`
5. Update seed data if needed

### Service Testing

Test individual services:

```typescript
// tests/services/search.test.ts
import { SearchService } from '../../src/services/search.service';

describe('SearchService', () => {
  let searchService: SearchService;

  beforeEach(() => {
    searchService = new SearchService({
      database: mockDatabaseService,
      cache: mockCacheService,
      ai: mockAIService,
    });
  });

  it('should perform natural language search', async () => {
    const results = await searchService.search({
      query: 'machine learning',
      mode: 'natural',
    });

    expect(results).toHaveLength(10);
    expect(results[0]).toHaveProperty('relevance');
  });
});
```

## Common Development Issues

### Port Already in Use

```bash
# Find process using port 3000
lsof -ti:3000

# Kill process
kill -9 $(lsof -ti:3000)

# Or use different port
PORT=3001 npm run dev
```

### Database Connection Issues

```bash
# Check MySQL service status
brew services list | grep mysql  # macOS
systemctl status mysql           # Linux

# Reset MySQL root password
sudo mysql_secure_installation

# Check connection
mysql -u altus4_dev -p altus4_development
```

### Redis Connection Issues

```bash
# Check Redis status
redis-cli ping  # Should return PONG

# Check Redis service
brew services list | grep redis  # macOS
systemctl status redis-server    # Linux
```

### TypeScript Errors

```bash
# Clear TypeScript cache
npm run build:clean

# Regenerate types
npm run build

# Check specific file
npx tsc --noEmit src/services/search.service.ts
```

## Performance Considerations

### Local Development Optimization

- Use SSD for better database performance
- Allocate adequate RAM (minimum 8GB recommended)
- Use local Redis instance for caching
- Enable MySQL query cache for development
- Use nodemon for fast reloading during development

### Development vs Production Differences

- Development uses pretty-printed logs
- Debug logging is enabled
- CORS is permissive in development
- Hot reloading watches for file changes
- Test data is automatically seeded

## Next Steps

Once your local development environment is set up:

1. **Explore the Codebase**: Familiarize yourself with the service architecture
2. **Run the Test Suite**: Understand the testing patterns
3. **Make a Small Change**: Try adding a new API endpoint
4. **Read the API Documentation**: Understand the external interface
5. **Check Out Examples**: See how to integrate with the API
