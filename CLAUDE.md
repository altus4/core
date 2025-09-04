# Altus 4 - AI-Enhanced MySQL Full-Text Search Engine

## Project Overview

Altus 4 is an intelligent search-as-a-service platform that leverages MySQL's built-in full-text search capabilities while adding AI-powered optimizations and enhancements. Users can connect their existing MySQL databases to Altus 4, which then provides enhanced search capabilities with semantic understanding, query optimization, and trend analysis.

## Core Value Proposition

Instead of requiring users to migrate to specialized search solutions like Elasticsearch or Solr, Altus 4 enhances MySQL's native `FULLTEXT` search with:

- AI-powered query optimization and semantic search

```text
src/
├── config/          # Configuration management and validation
├── controllers/     # Route controllers with business logic
├── middleware/      # Express middleware (auth, validation, rate limiting)
├── routes/         # API route definitions with Zod validation
├── services/       # Core business logic services
├── types/          # TypeScript interface and type definitions
├── utils/          # Utility functions (logging, encryption, etc.)
```

- Natural language query processing
- Intelligent result categorization and insights
- Performance monitoring and optimization suggestions
- Multi-database federation capabilities

## Technology Stack

- **Backend**: Node.js with TypeScript
- **Framework**: Express.js with comprehensive middleware stack
- **Database**: MySQL 8.0+ (for client databases and metadata storage)
- **Cache**: Redis (for performance optimization and analytics)
- **AI Integration**: OpenAI API (GPT models for semantic enhancement)
- **Authentication**: API key-based with SHA-256 hashing and bcrypt password hashing for user accounts
- **Validation**: Zod schemas for request/response validation
- **Logging**: Winston with structured logging
- **Development**: ESLint, Prettier, Jest for testing

## Project Architecture

### Four Core Layers

1. **Database Integration Layer**: Secure multi-tenant MySQL connection management
2. **Search Engine Core**: MySQL FULLTEXT optimization and query execution
3. **AI Enhancement Layer**: Semantic search, categorization, and optimization suggestions
4. **API Layer**: RESTful endpoints with authentication and rate limiting

### Key Services

- `DatabaseService`: Multi-tenant MySQL connection pooling with health monitoring, schema discovery, and secure credential management
- `SearchService`: Core search orchestration with natural language processing, result ranking, and multi-database federation
- `AIService`: OpenAI GPT integration for semantic search, query optimization, and result categorization
- `CacheService`: Redis-based caching for search results, user sessions, and analytics data storage
- `UserService`: User account management with bcrypt password hashing and role-based access control
- `ApiKeyService`: API key lifecycle management with tiered permissions (free/pro/enterprise)

## Development Guidelines

### Code Conventions

- **TypeScript**: Strict mode enabled with comprehensive type definitions
- **Naming**: camelCase for variables/functions, PascalCase for classes/interfaces
- **Async/Await**: Preferred over Promises for better readability
- **Error Handling**: Custom AppError class with proper error codes
- **Logging**: Structured logging with appropriate levels (info, warn, error)

### File Organization

```text
src/
├── config/          # Configuration management and validation
├── controllers/     # Route controllers with business logic
├── middleware/      # Express middleware (auth, validation, rate limiting)
├── routes/         # API route definitions with Zod validation
├── services/       # Core business logic services
├── types/          # TypeScript interface and type definitions
├── utils/          # Utility functions (logging, encryption, etc.)
└── index.ts        # Application entry point
```

### Testing Strategy

- **Unit Tests**: Jest for service and utility functions
- **Integration Tests**: API endpoint testing with test database
- **Test Files**: Co-located with source files using `.test.ts` suffix
- **Coverage**: Aim for 80%+ code coverage on core services

## Key Features & Functionality

### Database Management

- Secure credential encryption for client database connections
- Connection pooling with configurable limits and timeouts
- Automatic schema discovery and FULLTEXT index detection
- Connection health monitoring and reconnection logic

### Search Capabilities

- Natural language, boolean, and semantic search modes
- Multi-database and multi-table search federation
- Intelligent result ranking and relevance scoring
- Auto-generated search suggestions and query corrections

### AI Enhancements

