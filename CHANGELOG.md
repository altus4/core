# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- JSDoc docblocks and inline comments for the migrations CLI (`src/cli/index.ts`) to improve developer understanding of flags, commands, and edge cases. This change is documentation-only and does not modify runtime behavior.

### Quality

- Verified TypeScript typecheck, ESLint linting, and Prettier formatting after the documentation updates (`npm run check`).

### Changed

- README: corrected repository path (`cd core`), prefer `npm ci`, and updated required npm version to 10+
- README: standardized migration CLI usage to `./bin/altus` (deprecated `./bin/migrate` references removed)
- README: fixed health checks section (removed non-existent `/health/db` and `/health/redis` endpoints; pointed to `/health`)
- README: adjusted Docker notes to clarify no app Dockerfile is present; recommend `npm run dev:start|stop|reset` for local MySQL/Redis
- README: updated link to CLI docs (`docs/cli.md`)
- README: updated health response example version to `0.3.0`
- Package metadata: set `license` to `Apache-2.0` to match LICENSE file
- README: corrected authentication columns for `/api/v1/keys/*` and `/api/v1/databases/*` (require JWT for management endpoints)

### Housekeeping

- Relabeled the later `0.3.0` entry as `0.3.1` to resolve duplication.

---

## [0.3.1] - 2025-09-09

### Added

#### **External API Timeout Management**

- **ExternalProxy base class** - Abstract proxy pattern with encapsulated timeout handling for all external API services
- **OpenAIProxy service** - Dedicated proxy for OpenAI API calls with automatic timeout configuration and error handling
- **TimeoutError class** - Custom error handling for API timeout scenarios with detailed timeout information
- **Configurable timeout settings** - OpenAI timeout configuration through environment variables and service configuration
- **Comprehensive timeout testing** - Full test coverage for timeout scenarios and proxy functionality

#### **Configuration System Enhancements**

- **Helper functions** - `parseIntWithDefault()`, `getJwtMinLength()`, `isValidPort()`, and `isValidEnvironment()` for robust configuration parsing
- **Environment validation improvements** - Enhanced validation for non-test environments with proper error handling
- **Test environment handling** - Improved test configuration with sensible defaults and environment-specific behavior
- **Configuration test coverage** - Comprehensive validation tests for all configuration scenarios and edge cases

#### **Complete Documentation Suite**

- **VitePress documentation framework** - Full documentation site with custom theming and navigation
- **Comprehensive API documentation** - Detailed endpoint documentation for analytics, authentication, database, search, and more
- **Architecture guides** - In-depth documentation for database, security, services, and system architecture
- **Deployment guides** - Complete deployment documentation for Docker, local, production, monitoring, and scaling
- **Development guides** - Contributing guidelines, Git workflow, standards, and testing documentation
- **Example documentation** - Practical examples for basic search, advanced queries, AI integration, and multi-database usage
- **Service documentation** - Detailed documentation for all core services (AI, API Key, Cache, Database, Search, User)
- **Testing documentation** - Comprehensive testing guides for unit, integration, and performance testing

### Changed

#### **Service Architecture Improvements**

- **AIService refactoring** - Updated to use new OpenAIProxy pattern for better timeout handling and error management
- **Proxy pattern implementation** - Moved from direct OpenAI client usage to encapsulated proxy pattern for better maintainability
- **Error handling enhancement** - Improved error propagation and handling across external API interactions
- **Configuration integration** - Better integration between configuration system and service initialization

#### **Testing Infrastructure**

- **Enhanced test coverage** - Added comprehensive tests for configuration validation, middleware, and services
- **Jest configuration updates** - Adjusted branch coverage thresholds for more realistic coverage expectations
- **Test environment improvements** - Better test isolation and environment-specific behavior
- **Mock service enhancements** - Improved mocking for cache service, AI service, and external dependencies

### Fixed

#### **Build System & Entry Points**

- **Package.json entry point** - Corrected main entry point from `src/index.js` to `dist/src/index.js` for proper production builds
- **Start script enhancement** - Updated start script to use `node -r dotenv/config` for proper environment loading
- **Node.js version requirement** - Updated to Node.js >=20.0.0 for better compatibility and security

#### **Error Handling & Validation**

- **Management route error handling** - Enhanced error handling in management routes with better error responses
- **API key permissions parsing** - Improved permissions parsing in ApiKeyService with better validation
- **Redis password test expectations** - Fixed test expectations to match actual Redis configuration behavior

#### **Test Coverage & Configuration**

- **Jest coverage thresholds** - Adjusted branch coverage threshold for `src/config/index.ts` to realistic levels
- **Test environment configuration** - Fixed test environment validation and configuration loading
- **Coverage reporting accuracy** - Improved coverage reporting for more accurate test coverage metrics

---

## [0.3.0] - 2025-09-05

