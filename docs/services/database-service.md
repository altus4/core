---
title: DatabaseService Documentation
description: Complete technical documentation for DatabaseService - MySQL connection management, schema discovery, and query optimization in Altus 4.
---

# DatabaseService Documentation

Comprehensive DatabaseService Implementation Guide

The DatabaseService is responsible for managing MySQL database connections, executing queries, discovering schemas, and optimizing database interactions. It provides secure connection pooling, credential encryption, and comprehensive database operations.

## Service Overview

### Responsibilities

The DatabaseService handles:

- **Connection Management** - Secure MySQL connection pooling and lifecycle management
- **Query Execution** - Full-text search query execution with optimization
- **Schema Discovery** - Database schema introspection and metadata extraction
- **Security** - Credential encryption and secure connection handling
- **Health Monitoring** - Connection health checks and performance monitoring

### Architecture

```typescript
export class DatabaseService {
  constructor(
    private encryptionService: EncryptionService,
    private logger: Logger
  ) {}

  // Core Methods
  async addDatabase(userId: string, config: DatabaseConfig): Promise<Database>;
  async removeDatabase(userId: string, databaseId: string): Promise<void>;
  async testConnection(config: DatabaseConfig): Promise<ConnectionTestResult>;
  async executeSearch(databaseId: string, query: SearchQuery): Promise<SearchResult[]>;
  async discoverSchema(databaseId: string): Promise<DatabaseSchema>;

  // Connection Management
  private async createConnection(config: DatabaseConfig): Promise<mysql.Connection>;
  private async getConnectionPool(databaseId: string): Promise<mysql.Pool>;
  private async releaseConnection(connection: mysql.Connection): Promise<void>;
}
```

## Core Functionality

### Database Connection Management

#### Adding Database Connections

The service securely stores database credentials with encryption:

```typescript
interface DatabaseConfig {
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl?: SSLConfig
  connectionOptions?: ConnectionOptions
}

interface SSLConfig {
  enabled: boolean
  rejectUnauthorized?: boolean
  ca?: string
  cert?: string
  key?: string
}

async addDatabase(userId: string, config: DatabaseConfig): Promise<Database> {
  try {
    // Validate configuration
    this.validateDatabaseConfig(config)

    // Test connection before saving
    await this.testConnection(config)

    // Encrypt sensitive credentials
    const encryptedPassword = await this.encryptionService.encrypt(config.password)
    const encryptedSSL = config.ssl ? await this.encryptionService.encrypt(JSON.stringify(config.ssl)) : null

    // Save to database
    const database = await this.saveDatabaseConfig({
      ...config,
      userId,
      password: encryptedPassword,
      ssl: encryptedSSL,
      status: 'connected',
      createdAt: new Date(),
      lastTested: new Date()
    })

    // Initialize connection pool
    await this.initializeConnectionPool(database.id, config)

    this.logger.info('Database added successfully', {
      userId,
      databaseId: database.id,
      name: config.name
    })

    return database

  } catch (error) {
    this.logger.error('Failed to add database', { error, userId, config: { ...config, password: '[REDACTED]' } })
    throw new AppError('DATABASE_ADD_FAILED', error.message)
  }
}
```

#### Connection Pooling

The service uses MySQL connection pooling for efficient resource management:

```typescript
interface ConnectionPoolConfig {
  connectionLimit: number
  acquireTimeout: number
  timeout: number
  charset: string
  timezone: string
}

private async initializeConnectionPool(databaseId: string, config: DatabaseConfig): Promise<void> {
  const poolConfig: mysql.PoolOptions = {
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    connectionLimit: config.connectionOptions?.connectionLimit || 10,
    acquireTimeout: config.connectionOptions?.acquireTimeout || 60000,
    timeout: config.connectionOptions?.timeout || 60000,
    charset: config.connectionOptions?.charset || 'utf8mb4',
    timezone: config.connectionOptions?.timezone || 'UTC',
    ssl: config.ssl?.enabled ? {
      rejectUnauthorized: config.ssl.rejectUnauthorized ?? true,
      ca: config.ssl.ca,
      cert: config.ssl.cert,
      key: config.ssl.key
    } : false,
    // Connection pool events
    onConnectionAdd: (connection) => {
      this.logger.debug('Connection added to pool', { databaseId, connectionId: connection.threadId })
    },
    onConnectionRemove: (connection) => {
      this.logger.debug('Connection removed from pool', { databaseId, connectionId: connection.threadId })
    }
  }

  const pool = mysql.createPool(poolConfig)
  this.connectionPools.set(databaseId, pool)

  // Test pool connectivity
  await this.testPoolConnection(pool)
}

private async testPoolConnection(pool: mysql.Pool): Promise<void> {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        return reject(new AppError('CONNECTION_POOL_ERROR', err.message))
      }

      connection.ping((pingErr) => {
        connection.release()
        if (pingErr) {
          return reject(new AppError('CONNECTION_TEST_FAILED', pingErr.message))
        }
        resolve()
      })
    })
  })
}
```

### Search Query Execution

#### Full-Text Search Implementation

The service executes optimized MySQL full-text searches:

```typescript
interface SearchQuery {
  query: string
  tables: string[]
  columns: string[]
  limit: number
  offset: number
  mode: 'natural' | 'boolean' | 'semantic'
  filters?: SearchFilters
}

interface SearchFilters {
  dateRange?: { from: string; to: string }
  minScore?: number
  exclude?: string[]
}

async executeSearch(databaseId: string, searchQuery: SearchQuery): Promise<SearchResult[]> {
  const startTime = Date.now()

  try {
    const pool = await this.getConnectionPool(databaseId)
    const connection = await this.getConnection(pool)

    // Build optimized search query
    const { sql, params } = this.buildSearchQuery(searchQuery)

    this.logger.debug('Executing search query', {
      databaseId,
      sql: this.sanitizeQueryForLogging(sql),
      queryLength: searchQuery.query.length,
      tablesCount: searchQuery.tables.length
    })

    // Execute query with timeout
    const results = await this.executeQueryWithTimeout(connection, sql, params, 30000)

    // Process and enhance results
    const processedResults = await this.processSearchResults(results, searchQuery)

    const executionTime = Date.now() - startTime
    this.logger.info('Search query completed', {
      databaseId,
      resultCount: processedResults.length,
      executionTime
    })

    return processedResults

  } catch (error) {
    const executionTime = Date.now() - startTime
    this.logger.error('Search query failed', {
      error,
      databaseId,
      query: searchQuery.query,
      executionTime
    })
    throw new AppError('SEARCH_QUERY_FAILED', error.message)
  }
}

private buildSearchQuery(searchQuery: SearchQuery): { sql: string; params: any[] } {
  const { query, tables, columns, limit, offset, mode, filters } = searchQuery

  // Escape and sanitize inputs
  const escapedQuery = mysql.escape(query)
  const escapedTables = tables.map(table => mysql.escapeId(table))
  const escapedColumns = columns.map(col => mysql.escapeId(col))

  // Build MATCH AGAINST clause based on mode
  let matchClause: string
  switch (mode) {
    case 'boolean':
      matchClause = `MATCH(${escapedColumns.join(',')}) AGAINST(${escapedQuery} IN BOOLEAN MODE)`
      break
    case 'natural':
    default:
      matchClause = `MATCH(${escapedColumns.join(',')}) AGAINST(${escapedQuery} IN NATURAL LANGUAGE MODE)`
      break
  }

  // Build SELECT clause
  const selectColumns = [
    '*',
    `${matchClause} as relevance_score`
  ]

  // Build WHERE clause
  const whereConditions = [matchClause]

  // Add filters
  if (filters?.minScore) {
    whereConditions.push(`${matchClause} >= ${filters.minScore}`)
  }

  if (filters?.dateRange) {
    // Assume created_at column exists
    whereConditions.push(`created_at BETWEEN ? AND ?`)
  }

  if (filters?.exclude?.length) {
    const excludeConditions = filters.exclude.map(term =>
      `NOT (${escapedColumns.map(col => `${col} LIKE ?`).join(' OR ')})`
    )
    whereConditions.push(...excludeConditions)
  }

  // Build query for each table
  const tableQueries = escapedTables.map(table => `
    SELECT ${selectColumns.join(', ')}, '${table}' as source_table
    FROM ${table}
    WHERE ${whereConditions.join(' AND ')}
  `)

  // Combine with UNION and sort by relevance
  const sql = `
    ${tableQueries.join(' UNION ALL ')}
    ORDER BY relevance_score DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  // Build parameters
  const params: any[] = []
  if (filters?.dateRange) {
    params.push(filters.dateRange.from, filters.dateRange.to)
  }

  if (filters?.exclude?.length) {
    filters.exclude.forEach(term => {
      columns.forEach(() => params.push(`%${term}%`))
    })
  }

  return { sql, params }
}
```

### Schema Discovery

#### Database Schema Introspection

The service discovers database structure and indexes:

```typescript
interface DatabaseSchema {
  database: string
  version: string
  characterSet: string
  collation: string
  tables: TableSchema[]
  searchOptimizations: SearchOptimization[]
}