- Query optimization recommendations using AI analysis
- Semantic search using embeddings for concept matching
- Automatic result categorization and tagging
- Trend analysis and search pattern insights

### Performance & Security

- Redis caching for frequently accessed data and search results
- Rate limiting with IP-based throttling
- API key authentication with role-based access control and permission scoping
- SQL injection prevention and input sanitization

## Environment Setup

### Required Environment Variables

```bash
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_USERNAME=altus4_user
DB_PASSWORD=secure_password
DB_DATABASE=altus4_metadata
JWT_SECRET=minimum_32_character_secret_key  # For legacy endpoints only
REDIS_HOST=localhost
REDIS_PORT=6379
OPENAI_API_KEY=sk-your_openai_key
```

### Development Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run test` - Run test suite with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Auto-fix linting issues

### Service Implementation Details

#### DatabaseService (src/services/database.service.ts)

- **Connection Pooling**: Configurable pool sizes with automatic reconnection and health checks
- **Multi-tenant Support**: Isolated connection pools per user database
- **Schema Discovery**: Automatic detection of FULLTEXT indexes and searchable columns
- **Security**: AES-256 encryption for stored database credentials
- **Error Handling**: Comprehensive connection failure recovery and circuit breaker patterns

#### SearchService (src/services/search.service.ts)

- **Search Modes**: Natural language, boolean (`+word -word`), and semantic search
- **Result Processing**: Relevance scoring, deduplication, and pagination
- **Multi-Database Federation**: Parallel searches across multiple user databases
- **Performance**: Query caching and result optimization with Redis
- **Analytics**: Search pattern analysis and trend detection

#### AIService (src/services/ai.service.ts)

- **OpenAI Integration**: GPT-4 for query understanding and result enhancement
- **Semantic Search**: Text embedding generation and similarity matching
- **Query Optimization**: AI-powered suggestions for improving search queries
- **Result Categorization**: Automatic tagging and classification of search results
- **Fallback Handling**: Graceful degradation when AI services are unavailable

#### CacheService (src/services/cache.service.ts)

- **Search Result Caching**: Configurable TTL for frequently accessed queries
- **Session Management**: User session storage and API key validation caching
- **Analytics Storage**: Real-time metrics and search trend data
- **Performance Monitoring**: Cache hit/miss ratios and optimization recommendations
- **Data Consistency**: Cache invalidation strategies for updated search results

#### UserService (src/services/user.service.ts)

- **Account Management**: Registration, login, profile updates with audit logging
- **Password Security**: bcrypt hashing with configurable salt rounds
- **Role-Based Access**: User roles with granular permissions
- **Account Verification**: Email verification and password reset workflows
- **Security Features**: Login attempt tracking and account lockout protection

#### ApiKeyService (src/services/apikey.service.ts)

- **Key Generation**: Cryptographically secure API key generation with SHA-256 hashing
- **Tiered Permissions**: Free (100 req/day), Pro (10k req/day), Enterprise (unlimited)
- **Usage Tracking**: Real-time monitoring of API key usage and quota enforcement
- **Key Management**: Create, update, revoke, and rotate API keys
- **Security**: Rate limiting, IP allowlists, and permission scoping

### Middleware Stack Details

#### Authentication Middleware (src/middleware/auth.middleware.ts)

- **API Key Validation**: SHA-256 hash verification with database lookup
- **Request Context**: User and API key information injection into request objects
- **Error Handling**: Standardized authentication error responses
- **Performance**: Redis caching for API key validation

#### Rate Limiting Middleware (src/middleware/rate-limit.middleware.ts)

- **Sliding Window**: Redis-based sliding window rate limiting
- **Tiered Limits**: Different limits per API key tier (free/pro/enterprise)
- **IP-based Limiting**: Additional protection against abuse
- **Custom Headers**: Rate limit status in response headers

#### Validation Middleware (src/middleware/validation.middleware.ts)

- **Zod Integration**: Runtime type validation for all API endpoints
- **Request Sanitization**: SQL injection prevention and input cleaning
- **Response Validation**: Ensures API responses match expected schemas
- **Error Formatting**: Consistent validation error responses