### Added

#### **Docker Development Environment**

- **One-command development setup** - `npm run dev:start` now starts complete Docker environment with MySQL 8.0 and Redis 7
- **Automatic database setup** - Docker environment creates `altus4` database and runs all migrations automatically
- **Health check integration** - Waits for MySQL and Redis to be healthy before proceeding
- **Docker Compose configuration** - Complete `bin/dev/docker-compose.yml` with proper networking and volumes
- **Environment reset capability** - `npm run dev:reset` for clean slate development environment

#### **Organized Script Structure**

- **Categorized bin directory** - Reorganized all scripts into logical categories:
  - `bin/dev/` - Development environment (Docker, startup, shutdown)
  - `bin/db/` - Database operations (migrations, status)
  - `bin/security/` - Security tools (GPG, JWT, commit verification)
  - `bin/test/` - Testing utilities (Git hooks testing)
- **Convenience scripts** - Root-level shortcuts (`dev-start`, `dev-stop`, `dev-reset`, `migrate`) for common operations
- **Comprehensive script documentation** - `bin/README.md` with usage examples and organization guide

#### **Enhanced npm Scripts**

- **Development environment scripts** - `dev:start`, `dev:stop`, `dev:reset`, `dev:logs` for Docker management
- **Quality assurance scripts** - `typecheck`, `check`, `validate`, `fix` for comprehensive code quality
- **Testing scripts** - `test:all`, `test:integration`, `test:performance` for complete test coverage
- **Security scripts** - `security:*` namespace for all security-related operations
- **Consistent naming conventions** - All scripts follow `category:action` pattern for clarity

#### **Database Schema Enhancements**

- **New migration 006** - `database_connections` table for user database management
- **New migration 007** - `search_analytics` table for enhanced analytics tracking
- **Improved migration system** - Better status reporting and rollback capabilities
- **Empty password support** - Proper handling of local MySQL root user with empty password

### Changed

#### **Build System Improvements**

- **TypeScript path alias resolution** - Integrated `tsc-alias` for proper path transformation in production builds
- **Production environment loading** - `npm start` now automatically loads `.env` file with `dotenv/config`
- **Build script enhancement** - `npm run build` now runs `tsc && tsc-alias` for complete compilation
- **Module resolution fixes** - All `@/` path aliases correctly transformed to relative paths in dist/

#### **API Authentication System**

- **Fixed JSON parsing issue** - Resolved MySQL JSON field auto-parsing conflict in `ApiKeyService.validateApiKey`
- **Working test credentials** - Added pre-configured test user (`postman@example.com` / `postman123`) for immediate testing
- **Complete authentication flow** - End-to-end testing from registration to API key usage
- **API endpoint versioning** - All endpoints now correctly use `/api/v1/` prefix throughout documentation

#### **Environment Configuration**

- **Simplified database setup** - Default configuration uses `root` user with empty password for local development
- **Database name standardization** - Changed from `altus4_meta` to `altus4` for consistency
- **Optional environment variables** - Proper handling of empty `DB_PASSWORD` for local MySQL setups
- **Rate limiting configuration** - Temporarily disabled for testing with high limits and short durations

#### **Documentation Overhaul**

- **Complete API documentation update** - All endpoints updated to use `/api/v1/` prefix across all documentation files
- **Docker setup documentation** - Added comprehensive Docker environment setup guides
- **npm scripts documentation** - Complete reference for all available scripts organized by category
- **Quick start improvements** - Updated with Docker-first approach and simplified setup steps
- **Working examples** - All API examples tested and verified with actual working credentials

### Fixed

#### **API Key Authentication**

- **MySQL JSON field handling** - Fixed automatic JSON parsing conflict in API key validation
- **Database column mapping** - Corrected `password_encrypted` to `password` column name in database operations
- **Connection status enum** - Fixed `'active'` to `'connected'` status value alignment
- **API key validation flow** - Complete end-to-end authentication now working properly

#### **Database Operations**

- **Missing table creation** - Added migrations for `database_connections` and `search_analytics` tables
- **Migration path resolution** - Fixed script paths after bin directory reorganization
- **Environment variable validation** - Proper handling of optional database password configuration
- **Connection testing** - Database connection validation now works with empty passwords

#### **Rate Limiting Issues**

- **Development testing** - Temporarily disabled rate limiting for comprehensive endpoint testing
- **Redis integration** - Fixed rate limiter configuration for development environment
- **Authentication endpoints** - Resolved rate limit blocking during authentication testing

#### **Script Organization**

- **Path resolution** - Updated all script internal paths after reorganization
- **Permission handling** - Removed runtime `chmod` commands, scripts are pre-executable
- **Cross-references** - Fixed all script cross-references and npm script mappings
- **Documentation alignment** - All script documentation updated to reflect new organization

