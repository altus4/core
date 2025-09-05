---
title: Development Guide
description: Complete development documentation for Altus 4 contributors including setup, workflow, and best practices.
---

# Development Guide

Complete development documentation for Altus 4 contributors

This guide covers everything developers need to know to contribute effectively to Altus 4, from setting up the development environment to submitting pull requests.

## Getting Started

### Prerequisites

Before contributing to Altus 4, ensure you have:

- **Node.js 18+** with npm 8+
- **MySQL 8.0+** for database operations
- **Redis 6.0+** for caching
- **Git** for version control
- **IDE** with TypeScript support (VS Code recommended)

### Development Environment Setup

1. **Fork and Clone the Repository**

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/altus4.git
cd altus4

# Add upstream remote
git remote add upstream https://github.com/original/altus4.git
```

1. **Install Dependencies**

```bash
# Install all dependencies
npm install

# Verify installation
npm run typecheck
```

1. **Configure Environment**

```bash
# Copy development environment template
cp .env.example .env

# Edit with your local configuration
nano .env
```

1. **Setup Development Environment**

**Option 1: Docker Environment (Recommended)**

```bash
# Start complete development environment
npm run dev:start

# This automatically:
# - Starts MySQL and Redis containers
# - Creates the altus4 database
# - Runs all migrations
# - Waits for services to be healthy
```

**Option 2: Manual Database Setup**

```sql
-- Create development database
CREATE DATABASE altus4 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create test database
CREATE DATABASE altus4_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

1. **Run Database Migrations**

```bash
# Apply all migrations to development database
npm run migrate

# Check migration status
npm run migrate:status

# Rollback if needed
npm run migrate:down
```

1. **Start Development Server**

```bash
# Start in development mode with hot reload
npm run dev

# Verify server is running
curl http://localhost:3000/health
```

## Available npm Scripts

Altus 4 provides a comprehensive set of npm scripts organized by functionality:

### 🚀 Core Development

```bash
npm run dev              # Start development server with hot reload
npm run build            # Build production bundle (tsc + tsc-alias)
npm start                # Start production server
npm run clean            # Clean build artifacts
```

### ✅ Quality Assurance

```bash
npm run typecheck        # TypeScript type checking only
npm run lint             # ESLint checking only
npm run lint:fix         # Fix ESLint issues
npm run format           # Format all files with Prettier
npm run format:check     # Check Prettier formatting
npm run format:src       # Format source files only
npm run format:tests     # Format test files only
npm run check            # Full quality check (typecheck + lint + format:check)
npm run validate         # Complete validation (check + test)
npm run fix              # Fix all issues (lint:fix + format)
```

### 🧪 Testing

```bash
npm test                 # Unit tests only
npm run test:watch       # Unit tests in watch mode
npm run test:coverage    # Unit tests with coverage
npm run test:integration # Integration tests only
npm run test:performance # Performance tests only
npm run test:all         # All tests (unit + integration)
```

### 🗄️ Database Management

```bash
npm run migrate          # Run pending migrations (up)
npm run migrate:up       # Run pending migrations (explicit)
npm run migrate:down     # Rollback migrations
npm run migrate:status   # Check migration status
```

### 🐳 Development Environment

```bash
npm run dev:start        # Start Docker services + migrations
npm run dev:stop         # Stop Docker services
npm run dev:reset        # Reset development environment
npm run dev:logs         # View Docker service logs
```

### 🔐 Security & Git Hooks

```bash
npm run security:audit           # Security audit
npm run security:fix             # Fix security issues
npm run security:verify-commits  # Verify commit signatures
npm run security:setup-gpg       # Setup GPG signing
npm run security:configure-gpg   # Configure GPG signing
npm run security:generate-jwt    # Generate JWT secret
npm run hooks:test               # Test Git hooks functionality
```

## Project Structure

Understanding the codebase organization:

```text
altus4/
├── src/                          # Source code
│   ├── config/                   # Configuration management
│   │   └── index.ts             # Environment configuration
│   ├── controllers/             # Request handlers
│   │   ├── AuthController.ts    # Authentication endpoints
│   │   ├── SearchController.ts  # Search endpoints
│   │   └── DatabaseController.ts # Database management
│   ├── middleware/              # Express middleware
│   │   ├── auth.ts             # Legacy JWT authentication
│   │   ├── apiKeyAuth.ts       # API key authentication
│   │   ├── errorHandler.ts     # Error handling
│   │   ├── rateLimiter.ts      # Rate limiting
│   │   └── validation.ts       # Request validation
│   ├── routes/                  # API route definitions
│   │   ├── auth.ts             # Auth routes
│   │   ├── search.ts           # Search routes
│   │   └── database.ts         # Database routes
│   ├── services/                # Business logic layer
│   │   ├── SearchService.ts    # Core search orchestration
│   │   ├── DatabaseService.ts  # MySQL operations
│   │   ├── AIService.ts        # OpenAI integration
│   │   ├── CacheService.ts     # Redis operations
│   │   ├── ApiKeyService.ts    # API key management
│   │   └── UserService.ts      # User management
│   ├── types/                   # TypeScript definitions
│   │   └── index.ts            # Shared type definitions
│   ├── utils/                   # Utility functions
│   │   ├── logger.ts           # Logging utility
│   │   └── encryption.ts       # Encryption helpers
│   └── index.ts                # Application entry point
├── tests/                       # Test files
│   ├── integration/            # Integration tests
│   ├── performance/            # Performance tests
│   ├── utils/                  # Test utilities
│   └── setup.ts               # Test configuration
├── docs/                       # Documentation
├── .github/                    # GitHub workflows
├── dist/                      # Compiled JavaScript (generated)
└── coverage/                  # Test coverage reports (generated)
```

## Code Style & Standards

### TypeScript Configuration

Altus 4 uses strict TypeScript configuration:

```json
// tsconfig.json highlights
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### ESLint & Prettier

Code formatting is enforced through ESLint and Prettier:

```bash
# Check code style
npm run lint

# Auto-fix style issues
npm run lint:fix

# Format code
npm run format
```

### Naming Conventions

| Type        | Convention               | Example                                  |
| ----------- | ------------------------ | ---------------------------------------- |
| Variables   | camelCase                | `searchResults`                          |
| Functions   | camelCase                | `executeSearch()`                        |
| Classes     | PascalCase               | `SearchService`                          |
| Interfaces  | PascalCase with I prefix | `ISearchRequest`                         |
| Types       | PascalCase               | `SearchMode`                             |
| Constants   | UPPER_SNAKE_CASE         | `MAX_SEARCH_RESULTS`                     |
| Files       | camelCase or kebab-case  | `SearchService.ts`, `auth-controller.ts` |
| Directories | camelCase                | `controllers/`, `middleware/`            |

### Code Organization Principles

1. **Single Responsibility**: Each class/function has one clear purpose
2. **Dependency Injection**: Use constructor injection for dependencies
3. **Interface Segregation**: Prefer small, focused interfaces
4. **DRY (Don't Repeat Yourself)**: Extract common functionality
5. **SOLID Principles**: Follow object-oriented design principles

## Development Workflow

### Git Workflow

We follow the **GitHub Flow** with feature branches:

```bash
# Always start from latest main
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/search-optimization

# Make changes, commit frequently
git add .
git commit -m "feat: optimize database query performance"

# Push to your fork
git push origin feature/search-optimization

# Create pull request on GitHub
```

### Commit Message Format

We follow the **Conventional Commits** specification:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks

**Examples:**

```bash
feat(search): add semantic search capability
fix(auth): resolve JWT token expiration issue
docs(api): update search endpoint documentation
test(services): add unit tests for SearchService
refactor(database): optimize connection pooling
```

### Branch Naming

| Type          | Format                 | Example                         |
| ------------- | ---------------------- | ------------------------------- |
| Feature       | `feature/description`  | `feature/ai-search-integration` |
| Bug Fix       | `fix/description`      | `fix/redis-connection-leak`     |
| Documentation | `docs/description`     | `docs/api-reference-update`     |
| Refactor      | `refactor/description` | `refactor/service-architecture` |

## Adding New Features

### Feature Development Process

1. **Planning & Design**
   - Create or reference GitHub issue
   - Design API endpoints if needed
   - Plan database schema changes
   - Consider performance implications

2. **Implementation Steps**
   - Add TypeScript types
   - Implement service layer
   - Add controller methods
   - Create API routes
   - Add middleware if needed
   - Write comprehensive tests

3. **Testing & Documentation**
   - Unit tests for new services
   - Integration tests for new endpoints
   - Update API documentation
   - Add usage examples

### Example: Adding a New Service

1. **Define TypeScript Interface**

```typescript
// src/types/index.ts
export interface IAnalyticsService {
  generateReport(userId: string, dateRange: DateRange): Promise<AnalyticsReport>;
  getUserMetrics(userId: string): Promise<UserMetrics>;
}

