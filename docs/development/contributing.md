---
title: Contributing Guide
description: Complete guide for contributing to Altus 4 including development setup, workflow, and submission guidelines.
---

# Contributing Guide

Welcome to Altus 4 Development

Thank you for your interest in contributing to Altus 4! This guide will help you get started with contributing code, documentation, or other improvements to the project.

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js 18+** with npm 8+
- **MySQL 8.0+** for database operations
- **Redis 6.0+** for caching
- **Git** for version control
- **IDE** with TypeScript support (VS Code recommended)

### Development Environment Setup

1. **Fork the Repository**

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/altus4.git
cd altus4

# Add upstream remote
git remote add upstream https://github.com/altus4/core.git
```

2. **Install Dependencies**

```bash
# Install project dependencies
npm install

# Install development tools globally (optional)
npm install -g typescript ts-node nodemon
```

3. **Environment Configuration**

```bash
# Copy environment template
cp .env.example .env.development

# Configure your development environment
# Edit .env.development with your local settings
```

4. **Database Setup**

```bash
# Create development database
mysql -u root -p -e "CREATE DATABASE altus4_dev;"
mysql -u root -p -e "CREATE USER 'altus4_dev'@'localhost' IDENTIFIED BY 'dev_password';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON altus4_dev.* TO 'altus4_dev'@'localhost';"

# Run migrations
npm run migrate:dev
```

5. **Verify Setup**

```bash
# Run tests to ensure everything is working
npm test

# Start development server
npm run dev

# Check health endpoint
curl http://localhost:3000/health
```

## Development Workflow

### Branch Strategy

We use **GitFlow** with the following branch structure:

- **`main`** - Production-ready code
- **`develop`** - Integration branch for features
- **`feature/*`** - Feature development branches
- **`hotfix/*`** - Critical production fixes
- **`release/*`** - Release preparation branches

### Creating a Feature Branch

```bash
# Ensure you're on develop and up to date
git checkout develop
git pull upstream develop

# Create and checkout feature branch
git checkout -b feature/your-feature-name

# Make your changes and commit
git add .
git commit -m "feat(search): add semantic search functionality"

# Push to your fork
git push origin feature/your-feature-name
```

### Commit Message Format

We follow **Conventional Commits** specification:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes
- `perf`: Performance improvements
- `ci`: CI/CD changes

**Examples:**

```bash
feat(search): add AI-powered semantic search mode
fix(auth): resolve API key validation issue
docs(api): update search endpoint documentation
test(services): add unit tests for SearchService
refactor(database): improve connection pool management
```

### Code Quality Standards

#### TypeScript Guidelines

```typescript
// Use explicit types for public APIs
interface SearchRequest {
  query: string;
  databases: string[];
  searchMode?: 'natural' | 'boolean' | 'semantic';
  limit?: number;
}

// Use proper error handling
export class SearchService {
  async search(request: SearchRequest): Promise<SearchResponse> {
    try {
      // Validate input
      this.validateRequest(request);

      // Execute search
      const results = await this.executeSearch(request);

      return { success: true, data: results };
    } catch (error) {
      this.logger.error('Search failed', { request, error });
      throw new AppError('Search operation failed', 500);
    }
  }
}

// Use descriptive naming
const isValidQuery = (query: string): boolean => {
  return query.trim().length > 0 && query.length <= 1000;
};
```

#### Code Style

```typescript
// Use consistent formatting (Prettier handles this)
const searchResults = await searchService.search({
  query: 'mysql performance optimization',
  databases: ['tech-docs-db'],
  searchMode: 'semantic',
  limit: 20,
});

// Use meaningful variable names
const authenticatedUser = await userService.getUserById(userId);
const searchExecutionTime = Date.now() - startTime;

// Prefer async/await over Promises
// Good
async function fetchUserData(userId: string): Promise<User> {
  const user = await userRepository.findById(userId);
  const profile = await profileService.getProfile(userId);
  return { ...user, profile };
}

// Avoid
function fetchUserDataBad(userId: string): Promise<User> {
  return userRepository
    .findById(userId)
    .then(user => profileService.getProfile(userId).then(profile => ({ ...user, profile })));
}
```

### Testing Requirements

All contributions must include appropriate tests:

#### Unit Tests

```typescript
// tests/unit/services/SearchService.test.ts
describe('SearchService', () => {
  let searchService: SearchService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDatabaseService = createMockDatabaseService();
    searchService = new SearchService(mockDatabaseService);
  });

  it('should execute search with valid parameters', async () => {
    // Arrange
    const request = {
      query: 'test query',
      databases: ['db-1'],
      userId: 'user-1',
    };

    mockDatabaseService.executeFullTextSearch.mockResolvedValue([
      { id: 1, title: 'Test Result', content: 'Test content' },
    ]);

    // Act
    const result = await searchService.search(request);

    // Assert
    expect(result.results).toHaveLength(1);
    expect(result.results[0].data.title).toBe('Test Result');
  });
});
```

#### Integration Tests

```typescript
// tests/integration/api/search.test.ts
describe('Search API', () => {
  it('should return search results', async () => {
    const response = await request(app)
      .post('/api/v1/search')
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({
        query: 'mysql performance',
        databases: [testDatabaseId],
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.results).toBeInstanceOf(Array);
  });
});
```

### Documentation Requirements

#### Code Documentation

````typescript
/**
 * Execute a full-text search across specified databases with AI enhancements.
 *
 * @param request - The search request parameters
 * @param request.query - Search query string (1-1000 characters)
 * @param request.databases - Array of database IDs to search
 * @param request.searchMode - Search mode: 'natural', 'boolean', or 'semantic'
 * @param request.limit - Maximum results to return (1-100, default: 20)
 *
 * @returns Promise resolving to search results with metadata
 *
 * @throws {ValidationError} When request parameters are invalid
 * @throws {DatabaseError} When database operations fail
 *
 * @example
 * ```typescript
 * const results = await searchService.search({
 *   query: 'mysql optimization techniques',
 *   databases: ['tech-docs-db'],
 *   searchMode: 'semantic',
 *   limit: 25
 * })
 * ```
 */