---

## [0.2.0] - 2024-01-15

### Added

#### **API Key Authentication System**

- **Complete JWT to API Key migration** - Replaced JWT authentication with production-ready API key system for B2B service-to-service communication
- **Secure API key generation** with format `altus4_sk_{environment}_{random}` and SHA-256 hashing
- **Comprehensive API key management** - Create, list, update, revoke, and regenerate API keys
- **Environment separation** - Support for 'test' and 'live' API key environments
- **Scoped permissions system** - API keys with specific permissions (search, analytics, admin)
- **Tiered rate limiting** - Different rate limits based on API key tiers (free, pro, enterprise)
- **API key usage tracking** - Monitor and analyze API key usage patterns
- **Bootstrap management route** - Initial API key creation using existing authentication

#### **Enhanced Middleware & Services**

- **ApiKeyService** - Complete lifecycle management for API key operations
- **ApiKeyController** - RESTful API endpoints for API key management
- **Enhanced rate limiting** - API key tier-based rate limiting with Redis integration
- **Improved middleware architecture** - Better separation of concerns and testability

#### **Testing Infrastructure**

- **508 total tests** across 21 test suites with **100% pass rate**
- **Comprehensive unit tests** for all new API key components
- **Integration tests** for end-to-end API key workflows
- **Advanced Jest mocking** with module-level instantiation handling
- **Security test coverage** for all authentication scenarios
- **Edge case validation** for robust error handling
- **Complex middleware testing** with proper mock setup for module-level instantiation
- **Mock service architecture** for reliable, isolated unit testing

#### **Security Enhancements**

- **Prefix-based API key lookup** for efficient validation without exposing full keys
- **IP address tracking** for API key usage monitoring and security
- **Generic error messages** that don't reveal system internals for security
- **Proper authorization header validation** with whitespace handling
- **Enhanced permission and role validation** with detailed error responses

#### **New API Endpoints**

- **API key management endpoints** - `/api/v1/api-keys/*` routes for API key operations
- **Management endpoints** - New `/api/v1/management/*` routes for system administration
- **Enhanced response metadata** - All responses now include API key tier information where applicable

#### **Commit Verification System**

- **GPG commit signing** - Complete setup with ECC Curve 25519 encryption for cryptographic commit verification
- **Comprehensive Git hooks** - Pre-commit, commit-msg, post-commit, and pre-push hooks for quality assurance
- **Security auditing** - Automated vulnerability scanning and dependency validation
- **Commit verification tools** - Scripts for verifying commit signatures and message format compliance
- **Documentation linting** - Automated markdown and code formatting validation
- **Performance monitoring** - Pre-commit performance checks and optimization validation

### Changed

#### **Documentation Updates**

- **Updated README.md** with complete API key authentication guide
- **API documentation refresh** in `docs/api/README.md` with new authentication examples
- **Architecture documentation** updated to reflect API key system design
- **Service documentation** includes new ApiKeyService details
- **Setup guides** updated with API key workflow instructions
- **Example updates** throughout documentation to use API key authentication

#### **Code Quality & Maintenance**

- **ESLint compliance** - All lint issues resolved for clean codebase
- **TypeScript strict mode** compliance across all new modules
- **Standardized error responses** with structured ApiResponse format
- **Improved logging** with request correlation and API key context

#### **Project Organization**

- **Script consolidation** - Moved all executable scripts from `scripts/` to `bin/` directory for better organization
- **Enhanced npm scripts** - Added commit verification, security auditing, and hook testing commands
- **Conventional commits enforcement** - Updated all Git hooks to enforce conventional commit message format

#### **Authentication System (Breaking Changes)**

- **JWT authentication deprecated** - All endpoints now require API key authentication
- **Authorization header format** - Changed from `Bearer <jwt_token>` to `Bearer <api_key>`
- **Error response structure** - Enhanced error responses with additional context and details
- **Rate limiting behavior** - Now based on API key tiers instead of IP/user-based limiting

### Fixed

#### **Test Suite Stabilization**

- **Module instantiation mocking** - Resolved complex Jest mocking issues for middleware testing
- **Rate limiter response structure** - Fixed mock return values to match actual Redis responses
- **Error message consistency** - Aligned all test expectations with actual middleware responses
- **Mock service cleanup** - Removed unused mock objects and variables
- **Rate limiter test refinements** - Fixed accurate response structure validation
- **Error message standardization** - Aligned all test expectations across test suites

#### **Middleware & System Fixes**

- **Request object validation** - Added proper IP and connection properties for middleware processing
- **Error code standardization** - Consistent error codes across all authentication flows
- **Memory leak prevention** - Proper cleanup in test suites and mock implementations
- **TypeScript build issues** - Fixed version mismatches and type compatibility
- **Linting issues** - Resolved ESLint and Prettier conflicts