export interface AnalyticsReport {
  searchCount: number;
  averageResponseTime: number;
  popularQueries: string[];
  trends: TrendData[];
}
```

1. **Implement Service Class**

```typescript
// src/services/AnalyticsService.ts
import { IAnalyticsService } from '@/types';
import { logger } from '@/utils/logger';

export class AnalyticsService implements IAnalyticsService {
  constructor(
    private cacheService: CacheService,
    private databaseService: DatabaseService
  ) {}

  async generateReport(userId: string, dateRange: DateRange): Promise<AnalyticsReport> {
    try {
      logger.info(`Generating analytics report for user ${userId}`);

      // Implementation here
      const searchCount = await this.getSearchCount(userId, dateRange);
      const averageResponseTime = await this.getAverageResponseTime(userId, dateRange);

      return {
        searchCount,
        averageResponseTime,
        popularQueries: [],
        trends: [],
      };
    } catch (error) {
      logger.error('Failed to generate analytics report:', error);
      throw new AppError('ANALYTICS_ERROR', 'Failed to generate report');
    }
  }

  private async getSearchCount(userId: string, dateRange: DateRange): Promise<number> {
    // Implementation
    return 0;
  }
}
```

1. **Add Controller Methods**

```typescript
// src/controllers/AnalyticsController.ts
import { Request, Response } from 'express';
import { AnalyticsService } from '@/services/AnalyticsService';

export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  generateReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.user!;
      const { startDate, endDate } = req.query;

      const report = await this.analyticsService.generateReport(userId, {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      });

      res.json({
        success: true,
        data: report,
        meta: {
          timestamp: new Date(),
          requestId: req.id,
        },
      });
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  };
}
```

1. **Add API Routes**

```typescript
// src/routes/analytics.ts
import { Router } from 'express';
import { z } from 'zod';
import { AnalyticsController } from '@/controllers/AnalyticsController';
import { authenticateApiKey, requirePermission } from '@/middleware/apiKeyAuth';
import { validateRequest } from '@/middleware/validation';

const router = Router();
const analyticsController = new AnalyticsController();

const generateReportSchema = z.object({
  query: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  }),
});

router.get(
  '/report',
  authenticateApiKey,
  requirePermission('analytics'),
  validateRequest(generateReportSchema),
  analyticsController.generateReport
);