async search(request: SearchRequest): Promise<SearchResponse> {
  // Implementation
}
````

#### API Documentation

Update API documentation when adding new endpoints:

````markdown
## Search Endpoint

Execute a search across connected databases.

**Endpoint**: `POST /api/v1/search`

**Request Body**:

```json
{
  "query": "mysql performance optimization",
  "databases": ["db-uuid-1"],
  "searchMode": "semantic",
  "limit": 20
}
```
````

**Response**:

```json
{
  "success": true,
  "data": {
    "results": [...],
    "totalCount": 42,
    "executionTime": 150
  }
}
```

````

## Pull Request Process

### Before Submitting

1. **Ensure Code Quality**

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Run all tests
npm test

# Check test coverage
npm run test:coverage
````

2. **Update Documentation**

- Update relevant documentation files
- Add JSDoc comments for new functions
- Update API documentation if applicable
- Add examples for new features

3. **Verify Changes**

```bash
# Build the project
npm run build

# Run integration tests
npm run test:integration

# Test manually if needed
npm run dev
```

### Submitting a Pull Request

1. **Create Pull Request**

- Go to your fork on GitHub
- Click "New Pull Request"
- Select `develop` as the base branch
- Provide a clear title and description

2. **Pull Request Template**

```markdown
## Description

Brief description of changes made.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass locally
- [ ] No new linting errors
```

3. **Review Process**

- Automated checks must pass (CI/CD)
- At least one maintainer review required
- Address review feedback promptly
- Keep PR up to date with develop branch

### Code Review Guidelines

#### For Contributors

- **Respond Promptly**: Address review feedback within 48 hours
- **Be Open to Feedback**: Consider suggestions constructively
- **Explain Decisions**: Provide context for implementation choices
- **Keep PRs Focused**: One feature/fix per PR
- **Update Documentation**: Ensure docs reflect changes

#### For Reviewers