#### Logging Middleware (src/middleware/logging.middleware.ts)

- **Structured Logging**: JSON format with Winston logger integration
- **Request Tracing**: Unique request IDs for distributed tracing
- **Performance Metrics**: Request duration and resource usage logging
- **Error Context**: Detailed error information with stack traces

### Database Schema & Models

#### Core Tables

- **users**: User accounts with encrypted credentials and role information
- **api_keys**: API key storage with hashed values and permission metadata
- **databases**: User database connection configurations (encrypted credentials)
- **search_history**: Search query logs with performance metrics
- **analytics**: Aggregated search trends and usage statistics

#### MySQL Full-Text Search Integration

- **FULLTEXT Indexes**: Automatic detection and optimization of existing indexes
- **Search Modes**: NATURAL LANGUAGE, BOOLEAN, and QUERY EXPANSION support
- **Performance Optimization**: Query hint injection and index usage analysis
- **Result Relevance**: MySQL relevance scoring with custom ranking algorithms

### Error Handling Patterns

#### AppError Class (src/utils/app-error.ts)

- **Structured Errors**: Consistent error format with HTTP status codes
- **Error Categories**: Authentication, validation, database, and external service errors
- **Error Logging**: Automatic error logging with context and stack traces
- **Client-Safe Messages**: Sanitized error messages for API responses

#### Global Error Handler (src/middleware/error.middleware.ts)

- **Centralized Handling**: Single point for all application error processing
- **Environment-Aware**: Different error detail levels for development vs production
- **Error Recovery**: Automatic retry logic for transient failures
- **Monitoring Integration**: Error metrics collection for alerting systems

### Performance & Optimization

#### Caching Strategy

- **Multi-Level Caching**: Application-level (Redis) and database query caching
- **Cache Keys**: Structured naming convention for easy invalidation
- **TTL Management**: Intelligent expiration based on data volatility
- **Cache Warming**: Proactive caching of frequently accessed data

#### Database Optimization

- **Connection Pooling**: Configurable pool sizes per database connection
- **Query Optimization**: EXPLAIN plan analysis and index recommendations
- **Batch Operations**: Bulk insert/update operations for analytics data
- **Read Replicas**: Support for read-only database replicas (future enhancement)

#### API Performance

- **Response Compression**: Gzip compression for JSON responses
- **Pagination**: Cursor-based pagination for large result sets
- **Field Selection**: GraphQL-style field selection for reduced payload sizes
- **Response Caching**: HTTP cache headers for cacheable responses

## API Endpoints

### Authentication

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login with JWT token (for API key creation only)
- `POST /api/v1/management/setup` - Create initial API key using JWT authentication
- `POST /api/v1/api-keys` - Create new API keys
- `GET /api/v1/api-keys` - List API keys
- `PUT /api/v1/api-keys/:keyId` - Update API key
- `DELETE /api/v1/api-keys/:keyId` - Revoke API key

### Search Operations

- `POST /api/v1/search` - Execute search across databases
- `GET /api/v1/search/suggestions` - Get search suggestions
- `POST /api/v1/search/analyze` - Analyze query performance
- `GET /api/v1/search/trends` - Get user search trends
- `GET /api/v1/search/history` - Get search history

### Database Management

- `POST /api/v1/databases` - Add database connection
- `GET /api/v1/databases` - List user's database connections
- `PUT /api/v1/databases/:id` - Update database connection
- `DELETE /api/v1/databases/:id` - Remove database connection
- `GET /api/v1/databases/:id/schema` - Discover database schema

## Instructions for Claude

### When Working on This Project

1. **Type Safety**: Always use TypeScript types from `src/types/index.ts`. Create new types when needed.

2. **Error Handling**: Use the `AppError` class for application errors with appropriate HTTP status codes and error codes.

3. **Database Operations**:
   - Use connection pooling through `DatabaseService`
   - Always release connections after use
   - Handle connection failures gracefully

4. **Authentication**:
   - Protect all routes except auth endpoints with `authenticate` middleware
   - Use `AuthenticatedRequest` interface for authenticated routes
   - Include user context in all operations