export default router;
```

1. **Write Tests**

```typescript
// src/services/AnalyticsService.test.ts
import { AnalyticsService } from './AnalyticsService';

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockCacheService = createMockCacheService();
    mockDatabaseService = createMockDatabaseService();

    analyticsService = new AnalyticsService(mockCacheService, mockDatabaseService);
  });

  describe('generateReport', () => {
    it('should generate analytics report successfully', async () => {
      const report = await analyticsService.generateReport('user1', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(report).toBeDefined();
      expect(report.searchCount).toBeGreaterThanOrEqual(0);
    });
  });
});
```

## Debugging

### Development Debugging

**VS Code Launch Configuration:**

```json
// .vscode/launch.json
{
  "version": "0.2.1",
  "configurations": [
    {
      "name": "Launch Development Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/index.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      },
      "runtimeArgs": ["-r", "ts-node/register"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "env": {
        "NODE_ENV": "test"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

**Debug Commands:**

```bash
# Debug with Node.js inspector
node --inspect-brk src/index.ts

# Debug specific service
node --inspect-brk -r ts-node/register src/services/SearchService.ts

# Debug tests
node --inspect-brk node_modules/.bin/jest --runInBand

# Debug with Chrome DevTools
node --inspect src/index.ts
# Then open chrome://inspect
```

### Logging Strategy

Use structured logging for debugging:

```typescript
import { logger } from '@/utils/logger';

// Different log levels
logger.debug('Detailed debugging info');
logger.info('General information');
logger.warn('Warning conditions');
logger.error('Error conditions');

// Structured logging with context
logger.info('User search request', {
  userId: 'user123',
  query: 'database optimization',
  searchMode: 'semantic',
  duration: 150,
});

// Error logging with stack trace
try {
  // Some operation
} catch (error) {
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    context: { userId, requestId },
  });
}
```

## Performance Considerations

### Database Optimization

1. **Use Connection Pooling**

```typescript
// Proper connection management
export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: config.database.host,
      connectionLimit: 10,
      acquireTimeout: 60000,
      timeout: 60000,
    });
  }
}
```

1. **Optimize Queries**

```typescript
// Use prepared statements
const query = 'SELECT * FROM users WHERE id = ? AND status = ?';
const [rows] = await connection.execute(query, [userId, 'active']);

// Avoid SELECT *
const query = 'SELECT id, name, email FROM users WHERE id = ?';

// Use appropriate indexes
// CREATE INDEX idx_user_email ON users(email);
// CREATE FULLTEXT INDEX idx_content_search ON articles(title, content);
```

1. **Implement Caching Strategies**

```typescript
// Multi-level caching
async getCachedData(key: string): Promise<any> {
  // L1: In-memory cache
  let data = this.memoryCache.get(key);
  if (data) return data;

  // L2: Redis cache
  data = await this.redisCache.get(key);
  if (data) {
    this.memoryCache.set(key, data, 60); // 1 minute TTL
    return data;
  }

  // L3: Database
  data = await this.database.query(key);
  await this.redisCache.set(key, data, 300); // 5 minute TTL
  this.memoryCache.set(key, data, 60);

  return data;
}
```

### Memory Management

1. **Avoid Memory Leaks**

```typescript
// Properly close connections
async cleanup(): Promise<void> {
  await this.databasePool.end();
  await this.redisClient.quit();
  this.eventEmitter.removeAllListeners();
}

// Use weak references for caches
const cache = new WeakMap();

// Clean up timers
const timer = setInterval(() => {}, 1000);
clearInterval(timer);
```

1. **Monitor Memory Usage**

```typescript
// Memory usage monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  logger.info('Memory usage', {
    rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
  });
}, 60000); // Every minute
```

## Error Handling

### Custom Error Classes

```typescript
// src/utils/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}
```

### Error Handling Patterns

```typescript
// Service layer error handling
export class SearchService {
  async search(request: SearchRequest): Promise<SearchResponse> {
    try {
      // Validate input
      if (!request.query?.trim()) {
        throw new ValidationError('Search query cannot be empty');
      }

      // Perform search
      const results = await this.executeSearch(request);
      return results;
    } catch (error) {
      if (error instanceof AppError) {
        throw error; // Re-throw known errors
      }

      // Log unexpected errors
      logger.error('Unexpected search error:', error);
      throw new AppError('SEARCH_FAILED', 'Search operation failed');
    }
  }
}

// Controller error handling (let middleware handle)
export class SearchController {
  search = async (req: Request, res: Response): Promise<void> => {
    const results = await this.searchService.search(req.body);
    res.json({ success: true, data: results });
    // Don't catch errors here - let error middleware handle them
  };
}
```

## Security Best Practices

### Input Validation

```typescript
// Always validate input with Zod schemas
const searchSchema = z.object({
  query: z.string().min(1).max(1000),
  databases: z.array(z.string().uuid()),
  searchMode: z.enum(['natural', 'boolean', 'semantic']).default('natural'),
  limit: z.number().min(1).max(100).default(20),
});

// Use in middleware
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      req.body = validated.body || req.body;
      req.query = validated.query || req.query;
      req.params = validated.params || req.params;

      next();
    } catch (error) {
      throw new ValidationError('Invalid request data', error.errors);
    }
  };
};
```

### SQL Injection Prevention

```typescript
// Always use parameterized queries
const query = `
  SELECT id, title, content
  FROM articles
  WHERE MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE)
  AND category = ?
  LIMIT ?
`;

const [rows] = await connection.execute(query, [searchTerm, category, limit]);

// Never concatenate user input
// BAD: `SELECT * FROM users WHERE id = ${userId}`
// GOOD: Use parameterized queries as shown above
```

### Authentication & Authorization

```typescript
// API key authentication
export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AppError('NO_API_KEY', 'Authorization header missing', 401);
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AppError(
        'INVALID_AUTH_FORMAT',
        'Authorization header must be in format: Bearer <api_key>',
        401
      );
    }

    const apiKey = parts[1];
    if (!apiKey.startsWith('altus4_sk_')) {
      throw new AppError('INVALID_API_KEY_FORMAT', 'API key must start with altus4_sk_', 401);
    }

    const result = await apiKeyService.validateApiKey(apiKey);
    if (!result) {
      throw new AppError('INVALID_API_KEY', 'Invalid or expired API key', 401);
    }

    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    await apiKeyService.updateLastUsedIp(result.apiKey.id, clientIp);

    req.user = result.user;
    req.apiKey = result.apiKey;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('AUTH_ERROR', 'Authentication failed', 401);
  }
};

// Permission-based authorization for API keys
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    if (!req.apiKey.permissions.includes(permission)) {
      throw new AppError('INSUFFICIENT_PERMISSIONS', `Permission '${permission}' required`, 403, {
        required: permission,
        available: req.apiKey.permissions,
      });
    }
    next();
  };
};

// Role-based authorization
export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    if (req.user.role !== 'admin' && req.user.role !== role) {
      throw new AppError('FORBIDDEN', `${role} role required`, 403, {
        required: role,
        current: req.user.role,
      });
    }
    next();
  };
};
```

## Testing Guidelines

### Test Structure

```typescript
describe('ServiceName', () => {
  // Setup and teardown
  beforeEach(() => {
    // Initialize test environment
  });

  afterEach(() => {
    // Clean up after each test
  });

  describe('methodName', () => {
    it('should handle success case correctly', async () => {
      // Arrange
      const input = {
        /* test data */
      };
      const expected = {
        /* expected result */
      };

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(result).toEqual(expected);
    });

    it('should handle error case gracefully', async () => {
      // Arrange
      const invalidInput = {
        /* invalid data */
      };

      // Act & Assert
      await expect(service.methodName(invalidInput)).rejects.toThrow('Expected error message');
    });
  });
});
```

### Mocking External Dependencies

```typescript
// Mock external services
jest.mock('@/services/AIService');
jest.mock('openai');

// Create typed mocks
const mockAIService = {
  isAvailable: jest.fn(),
  processSearchQuery: jest.fn(),
} as jest.Mocked<AIService>;

// Mock with implementation
mockAIService.processSearchQuery.mockImplementation(async query => {
  return { optimizedQuery: query, confidence: 0.95 };
});
```

## Documentation Standards

### Code Documentation

````typescript
/**
 * Executes a search across multiple databases with AI enhancements
 *
 * @param request - Search request containing query, databases, and options
 * @returns Promise resolving to search results with metadata
 *
 * @throws {ValidationError} When search query is invalid
 * @throws {AppError} When search operation fails
 *
 * @example
 * ```typescript
 * const results = await searchService.search({
 *   query: 'database optimization',
 *   databases: ['db-1', 'db-2'],
 *   searchMode: 'semantic',
 *   limit: 20
 * });
 * ```
 */
async search(request: SearchRequest): Promise<SearchResponse> {
  // Implementation
}
````

### API Documentation

Update OpenAPI specification for new endpoints:

```yaml
# In openapi.yaml
/api/search:
  post:
    summary: Execute search across databases
    description: |
      Performs a comprehensive search across specified databases with optional
      AI enhancements for improved relevance and categorization.
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/SearchRequest'
    responses:
      200:
        description: Search completed successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SearchResponse'
```

## Pull Request Process

### Before Submitting

1. **Code Quality Checklist**
   - [ ] Code follows style guidelines
   - [ ] All tests pass
   - [ ] Test coverage meets requirements
   - [ ] No linting errors
   - [ ] Documentation updated

2. **Testing Checklist**
   - [ ] Unit tests for new functionality
   - [ ] Integration tests for new endpoints
   - [ ] Manual testing completed
   - [ ] Edge cases considered

3. **Documentation Checklist**
   - [ ] Code comments added
   - [ ] API documentation updated
   - [ ] README updated if needed
   - [ ] Migration guide if breaking changes

### Pull Request Template

```markdown
## Description

Brief description of changes made.

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No merge conflicts
```

### Review Process

1. **Automated Checks** - CI pipeline runs tests and linting
2. **Peer Review** - At least one team member reviews the code
3. **Integration Testing** - Changes tested in staging environment
4. **Approval** - Maintainer approves and merges

## Release Process

### Semantic Versioning

We follow [SemVer](https://semver.org/):

- **MAJOR**: Breaking changes (1.0.0 → 2.0.0)
- **MINOR**: New features (1.0.0 → 1.1.0)
- **PATCH**: Bug fixes (1.0.0 → 1.0.1)

### Release Workflow

```bash
# Create release branch
git checkout -b release/v1.2.0

# Update version numbers
npm version 1.2.0

# Update CHANGELOG.md
# Run final tests
npm run test:all

# Merge to main
git checkout main
git merge release/v1.2.0

# Tag release
git tag v1.2.0
git push origin v1.2.0

# Deploy to production
npm run deploy:production
```

## Community & Support

### Getting Help

- **Documentation**: Start with this guide and API docs
- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share ideas
- **Discord**: Real-time community chat (link in README)

### Contributing Guidelines

- Follow the code style and conventions
- Write comprehensive tests
- Update documentation
- Be respectful and constructive
- Help others in the community

---

**Thank you for contributing to Altus 4! Your efforts help make MySQL search intelligent and accessible for everyone.**