- **Be Constructive**: Provide helpful, actionable feedback
- **Focus on Code Quality**: Check for bugs, performance, maintainability
- **Verify Tests**: Ensure adequate test coverage
- **Check Documentation**: Verify docs are updated
- **Consider Security**: Look for potential security issues

## Issue Reporting

### Bug Reports

Use the bug report template:

```markdown
**Bug Description**
Clear description of the bug.

**Steps to Reproduce**

1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior**
What you expected to happen.

**Actual Behavior**
What actually happened.

**Environment**

- OS: [e.g. macOS 12.0]
- Node.js version: [e.g. 18.17.0]
- Altus 4 version: [e.g. 0.2.1]

**Additional Context**
Any other context about the problem.
```

### Feature Requests

Use the feature request template:

```markdown
**Feature Description**
Clear description of the feature you'd like to see.

**Use Case**
Describe the problem this feature would solve.

**Proposed Solution**
Describe how you envision this feature working.

**Alternatives Considered**
Other solutions you've considered.

**Additional Context**
Any other context or screenshots.
```

## Development Guidelines

### Performance Considerations

```typescript
// Use efficient algorithms and data structures
const resultMap = new Map<string, SearchResult>();
for (const result of results) {
  resultMap.set(result.id, result);
}

// Avoid unnecessary database queries
const userIds = results.map(r => r.userId);
const users = await userService.getUsersByIds(userIds); // Batch query

// Use appropriate caching
const cacheKey = `search:${hash(request)}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;
```

### Security Best Practices

```typescript
// Always validate input
const validateSearchRequest = (request: SearchRequest): void => {
  if (!request.query?.trim()) {
    throw new ValidationError('Query is required');
  }

  if (request.query.length > 1000) {
    throw new ValidationError('Query too long');
  }

  // Check for SQL injection patterns
  const dangerousPatterns = [/union\s+select/i, /drop\s+table/i];
  if (dangerousPatterns.some(pattern => pattern.test(request.query))) {
    throw new ValidationError('Invalid query format');
  }
};

// Use parameterized queries
const results = await connection.execute(
  'SELECT * FROM articles WHERE MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE)',
  [query]
);

// Sanitize output
const sanitizeHtml = (text: string): string => {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
```

### Error Handling

```typescript
// Use specific error types
export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
}

// Provide helpful error messages
if (!databases.length) {
  throw new ValidationError('At least one database must be specified for search', 'databases');
}

// Log errors with context
this.logger.error('Search failed', {
  userId: request.userId,
  query: request.query,
  error: error.message,
  stack: error.stack,
});
```

## Community Guidelines

### Code of Conduct

We are committed to providing a welcoming and inclusive environment:

- **Be Respectful**: Treat everyone with respect and kindness
- **Be Inclusive**: Welcome newcomers and help them learn
- **Be Constructive**: Provide helpful feedback and suggestions
- **Be Professional**: Maintain professional communication
- **Be Patient**: Remember that everyone is learning

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Pull Requests**: Code review and collaboration
- **Documentation**: Contribute to docs and examples

### Recognition

Contributors are recognized through:

- **Contributors List**: Listed in README and documentation
- **Release Notes**: Contributions mentioned in release notes
- **Community Highlights**: Featured in community updates

## Getting Help

### Resources

- **[Development Guide](./index.md)** - Complete development setup
- **[Testing Guide](./testing.md)** - Testing strategies and examples
- **[Code Standards](./standards.md)** - Coding standards and best practices
- **[API Documentation](../api/)** - Complete API reference

### Support Channels

- **GitHub Issues**: Technical questions and bug reports
- **GitHub Discussions**: General questions and community support
- **Documentation**: Comprehensive guides and examples

### Mentorship

New contributors can:

- Look for "good first issue" labels
- Ask questions in GitHub Discussions
- Request code review feedback
- Participate in community discussions

---

**Thank you for contributing to Altus 4! Your contributions help make this project better for everyone. We appreciate your time and effort in improving the codebase, documentation, and community.**