#### **Commit Verification Fixes**

- **GPG agent configuration** - Fixed pinentry setup for macOS commit signing
- **Hook execution permissions** - Ensured all Git hooks are properly executable
- **Markdown formatting** - Fixed documentation formatting issues in commit verification guide
- **Version references** - Updated all test expectations to match version 0.2.0
- **Script path references** - Updated all references from `scripts/` to `bin/` directory

---

## [0.1.0] - 2024-01-01

### Initial Release - AI-Enhanced MySQL Full-Text Search Engine

This is the first official release of Altus 4, a production-ready AI-enhanced MySQL full-text search engine with zero-migration setup.

### Added

#### **Core Search Engine**

- **Three search modes**: Basic keyword, Boolean operators, and Natural language processing
- **MySQL FULLTEXT integration** with `MATCH() AGAINST()` optimization
- **Query preprocessing** with stemming, stop word removal, and term expansion
- **Search result ranking** with relevance scoring and custom weighting
- **Real-time search suggestions** and auto-completion support

#### **AI Enhancement Features**

- **OpenAI GPT integration** for intelligent query optimization
- **Semantic search capabilities** with natural language understanding
- **Query categorization** and intent recognition
- **AI-powered search insights** and result enhancement
- **Smart query suggestions** based on user context

#### **Database Integration**

- **Zero-migration setup** - works with existing MySQL databases
- **Dynamic database connections** with connection pooling
- **FULLTEXT index management** and optimization
- **Custom table configuration** support
- **Database health monitoring** and automatic reconnection

#### **Performance & Caching**

- **Redis caching layer** with intelligent cache invalidation
- **Query result caching** with TTL management
- **Search analytics caching** for performance insights
- **Connection pooling** for optimal resource utilization
- **Rate limiting** to prevent abuse and ensure stability

#### **Security & Authentication**

- **JWT-based authentication** with refresh token support
- **bcrypt password hashing** with configurable salt rounds
- **Role-based access control** (Admin, User roles)
- **AES-256-GCM encryption** for sensitive data
- **Request validation** with Zod schemas
- **Security headers** and CORS configuration

#### **Analytics & Monitoring**

- **Real-time search analytics** with query performance tracking
- **User behavior insights** and search pattern analysis
- **Performance metrics** collection and reporting
- **Error tracking** and logging with structured logs
- **Health check endpoints** for system monitoring

#### **Developer Experience**

- **Comprehensive REST API** with OpenAPI documentation
- **TypeScript support** with strict type checking
- **Extensive test suite** with 87% coverage (407 tests across 18 suites)
- **Integration tests** for end-to-end functionality
- **Docker support** with multi-stage builds
- **Development tools** including hot reload and debugging

#### **Documentation & Examples**

- **Complete API documentation** with request/response examples
- **Architecture guides** explaining system design patterns
- **Setup and deployment guides** for various environments
- **Code examples** and tutorials for common use cases
- **Service documentation** with detailed class explanations

#### **Production Features**

- **Environment-based configuration** with validation
- **Graceful shutdown** handling for clean deployment
- **Error handling middleware** with standardized error responses
- **Request logging** with correlation IDs for tracing
- **Memory and resource optimization** for production workloads

### Changed

#### **Architecture Improvements**

- **Modular service architecture** replacing monolithic design patterns
- **Dependency injection** implementation for better testability
- **Centralized configuration management** with environment validation
- **Standardized error handling** across all services and controllers
- **Improved logging strategy** with structured JSON logs

#### **Performance Optimizations**

- **Query optimization** algorithms for better search performance
- **Caching strategy refinement** to reduce database load
- **Connection pooling improvements** for better resource management
- **Memory usage optimization** in search result processing

### Fixed

#### **Test Suite Stabilization**

- **Jest auto-mocking issues** preventing service method execution
- **TypeScript compilation errors** in test files for bcrypt, OpenAI, and Redis mocking
- **Asynchronous constructor handling** in UserService tests
- **Database connection mocking** to properly simulate MySQL operations
- **Date formatting inconsistencies** in cache key generation tests

#### **Development Environment**

- **ESLint and Prettier configuration** conflicts
- **TypeScript strict mode** compliance across all modules
- **Environment variable validation** and type safety
- **Import path resolution** and module dependency management

#### **Security Enhancements**

- **JWT token validation** edge cases and error handling
- **Password hashing** consistency and validation
- **SQL injection prevention** through parameterized queries
- **Rate limiting** accuracy and redis connection handling

#### **Monitoring & Logging**

- **Error logging** format standardization
- **Performance metric** collection accuracy
- **Health check** reliability and timeout handling
- **Analytics data** consistency and validation

---

[0.2.0]: https://github.com/your-org/altus4/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/your-org/altus4/releases/tag/v0.1.0