5. **Validation**:
   - Use Zod schemas for all API input validation
   - Validate environment variables on startup
   - Sanitize database inputs to prevent SQL injection

6. **Logging**:
   - Use structured logging with relevant context
   - Log errors with stack traces
   - Include request IDs for traceability

7. **Performance**:
   - Cache frequently accessed data in Redis
   - Use database indexes effectively
   - Implement proper pagination for large result sets

8. **AI Integration**:
   - Handle OpenAI API failures gracefully
   - Implement fallbacks when AI services are unavailable
   - Cache AI responses when appropriate

### Code Quality Standards

- Write comprehensive JSDoc comments for public functions
- Include error handling in all async operations
- Use descriptive variable names and function names
- Follow the established patterns in existing code
- Write tests for new functionality
- Ensure all new code passes linting and type checking

### When Adding New Features

1. Update relevant TypeScript interfaces
2. Add appropriate validation schemas
3. Implement error handling and logging
4. Update API documentation
5. Add tests for the new functionality
6. Consider caching implications
7. Update this CLAUDE.md if architectural changes are made

### Analytics & Insights

- `POST /api/v1/analytics/dashboard` - Get dashboard data with metrics
- `GET /api/v1/analytics/trends` - Get search trends and patterns
- `GET /api/v1/analytics/performance` - Get performance metrics
- `GET /api/v1/analytics/insights` - Get AI-generated insights

### Health & Monitoring

- `GET /health` - Health check endpoint
- `GET /api/v1/status` - Detailed system status
- `GET /api/v1/metrics` - Prometheus-compatible metrics

## Testing Strategy & Patterns

### Test Structure

- **Unit Tests**: Service layer testing with mocked dependencies
- **Integration Tests**: API endpoint testing with test database
- **Performance Tests**: Load testing for search operations
- **Security Tests**: Authentication and authorization testing

### Test Utilities (tests/helpers/)

- **Database Fixtures**: Reusable test data and database setup
- **Mock Services**: Mocked external dependencies (OpenAI, Redis)
- **API Helpers**: Common request/response assertion utilities
- **Performance Benchmarks**: Baseline performance metrics for regression testing

### Test Configuration

- **Separate Test Environment**: Isolated test database and Redis instance
- **Test Data Management**: Automatic cleanup and data isolation
- **Parallel Execution**: Jest configuration for concurrent test execution
- **Coverage Reporting**: Comprehensive code coverage with threshold enforcement

## Deployment & DevOps

### Environment Configuration

- **Multi-Environment Support**: Development, staging, production configurations
- **Secret Management**: Environment variable validation and secure storage
- **Configuration Validation**: Zod schemas for environment variable validation
- **Feature Flags**: Environment-based feature toggles

### Docker Configuration

- **Multi-Stage Builds**: Optimized production Docker images
- **Health Checks**: Container health monitoring
- **Resource Limits**: CPU and memory constraints for containers
- **Security**: Non-root user execution and minimal attack surface

### Monitoring & Observability

- **Prometheus Metrics**: Custom metrics for business and system monitoring
- **Structured Logging**: JSON logs with request tracing
- **Health Checks**: Comprehensive system health monitoring
- **Performance Monitoring**: Response time and resource usage tracking

### Security Considerations

- **API Key Management**: Secure generation, storage, and validation
- **Database Security**: Connection encryption and credential protection
- **Input Validation**: Comprehensive input sanitization and validation
- **Rate Limiting**: Multi-tier rate limiting with abuse protection
- **HTTPS Enforcement**: TLS termination and secure communication

## Current Development Status

### ✅ Completed

- **Core Architecture**: TypeScript setup, Express server, middleware stack
- **Service Layer**: All five core services implemented with comprehensive functionality
- **Database Integration**: MySQL connection pooling, schema discovery, health monitoring
- **Authentication System**: API key-based auth with tiered permissions
- **Search Engine**: Natural language, boolean, and semantic search capabilities
- **AI Integration**: OpenAI GPT integration for query optimization and result enhancement
- **Caching Layer**: Redis integration for performance optimization
- **API Endpoints**: Complete RESTful API with validation and error handling
- **Security Features**: Rate limiting, input validation, secure credential storage
- **Documentation**: Comprehensive VitePress documentation with API reference
- **Deployment Guides**: Production deployment, Docker containerization, monitoring setup

