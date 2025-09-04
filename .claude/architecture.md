# Altus 4 Architecture Overview

## System Architecture

Altus 4 follows a layered architecture pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     API Layer (Express.js)                 │
├─────────────────────────────────────────────────────────────┤
│  Authentication │ Rate Limiting │ Validation │ Logging     │
├─────────────────────────────────────────────────────────────┤
│                   Controller Layer                          │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                            │
│  DatabaseService │ SearchService │ AIService │ CacheService │
├─────────────────────────────────────────────────────────────┤
│                 Data Access Layer                           │
│    MySQL Pools   │    Redis     │   OpenAI API             │
└─────────────────────────────────────────────────────────────┘
```

## Core Design Principles

### 1. Dependency Injection

- Services are injected into controllers and other services
- Easy mocking for testing
- Clear dependency graph

### 2. Multi-Tenant Architecture

- Each user has isolated database connections
- Secure credential storage with encryption
- Resource isolation and quota management

### 3. Stateless Design

- No server-side session storage
- API key-based authentication
- Horizontal scaling capability

### 4. Error-First Design

- Comprehensive error handling at every layer
- Structured error responses
- Graceful degradation

## Service Communication Patterns

### Database Service

- Connection pooling per user database
- Health monitoring and automatic reconnection
- Schema discovery and optimization suggestions

### Search Service

- Orchestrates searches across multiple databases
- Implements search result ranking and relevance
- Handles pagination and result aggregation

### AI Service

- Query optimization and semantic understanding
- Result categorization and enhancement
- Fallback handling when AI is unavailable

### Cache Service

- Multi-level caching strategy
- Search result caching with intelligent TTL
- Analytics data aggregation

## Data Flow

### Search Request Flow

1. Authentication middleware validates API key
2. Rate limiting checks quota usage
3. Request validation with Zod schemas
4. Search service orchestrates the search
5. Database service executes queries on user databases
6. AI service enhances results (optional)
7. Cache service stores results
8. Structured response returned to client

### Database Connection Flow

1. User provides database credentials
2. Credentials encrypted and stored securely
3. Connection pool created for user database
4. Health checks monitor connection status
5. Schema discovery identifies searchable tables
6. FULLTEXT indexes analyzed for optimization

## Security Architecture

### Authentication Flow

1. User registers account with email/password
2. JWT token issued for API key management (legacy)
3. API keys generated with SHA-256 hashing
4. API keys used for all search operations
5. Tiered permissions (free/pro/enterprise)

### Data Protection

- Database credentials encrypted with AES-256
- API keys hashed with SHA-256
- User passwords hashed with bcrypt
- SQL injection prevention with parameterized queries

## Scalability Considerations

### Horizontal Scaling

- Stateless service design
- Database connection pooling
- Redis cluster support
- Load balancer ready

### Vertical Scaling

- Configurable connection pool sizes
- Memory-efficient result processing
- Optimized database queries
- Intelligent caching strategies

## Performance Optimization

### Caching Strategy

- Search result caching in Redis
- API key validation caching
- Database schema caching
- Analytics data aggregation

### Database Optimization

- Connection pooling with health monitoring
- Query optimization with EXPLAIN analysis
- Index usage recommendations
- Batch operations for analytics

### AI Service Optimization

- Response caching for similar queries
- Fallback to basic search when AI unavailable
- Rate limiting awareness
- Batch processing for multiple requests