interface TableSchema {
  name: string
  engine: string
  rowCount: number
  dataSize: string
  indexSize: string
  columns: ColumnSchema[]
  indexes: IndexSchema[]
  searchable: boolean
  fullTextColumns: string[]
}

interface ColumnSchema {
  name: string
  type: string
  nullable: boolean
  key: string
  default: any
  extra: string
}

interface IndexSchema {
  name: string
  type: 'BTREE' | 'FULLTEXT' | 'HASH'
  unique: boolean
  columns: string[]
}

async discoverSchema(databaseId: string): Promise<DatabaseSchema> {
  try {
    const pool = await this.getConnectionPool(databaseId)
    const connection = await this.getConnection(pool)

    // Get database information
    const dbInfo = await this.getDatabaseInfo(connection)

    // Get all tables
    const tables = await this.getTablesInfo(connection)

    // Get detailed schema for each table
    const tableSchemas = await Promise.all(
      tables.map(table => this.getTableSchema(connection, table.name))
    )

    // Analyze search optimization opportunities
    const searchOptimizations = await this.analyzeSearchOptimizations(tableSchemas)

    const schema: DatabaseSchema = {
      database: dbInfo.database,
      version: dbInfo.version,
      characterSet: dbInfo.characterSet,
      collation: dbInfo.collation,
      tables: tableSchemas,
      searchOptimizations
    }

    this.logger.info('Schema discovery completed', {
      databaseId,
      tablesCount: tableSchemas.length,
      searchableTablesCount: tableSchemas.filter(t => t.searchable).length
    })

    return schema

  } catch (error) {
    this.logger.error('Schema discovery failed', { error, databaseId })
    throw new AppError('SCHEMA_DISCOVERY_FAILED', error.message)
  }
}