### 🚧 In Progress

- **Testing Suite**: Expanding unit and integration test coverage
- **Performance Optimization**: Query optimization and caching enhancements
- **Analytics Dashboard**: Real-time metrics and insights visualization
- **Documentation**: Examples and tutorials for developers

### 📋 Next Steps

1. **Complete Test Coverage**: Achieve 90%+ test coverage across all services
2. **Performance Benchmarking**: Establish baseline performance metrics
3. **Real-time Analytics**: Implement WebSocket-based real-time dashboard
4. **Advanced AI Features**: Query suggestion improvements and result categorization
5. **Horizontal Scaling**: Database sharding and microservice architecture
6. **Enterprise Features**: Advanced permissions, audit logging, compliance tools

## Development Workflows

### Git Workflow

- **Branch Strategy**: Feature branches with pull request reviews
- **Commit Conventions**: Conventional commits with semantic versioning
- **Pre-commit Hooks**: Automated linting, formatting, and testing
- **Code Review**: Required reviews for all changes to main branch

### CI/CD Pipeline

- **Automated Testing**: Full test suite execution on all pull requests
- **Code Quality**: ESLint, Prettier, and TypeScript checks
- **Security Scanning**: Dependency vulnerability scanning
- **Deployment**: Automated deployment to staging and production

### Development Tools

- **TypeScript**: Strict mode with comprehensive type definitions
- **ESLint**: Airbnb configuration with custom rules
- **Prettier**: Consistent code formatting
- **Jest**: Testing framework with coverage reporting
- **Docker**: Containerization for development and production
- **VS Code**: Recommended extensions and settings

## Troubleshooting Guide

### Common Issues

- **Connection Timeouts**: Database connection pool exhaustion
- **Memory Leaks**: Unclosed database connections or Redis clients
- **API Rate Limiting**: Exceeded rate limits for API keys
- **Search Performance**: Missing FULLTEXT indexes on client databases
- **AI Service Failures**: OpenAI API rate limiting or service unavailability

### Debugging Tools

- **Logging**: Winston structured logging with request tracing
- **Health Checks**: Comprehensive system health monitoring
- **Metrics**: Prometheus metrics for system observability
- **Database Monitoring**: Connection pool status and query performance
- **Redis Monitoring**: Cache hit ratios and memory usage

### Performance Monitoring

- **Response Times**: P95 and P99 response time tracking
- **Database Performance**: Query execution time and connection usage
- **Cache Performance**: Hit/miss ratios and eviction patterns
- **Memory Usage**: Application memory consumption and garbage collection
- **Error Rates**: Application error frequency and categorization

## Important Notes

### Security Guidelines

- **Credential Storage**: Never commit API keys, database passwords, or secrets
- **Environment Variables**: Use `.env` files for local development only
- **Database Access**: Always use parameterized queries to prevent SQL injection
- **API Security**: Implement proper authentication and rate limiting
- **Data Encryption**: Encrypt sensitive data at rest and in transit

### Performance Considerations

- **Connection Pooling**: Monitor database connection usage and implement circuit breakers
- **Caching Strategy**: Implement multi-level caching for frequently accessed data
- **Query Optimization**: Use EXPLAIN plans and database indexes effectively
- **Resource Limits**: Set appropriate memory and CPU limits for containers
- **Horizontal Scaling**: Design stateless services for horizontal scaling

### Code Quality Standards

- **Type Safety**: Use strict TypeScript with comprehensive type definitions
- **Error Handling**: Implement comprehensive error handling with proper logging
- **Testing**: Maintain high test coverage with unit and integration tests
- **Documentation**: Keep code documentation and API docs up to date
- **Style Consistency**: Follow established code patterns and conventions

### Monitoring & Alerting

- **Health Checks**: Implement comprehensive health monitoring
- **Metrics Collection**: Use Prometheus for system and business metrics
- **Log Aggregation**: Centralized logging with structured JSON format
- **Error Tracking**: Comprehensive error monitoring and alerting
- **Performance Monitoring**: Track response times and resource usage