private async getTableSchema(connection: mysql.Connection, tableName: string): Promise<TableSchema> {
  // Get column information
  const columns = await this.queryDatabase(connection, `
    SELECT
      COLUMN_NAME as name,
      DATA_TYPE as type,
      IS_NULLABLE = 'YES' as nullable,
      COLUMN_KEY as \`key\`,
      COLUMN_DEFAULT as \`default\`,
      EXTRA as extra
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = ? AND TABLE_SCHEMA = DATABASE()
    ORDER BY ORDINAL_POSITION
  `, [tableName])

  // Get index information
  const indexes = await this.queryDatabase(connection, `
    SELECT
      INDEX_NAME as name,
      INDEX_TYPE as type,
      NOT NON_UNIQUE as unique,
      GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_NAME = ? AND TABLE_SCHEMA = DATABASE()
    GROUP BY INDEX_NAME, INDEX_TYPE, NON_UNIQUE
  `, [tableName])

  // Get table stats
  const tableStats = await this.queryDatabase(connection, `
    SELECT
      ENGINE as engine,
      TABLE_ROWS as rowCount,
      ROUND(DATA_LENGTH/1024/1024, 2) as dataSizeMB,
      ROUND(INDEX_LENGTH/1024/1024, 2) as indexSizeMB
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = ? AND TABLE_SCHEMA = DATABASE()
  `, [tableName])

  const stats = tableStats[0] || {}

  // Identify full-text searchable columns
  const fullTextIndexes = indexes.filter(idx => idx.type === 'FULLTEXT')
  const fullTextColumns = fullTextIndexes.flatMap(idx =>
    idx.columns.split(',').map(col => col.trim())
  )

  // Determine if table is searchable
  const textColumns = columns.filter(col =>
    ['text', 'mediumtext', 'longtext', 'varchar'].some(type =>
      col.type.toLowerCase().includes(type)
    )
  )

  return {
    name: tableName,
    engine: stats.engine || 'Unknown',
    rowCount: stats.rowCount || 0,
    dataSize: `${stats.dataSizeMB || 0}MB`,
    indexSize: `${stats.indexSizeMB || 0}MB`,
    columns: columns.map(col => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable,
      key: col.key,
      default: col.default,
      extra: col.extra
    })),
    indexes: indexes.map(idx => ({
      name: idx.name,
      type: idx.type,
      unique: idx.unique,
      columns: idx.columns.split(',').map(col => col.trim())
    })),
    searchable: fullTextColumns.length > 0 || textColumns.length > 0,
    fullTextColumns: [...new Set(fullTextColumns)]
  }
}
```

### Connection Health Monitoring

#### Health Checks and Monitoring

The service provides comprehensive health monitoring:

```typescript
interface ConnectionHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  activeConnections: number
  maxConnections: number
  connectionUtilization: number
  uptime: number
  lastError: Error | null
  metrics: HealthMetrics
}

interface HealthMetrics {
  queriesPerSecond: number
  averageQueryTime: number
  slowQueries: number
  connectionErrors: number
  lastHealthCheck: Date
}

async checkConnectionHealth(databaseId: string): Promise<ConnectionHealth> {
  const startTime = Date.now()

  try {
    const pool = await this.getConnectionPool(databaseId)

    // Test basic connectivity
    const connection = await this.getConnection(pool)

    // Execute health check query
    const healthQuery = 'SELECT 1 as health_check, NOW() as server_time'
    const result = await this.queryDatabase(connection, healthQuery)

    connection.release()

    const responseTime = Date.now() - startTime

    // Get pool statistics
    const poolStats = this.getPoolStatistics(pool)

    // Get performance metrics
    const metrics = await this.getPerformanceMetrics(databaseId)

    const health: ConnectionHealth = {
      status: this.determineHealthStatus(responseTime, poolStats, metrics),
      responseTime,
      activeConnections: poolStats.activeConnections,
      maxConnections: poolStats.maxConnections,
      connectionUtilization: poolStats.activeConnections / poolStats.maxConnections,
      uptime: poolStats.uptime,
      lastError: null,
      metrics
    }

    this.logger.debug('Health check completed', {
      databaseId,
      status: health.status,
      responseTime
    })

    return health

  } catch (error) {
    this.logger.error('Health check failed', { error, databaseId })

    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      activeConnections: 0,
      maxConnections: 0,
      connectionUtilization: 0,
      uptime: 0,
      lastError: error,
      metrics: {
        queriesPerSecond: 0,
        averageQueryTime: 0,
        slowQueries: 0,
        connectionErrors: 0,
        lastHealthCheck: new Date()
      }
    }
  }
}

private determineHealthStatus(
  responseTime: number,
  poolStats: any,
  metrics: HealthMetrics
): 'healthy' | 'degraded' | 'unhealthy' {
  // Unhealthy conditions
  if (responseTime > 5000) return 'unhealthy' // 5+ seconds
  if (poolStats.connectionUtilization > 0.9) return 'unhealthy' // >90% pool usage
  if (metrics.connectionErrors > 10) return 'unhealthy' // Too many errors

  // Degraded conditions
  if (responseTime > 1000) return 'degraded' // 1+ seconds
  if (poolStats.connectionUtilization > 0.7) return 'degraded' // >70% pool usage
  if (metrics.slowQueries > 5) return 'degraded' // Slow queries

  return 'healthy'
}
```

## Error Handling

### Custom Error Types

The DatabaseService defines specific error types for different failure scenarios:

```typescript
export enum DatabaseErrorCodes {
  CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  SCHEMA_DISCOVERY_FAILED = 'SCHEMA_DISCOVERY_FAILED',
  POOL_EXHAUSTED = 'CONNECTION_POOL_EXHAUSTED',
  TIMEOUT = 'DATABASE_TIMEOUT',
  AUTHENTICATION_FAILED = 'DATABASE_AUTH_FAILED',
  SSL_ERROR = 'DATABASE_SSL_ERROR',
}

class DatabaseError extends AppError {
  constructor(
    code: DatabaseErrorCodes,
    message: string,
    public databaseId?: string,
    public originalError?: Error
  ) {
    super(code, message, 500, {
      databaseId,
      originalError: originalError?.message,
    });
  }
}
```

### Error Recovery Strategies

The service implements automatic retry and recovery mechanisms:

```typescript
private async executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }

      // Check if error is retryable
      if (!this.isRetryableError(error)) {
        throw error
      }

      // Exponential backoff
      const delay = backoffMs * Math.pow(2, attempt - 1)
      await this.sleep(delay)

      this.logger.warn(`Database operation retry ${attempt}/${maxRetries}`, {
        error: error.message,
        nextAttemptIn: delay
      })
    }
  }
}

private isRetryableError(error: Error): boolean {
  const retryableErrors = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ER_LOCK_WAIT_TIMEOUT',
    'ER_LOCK_DEADLOCK'
  ]

  return retryableErrors.some(code =>
    error.message.includes(code) || error.name === code
  )
}
```

## Performance Optimization

### Query Optimization

The service includes query optimization features:

```typescript
interface QueryOptimization {
  enableQueryCache: boolean
  optimizeFullTextQueries: boolean
  useQueryPreparedStatements: boolean
  enableQueryLogging: boolean
}

private optimizeQuery(sql: string, params: any[]): { sql: string; params: any[] } {
  // Remove unnecessary whitespace
  sql = sql.replace(/\s+/g, ' ').trim()

  // Add query hints for full-text searches
  if (sql.includes('MATCH') && sql.includes('AGAINST')) {
    sql = sql.replace('SELECT', 'SELECT /*+ USE_INDEX(idx_fulltext) */')
  }

  // Optimize LIMIT clauses
  if (sql.includes('LIMIT')) {
    sql = sql.replace(/LIMIT (\d+) OFFSET (\d+)/, 'LIMIT $2, $1')
  }

  return { sql, params }
}
```

### Connection Pool Optimization

Advanced connection pool management:

```typescript
interface PoolOptimization {
  connectionLimit: number
  acquireTimeout: number
  createTimeout: number
  idleTimeout: number
  reapInterval: number
}

private optimizeConnectionPool(databaseId: string, usage: PoolUsage): void {
  const pool = this.connectionPools.get(databaseId)
  if (!pool) return

  const optimization: PoolOptimization = {
    connectionLimit: Math.min(usage.peakConnections * 1.5, 50),
    acquireTimeout: usage.averageResponseTime * 3,
    createTimeout: 30000,
    idleTimeout: 300000,
    reapInterval: 30000
  }

  // Apply optimizations
  pool.config.connectionLimit = optimization.connectionLimit
  pool.config.acquireTimeout = optimization.acquireTimeout

  this.logger.info('Connection pool optimized', {
    databaseId,
    optimization
  })
}
```

## Testing and Validation

### Unit Testing

```typescript
describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let mockEncryptionService: jest.Mocked<EncryptionService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };

    databaseService = new DatabaseService(mockEncryptionService, mockLogger);
  });

  describe('addDatabase', () => {
    it('should successfully add a database with valid configuration', async () => {
      const config: DatabaseConfig = {
        name: 'Test DB',
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass',
      };

      mockEncryptionService.encrypt.mockResolvedValue('encrypted_password');

      const result = await databaseService.addDatabase('user123', config);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe(config.name);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(config.password);
    });

    it('should throw error for invalid database configuration', async () => {
      const config: DatabaseConfig = {
        name: '',
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass',
      };

      await expect(databaseService.addDatabase('user123', config)).rejects.toThrow(
        'VALIDATION_ERROR'
      );
    });
  });

  describe('executeSearch', () => {
    it('should execute search query and return results', async () => {
      const searchQuery: SearchQuery = {
        query: 'test search',
        tables: ['articles'],
        columns: ['title', 'content'],
        limit: 10,
        offset: 0,
        mode: 'natural',
      };

      // Mock database connection and query execution
      const mockResults = [
        {
          id: 1,
          title: 'Test Article',
          content: 'Test content',
          relevance_score: 0.8,
        },
      ];

      jest.spyOn(databaseService as any, 'executeQueryWithTimeout').mockResolvedValue(mockResults);

      const results = await databaseService.executeSearch('db123', searchQuery);

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('relevance_score');
    });
  });
});
```

### Integration Testing

```typescript
describe('DatabaseService Integration', () => {
  let databaseService: DatabaseService;
  let testDatabase: Database;

  beforeAll(async () => {
    // Setup test database
    testDatabase = await setupTestDatabase();
    databaseService = new DatabaseService(new EncryptionService(), logger);
  });

  afterAll(async () => {
    await teardownTestDatabase(testDatabase);
  });

  it('should perform end-to-end database operations', async () => {
    // Add database
    const database = await databaseService.addDatabase('testuser', testDbConfig);
    expect(database.id).toBeDefined();

    // Test connection
    const connectionTest = await databaseService.testConnection(testDbConfig);
    expect(connectionTest.status).toBe('success');

    // Discover schema
    const schema = await databaseService.discoverSchema(database.id);
    expect(schema.tables.length).toBeGreaterThan(0);

    // Execute search
    const searchResults = await databaseService.executeSearch(database.id, {
      query: 'test',
      tables: ['test_table'],
      columns: ['content'],
      limit: 10,
      offset: 0,
      mode: 'natural',
    });
    expect(searchResults).toBeDefined();
  });
});
```

## Best Practices

### Security Best Practices

1. **Credential Encryption**: Always encrypt database passwords at rest
2. **Connection Security**: Use SSL/TLS connections in production
3. **SQL Injection Prevention**: Use parameterized queries exclusively
4. **Access Control**: Validate user permissions before database operations
5. **Audit Logging**: Log all database operations for security auditing

### Performance Best Practices

1. **Connection Pooling**: Use appropriate pool sizes based on database capacity
2. **Query Optimization**: Analyze and optimize slow queries regularly
3. **Index Strategy**: Ensure proper indexes for full-text search
4. **Resource Monitoring**: Monitor database performance and connection health
5. **Caching**: Implement query result caching where appropriate

### Operational Best Practices

1. **Health Monitoring**: Regular health checks and alerting
2. **Error Recovery**: Implement retry logic for transient failures
3. **Resource Cleanup**: Proper connection and resource cleanup
4. **Configuration Validation**: Validate all database configurations
5. **Documentation**: Maintain clear documentation of database schemas

---

**The DatabaseService provides a robust foundation for MySQL database management in Altus 4, handling everything from secure connections to optimized query execution.**
