---
title: CacheService Documentation
description: Complete technical documentation for CacheService - Redis-based caching, analytics storage, and performance optimization in Altus 4.
---

# CacheService Documentation

Comprehensive CacheService Implementation Guide

The CacheService provides Redis-based caching capabilities for search results, analytics data, and performance optimization. It implements intelligent caching strategies, data structures optimization, and comprehensive analytics storage for enhanced system performance.

## Service Overview

### Responsibilities

The CacheService handles:

- **Search Result Caching** - Cache frequently accessed search results for improved response times
- **Analytics Storage** - Store and retrieve search analytics and user behavior data
- **Performance Optimization** - Reduce database load through intelligent caching strategies
- **Session Management** - Manage user sessions and temporary data storage
- **Real-time Metrics** - Track and store real-time performance metrics

### Architecture

```typescript
export class CacheService {
  constructor(
    private redisClient: Redis,
    private logger: Logger,
    private config: CacheConfig
  ) {}

  // Core Caching Methods
  async get<T>(key: string): Promise<T | null>;
  async set<T>(key: string, value: T, ttl?: number): Promise<void>;
  async del(key: string): Promise<boolean>;
  async exists(key: string): Promise<boolean>;
  async expire(key: string, ttl: number): Promise<boolean>;

  // Search Caching
  async cacheSearchResults(
    query: SearchQuery,
    results: SearchResult[],
    ttl?: number
  ): Promise<void>;
  async getCachedSearchResults(query: SearchQuery): Promise<SearchResult[] | null>;
  async invalidateSearchCache(pattern?: string): Promise<number>;

  // Analytics Methods
  async storeAnalytics(event: AnalyticsEvent): Promise<void>;
  async getAnalytics(query: AnalyticsQuery): Promise<AnalyticsData>;
  async aggregateMetrics(timeframe: string): Promise<AggregatedMetrics>;

  // Session Management
  async createSession(userId: string, data: SessionData): Promise<string>;
  async getSession(sessionId: string): Promise<SessionData | null>;
  async updateSession(sessionId: string, data: Partial<SessionData>): Promise<void>;
  async destroySession(sessionId: string): Promise<boolean>;

  // Health and Monitoring
  async healthCheck(): Promise<CacheHealth>;
  async getStats(): Promise<CacheStats>;
}
```

## Core Functionality

### Basic Caching Operations

#### Get, Set, and Delete Operations

The service provides fundamental caching operations with advanced features:

```typescript
interface CacheConfig {
  host: string
  port: number
  password?: string
  database: number
  connectionTimeout: number
  commandTimeout: number
  retryDelayOnFailover: number
  maxRetriesPerRequest: number
  keyPrefix: string
  defaultTTL: number
}

interface CacheMetrics {
  hits: number
  misses: number
  sets: number
  deletes: number
  errors: number
}

async get<T>(key: string): Promise<T | null> {
  const startTime = Date.now()

  try {
    const fullKey = this.buildKey(key)
    const value = await this.redisClient.get(fullKey)

    const operationTime = Date.now() - startTime

    if (value === null) {
      this.updateMetrics('miss', operationTime)
      this.logger.debug('Cache miss', { key: fullKey, operationTime })
      return null
    }

    const parsed = JSON.parse(value)
    this.updateMetrics('hit', operationTime)

    this.logger.debug('Cache hit', {
      key: fullKey,
      operationTime,
      dataSize: value.length
    })

    return parsed

  } catch (error) {
    const operationTime = Date.now() - startTime
    this.updateMetrics('error', operationTime)
    this.logger.error('Cache get failed', { error, key, operationTime })

    // Return null on cache errors to allow fallback to source
    return null
  }
}

async set<T>(key: string, value: T, ttl?: number): Promise<void> {
  const startTime = Date.now()

  try {
    const fullKey = this.buildKey(key)
    const serialized = JSON.stringify(value)
    const cacheTTL = ttl || this.config.defaultTTL

    // Use SETEX for atomic set with expiration
    await this.redisClient.setex(fullKey, cacheTTL, serialized)

    const operationTime = Date.now() - startTime
    this.updateMetrics('set', operationTime)

    this.logger.debug('Cache set', {
      key: fullKey,
      ttl: cacheTTL,
      operationTime,
      dataSize: serialized.length
    })

  } catch (error) {
    const operationTime = Date.now() - startTime
    this.updateMetrics('error', operationTime)
    this.logger.error('Cache set failed', { error, key, operationTime })

    // Don't throw on cache errors to prevent disrupting main operations
    return
  }
}

async del(key: string): Promise<boolean> {
  const startTime = Date.now()

  try {
    const fullKey = this.buildKey(key)
    const result = await this.redisClient.del(fullKey)

    const operationTime = Date.now() - startTime
    this.updateMetrics('delete', operationTime)

    this.logger.debug('Cache delete', {
      key: fullKey,
      found: result > 0,
      operationTime
    })

    return result > 0

  } catch (error) {
    const operationTime = Date.now() - startTime
    this.updateMetrics('error', operationTime)
    this.logger.error('Cache delete failed', { error, key, operationTime })
    return false
  }
}

private buildKey(key: string): string {
  return `${this.config.keyPrefix}${key}`
}

private updateMetrics(operation: string, time: number): void {
  // Update internal metrics for monitoring
  this.metrics[operation] = (this.metrics[operation] || 0) + 1
  this.responseTimeMetrics.push({ operation, time, timestamp: Date.now() })

  // Keep only recent metrics (last 1000 operations)
  if (this.responseTimeMetrics.length > 1000) {
    this.responseTimeMetrics.shift()
  }
}
```

### Search Result Caching

#### Advanced Search Cache Management

The service implements sophisticated search result caching with invalidation strategies:

```typescript
interface SearchCacheKey {
  query: string
  databases: string[]
  mode: SearchMode
  filters: SearchFilters
  limit: number
  offset: number
}

interface CachedSearchResult {
  results: SearchResult[]
  metadata: SearchMetadata
  cachedAt: Date
  expiresAt: Date
  hitCount: number
}

async cacheSearchResults(
  query: SearchQuery,
  results: SearchResult[],
  ttl?: number
): Promise<void> {
  try {
    const cacheKey = this.generateSearchCacheKey(query)
    const cacheData: CachedSearchResult = {
      results,
      metadata: {
        totalResults: results.length,
        executionTime: query.executionTime,
        databases: query.databases,
        mode: query.mode
      },
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + (ttl || this.getSearchCacheTTL(query))),
      hitCount: 0
    }

    await this.set(cacheKey, cacheData, ttl)

    // Store cache key for pattern-based invalidation
    await this.addToCacheIndex('search', cacheKey, query)

    this.logger.info('Search results cached', {
      cacheKey,
      resultCount: results.length,
      ttl: ttl || this.getSearchCacheTTL(query)
    })

  } catch (error) {
    this.logger.error('Failed to cache search results', { error, query })
  }
}

async getCachedSearchResults(query: SearchQuery): Promise<SearchResult[] | null> {
  try {
    const cacheKey = this.generateSearchCacheKey(query)
    const cached = await this.get<CachedSearchResult>(cacheKey)

    if (!cached) {
      return null
    }

    // Update hit count
    cached.hitCount += 1
    await this.set(cacheKey, cached, Math.floor((cached.expiresAt.getTime() - Date.now()) / 1000))

    this.logger.debug('Search cache hit', {
      cacheKey,
      hitCount: cached.hitCount,
      resultCount: cached.results.length
    })

    return cached.results

  } catch (error) {
    this.logger.error('Failed to get cached search results', { error, query })
    return null
  }
}

private generateSearchCacheKey(query: SearchQuery): string {
  // Create deterministic cache key from query parameters
  const keyObject: SearchCacheKey = {
    query: query.query.toLowerCase().trim(),
    databases: query.databases.sort(),
    mode: query.mode,
    filters: this.normalizeFilters(query.filters),
    limit: query.limit,
    offset: query.offset
  }

  const hash = require('crypto')
    .createHash('md5')
    .update(JSON.stringify(keyObject))
    .digest('hex')

  return `search:${hash}`
}

private getSearchCacheTTL(query: SearchQuery): number {
  // Dynamic TTL based on query characteristics
  const baseTTL = 300 // 5 minutes

  // Longer TTL for popular queries
  if (this.isPopularQuery(query.query)) {
    return baseTTL * 4 // 20 minutes
  }

  // Shorter TTL for real-time data queries
  if (this.hasRecentFilters(query.filters)) {
    return baseTTL / 5 // 1 minute
  }

  // Longer TTL for complex queries (expensive to recompute)
  if (query.mode === 'semantic' || query.databases.length > 3) {
    return baseTTL * 2 // 10 minutes
  }

  return baseTTL
}

async invalidateSearchCache(pattern?: string): Promise<number> {
  try {
    let keysToDelete: string[]

    if (pattern) {
      // Pattern-based invalidation
      const fullPattern = this.buildKey(`search:*${pattern}*`)
      keysToDelete = await this.redisClient.keys(fullPattern)
    } else {
      // Invalidate all search cache
      const allSearchKeys = this.buildKey('search:*')
      keysToDelete = await this.redisClient.keys(allSearchKeys)
    }

    if (keysToDelete.length === 0) {
      return 0
    }

    // Delete in batches to avoid blocking
    const batchSize = 100
    let deletedCount = 0

    for (let i = 0; i < keysToDelete.length; i += batchSize) {
      const batch = keysToDelete.slice(i, i + batchSize)
      const result = await this.redisClient.del(...batch)
      deletedCount += result
    }

    this.logger.info('Search cache invalidated', {
      pattern,
      deletedKeys: deletedCount
    })

    return deletedCount

  } catch (error) {
    this.logger.error('Failed to invalidate search cache', { error, pattern })
    return 0
  }
}
```

### Analytics Storage

#### Comprehensive Analytics Data Management

The service provides advanced analytics storage and retrieval capabilities:

```typescript
interface AnalyticsEvent {
  type: 'search' | 'user_action' | 'performance' | 'error'
  userId?: string
  sessionId?: string
  timestamp: Date
  data: Record<string, any>
  metadata?: {
    userAgent?: string
    ip?: string
    source?: string
  }
}

interface AnalyticsQuery {
  type: string
  dateRange: {
    from: Date
    to: Date
  }
  userId?: string
  filters?: Record<string, any>
  aggregation?: 'sum' | 'avg' | 'count' | 'max' | 'min'
  groupBy?: string[]
}

interface TimeSeriesData {
  timestamp: Date
  value: number
  metadata?: Record<string, any>
}

async storeAnalytics(event: AnalyticsEvent): Promise<void> {
  try {
    const timestamp = event.timestamp.getTime()
    const eventKey = `analytics:${event.type}:${timestamp}:${Math.random().toString(36).substr(2)}`

    // Store individual event
    await this.set(eventKey, event, 86400) // 24 hours TTL

    // Update time-series data structures
    await this.updateTimeSeries(event)

    // Update counters and aggregates
    await this.updateAggregates(event)

    this.logger.debug('Analytics event stored', {
      type: event.type,
      userId: event.userId,
      timestamp: event.timestamp
    })

  } catch (error) {
    this.logger.error('Failed to store analytics event', { error, event })
  }
}

private async updateTimeSeries(event: AnalyticsEvent): Promise<void> {
  const timestamp = Math.floor(event.timestamp.getTime() / 1000)

  // Store hourly time series
  const hourKey = `timeseries:${event.type}:hour:${Math.floor(timestamp / 3600) * 3600}`
  await this.redisClient.zincrby(hourKey, 1, timestamp.toString())
  await this.redisClient.expire(hourKey, 86400 * 7) // 7 days

  // Store daily time series
  const dayKey = `timeseries:${event.type}:day:${Math.floor(timestamp / 86400) * 86400}`
  await this.redisClient.zincrby(dayKey, 1, Math.floor(timestamp / 3600).toString())
  await this.redisClient.expire(dayKey, 86400 * 30) // 30 days

  // Store weekly time series
  const weekKey = `timeseries:${event.type}:week:${Math.floor(timestamp / (86400 * 7)) * (86400 * 7)}`
  await this.redisClient.zincrby(weekKey, 1, Math.floor(timestamp / 86400).toString())
  await this.redisClient.expire(weekKey, 86400 * 365) // 1 year
}

private async updateAggregates(event: AnalyticsEvent): Promise<void> {
  const hourBucket = Math.floor(event.timestamp.getTime() / (1000 * 3600))
  const dayBucket = Math.floor(event.timestamp.getTime() / (1000 * 86400))

  // Update hourly counters
  await this.redisClient.hincrby(`counter:${event.type}:hour`, hourBucket.toString(), 1)
  await this.redisClient.expire(`counter:${event.type}:hour`, 86400 * 7)

  // Update daily counters
  await this.redisClient.hincrby(`counter:${event.type}:day`, dayBucket.toString(), 1)
  await this.redisClient.expire(`counter:${event.type}:day`, 86400 * 30)

  // Update specific metrics based on event type
  if (event.type === 'search') {
    await this.updateSearchAggregates(event)
  } else if (event.type === 'performance') {
    await this.updatePerformanceAggregates(event)
  }
}

private async updateSearchAggregates(event: AnalyticsEvent): Promise<void> {
  const query = event.data.query?.toLowerCase()
  if (!query) return

  // Track popular queries
  await this.redisClient.zincrby('popular:queries', 1, query)

  // Track search modes usage
  if (event.data.mode) {
    await this.redisClient.hincrby('stats:search_modes', event.data.mode, 1)
  }

  // Track database usage
  if (event.data.databases) {
    for (const dbId of event.data.databases) {
      await this.redisClient.zincrby('popular:databases', 1, dbId)
    }
  }
}

async getAnalytics(query: AnalyticsQuery): Promise<AnalyticsData> {
  try {
    const cacheKey = this.generateAnalyticsCacheKey(query)
    const cached = await this.get<AnalyticsData>(cacheKey)

    if (cached) {
      this.logger.debug('Analytics cache hit', { cacheKey })
      return cached
    }

    const data = await this.computeAnalytics(query)

    // Cache analytics data for 5 minutes
    await this.set(cacheKey, data, 300)

    return data

  } catch (error) {
    this.logger.error('Failed to get analytics', { error, query })
    throw new AppError('ANALYTICS_RETRIEVAL_FAILED', error.message)
  }
}

private async computeAnalytics(query: AnalyticsQuery): Promise<AnalyticsData> {
  const { type, dateRange, userId, filters, aggregation, groupBy } = query

  // Get time series data
  const timeSeriesData = await this.getTimeSeriesData(type, dateRange, aggregation || 'count')

  // Get aggregated metrics
  const aggregates = await this.getAggregatedMetrics(type, dateRange, filters)

  // Apply grouping if requested
  let groupedData: Record<string, any> = {}
  if (groupBy && groupBy.length > 0) {
    groupedData = await this.getGroupedAnalytics(type, dateRange, groupBy, aggregation)
  }

  return {
    type,
    dateRange,
    timeSeries: timeSeriesData,
    aggregates,
    grouped: groupedData,
    metadata: {
      computedAt: new Date(),
      dataPoints: timeSeriesData.length,
      cached: false
    }
  }
}
```

### Session Management

#### Redis-based Session Storage

The service provides comprehensive session management capabilities:

```typescript
interface SessionData {
  userId: string
  apiKeyId?: string
  permissions: string[]
  metadata: {
    userAgent?: string
    ip?: string
    createdAt: Date
    lastActivity: Date
    expiresAt: Date
  }
  preferences?: {
    defaultSearchMode?: SearchMode
    preferredDatabases?: string[]
    cachePreference?: boolean
  }
  temporaryData?: Record<string, any>
}

interface SessionConfig {
  defaultTTL: number
  extendOnActivity: boolean
  maxSessions: number
  secureMode: boolean
}

async createSession(userId: string, data: Partial<SessionData>): Promise<string> {
  try {
    const sessionId = this.generateSessionId()
    const now = new Date()

    const sessionData: SessionData = {
      userId,
      apiKeyId: data.apiKeyId,
      permissions: data.permissions || [],
      metadata: {
        userAgent: data.metadata?.userAgent,
        ip: data.metadata?.ip,
        createdAt: now,
        lastActivity: now,
        expiresAt: new Date(now.getTime() + this.config.session.defaultTTL)
      },
      preferences: data.preferences || {},
      temporaryData: {}
    }

    // Store session
    const sessionKey = `session:${sessionId}`
    await this.set(sessionKey, sessionData, this.config.session.defaultTTL / 1000)

    // Track user sessions
    await this.redisClient.sadd(`user_sessions:${userId}`, sessionId)
    await this.redisClient.expire(`user_sessions:${userId}`, this.config.session.defaultTTL / 1000)

    this.logger.info('Session created', {
      sessionId,
      userId,
      expiresAt: sessionData.metadata.expiresAt
    })

    return sessionId

  } catch (error) {
    this.logger.error('Failed to create session', { error, userId })
    throw new AppError('SESSION_CREATION_FAILED', error.message)
  }
}

async getSession(sessionId: string): Promise<SessionData | null> {
  try {
    const sessionKey = `session:${sessionId}`
    const session = await this.get<SessionData>(sessionKey)

    if (!session) {
      this.logger.debug('Session not found', { sessionId })
      return null
    }

    // Check if session is expired
    if (new Date() > new Date(session.metadata.expiresAt)) {
      await this.destroySession(sessionId)
      this.logger.debug('Session expired', { sessionId })
      return null
    }

    // Update last activity if configured
    if (this.config.session.extendOnActivity) {
      session.metadata.lastActivity = new Date()
      session.metadata.expiresAt = new Date(Date.now() + this.config.session.defaultTTL)
      await this.set(sessionKey, session, this.config.session.defaultTTL / 1000)
    }

    return session

  } catch (error) {
    this.logger.error('Failed to get session', { error, sessionId })
    return null
  }
}

async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
  try {
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new AppError('SESSION_NOT_FOUND', 'Session does not exist')
    }

    // Merge updates
    const updatedSession = {
      ...session,
      ...updates,
      metadata: {
        ...session.metadata,
        ...updates.metadata,
        lastActivity: new Date()
      }
    }

    const sessionKey = `session:${sessionId}`
    const remainingTTL = Math.max(0, Math.floor(
      (new Date(updatedSession.metadata.expiresAt).getTime() - Date.now()) / 1000
    ))

    await this.set(sessionKey, updatedSession, remainingTTL)

    this.logger.debug('Session updated', { sessionId })

  } catch (error) {
    this.logger.error('Failed to update session', { error, sessionId })
    throw new AppError('SESSION_UPDATE_FAILED', error.message)
  }
}

async destroySession(sessionId: string): Promise<boolean> {
  try {
    const session = await this.get<SessionData>(`session:${sessionId}`)

    // Delete session data
    const deleted = await this.del(`session:${sessionId}`)

    // Remove from user session tracking
    if (session?.userId) {
      await this.redisClient.srem(`user_sessions:${session.userId}`, sessionId)
    }

    this.logger.info('Session destroyed', { sessionId, found: deleted })

    return deleted

  } catch (error) {
    this.logger.error('Failed to destroy session', { error, sessionId })
    return false
  }
}

private generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substr(2)
  return `sess_${timestamp}_${random}`
}
```

### Health Monitoring and Statistics

#### Cache Health and Performance Monitoring

The service provides comprehensive health monitoring and performance statistics:

```typescript
interface CacheHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  redis: {
    connected: boolean
    responseTime: number
    memoryUsage: number
    hitRate: number
    keyCount: number
  }
  performance: {
    averageResponseTime: number
    operationsPerSecond: number
    errorRate: number
  }
  lastChecked: Date
}

interface CacheStats {
  operations: {
    gets: number
    sets: number
    deletes: number
    hits: number
    misses: number
    errors: number
  }
  performance: {
    averageGetTime: number
    averageSetTime: number
    hitRate: number
    errorRate: number
  }
  memory: {
    used: number
    peak: number
    fragmentation: number
  }
  connections: {
    total: number
    active: number
    idle: number
  }
}

async healthCheck(): Promise<CacheHealth> {
  const startTime = Date.now()

  try {
    // Test basic connectivity
    await this.redisClient.ping()
    const responseTime = Date.now() - startTime

    // Get Redis info
    const info = await this.redisClient.info()
    const memoryInfo = this.parseRedisInfo(info, 'memory')
    const statsInfo = this.parseRedisInfo(info, 'stats')

    // Calculate hit rate
    const hits = parseInt(statsInfo.keyspace_hits) || 0
    const misses = parseInt(statsInfo.keyspace_misses) || 0
    const hitRate = hits + misses > 0 ? hits / (hits + misses) : 0

    // Get key count
    const keyCount = await this.redisClient.dbsize()

    // Calculate performance metrics
    const performance = this.calculatePerformanceMetrics()

    const health: CacheHealth = {
      status: this.determineHealthStatus(responseTime, performance, hitRate),
      redis: {
        connected: true,
        responseTime,
        memoryUsage: parseInt(memoryInfo.used_memory) || 0,
        hitRate,
        keyCount
      },
      performance: {
        averageResponseTime: performance.averageResponseTime,
        operationsPerSecond: performance.operationsPerSecond,
        errorRate: performance.errorRate
      },
      lastChecked: new Date()
    }

    this.logger.debug('Cache health check completed', {
      status: health.status,
      responseTime,
      hitRate,
      keyCount
    })

    return health

  } catch (error) {
    this.logger.error('Cache health check failed', { error })

    return {
      status: 'unhealthy',
      redis: {
        connected: false,
        responseTime: Date.now() - startTime,
        memoryUsage: 0,
        hitRate: 0,
        keyCount: 0
      },
      performance: {
        averageResponseTime: 0,
        operationsPerSecond: 0,
        errorRate: 1
      },
      lastChecked: new Date()
    }
  }
}

async getStats(): Promise<CacheStats> {
  try {
    const info = await this.redisClient.info()
    const statsInfo = this.parseRedisInfo(info, 'stats')
    const memoryInfo = this.parseRedisInfo(info, 'memory')
    const clientsInfo = this.parseRedisInfo(info, 'clients')

    // Calculate internal metrics
    const performance = this.calculatePerformanceMetrics()

    const stats: CacheStats = {
      operations: {
        gets: this.metrics.get || 0,
        sets: this.metrics.set || 0,
        deletes: this.metrics.delete || 0,
        hits: this.metrics.hit || 0,
        misses: this.metrics.miss || 0,
        errors: this.metrics.error || 0
      },
      performance: {
        averageGetTime: performance.averageGetTime,
        averageSetTime: performance.averageSetTime,
        hitRate: performance.hitRate,
        errorRate: performance.errorRate
      },
      memory: {
        used: parseInt(memoryInfo.used_memory) || 0,
        peak: parseInt(memoryInfo.used_memory_peak) || 0,
        fragmentation: parseFloat(memoryInfo.mem_fragmentation_ratio) || 0
      },
      connections: {
        total: parseInt(clientsInfo.connected_clients) || 0,
        active: parseInt(clientsInfo.client_recent_max_input_buffer) || 0,
        idle: parseInt(clientsInfo.blocked_clients) || 0
      }
    }

    return stats

  } catch (error) {
    this.logger.error('Failed to get cache stats', { error })
    throw new AppError('CACHE_STATS_FAILED', error.message)
  }
}

private determineHealthStatus(
  responseTime: number,
  performance: any,
  hitRate: number
): 'healthy' | 'degraded' | 'unhealthy' {
  // Unhealthy conditions
  if (responseTime > 1000) return 'unhealthy'
  if (performance.errorRate > 0.1) return 'unhealthy'
  if (hitRate < 0.3) return 'unhealthy'

  // Degraded conditions
  if (responseTime > 100) return 'degraded'
  if (performance.errorRate > 0.01) return 'degraded'
  if (hitRate < 0.6) return 'degraded'

  return 'healthy'
}

private parseRedisInfo(info: string, section: string): Record<string, string> {
  const lines = info.split('\r\n')
  const sectionStart = lines.findIndex(line => line === `# ${section.charAt(0).toUpperCase() + section.slice(1)}`)

  if (sectionStart === -1) return {}

  const result: Record<string, string> = {}

  for (let i = sectionStart + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('#') || line === '') break

    const [key, value] = line.split(':')
    if (key && value) {
      result[key] = value
    }
  }

  return result
}
```

## Advanced Features

### Cache Warming and Preloading

```typescript
interface CacheWarmingStrategy {
  popularQueries: boolean
  recentSearches: boolean
  userPreferences: boolean
  staticData: boolean
}

async warmCache(strategy: CacheWarmingStrategy): Promise<void> {
  try {
    this.logger.info('Starting cache warming', { strategy })

    const tasks: Promise<void>[] = []

    if (strategy.popularQueries) {
      tasks.push(this.warmPopularQueries())
    }

    if (strategy.recentSearches) {
      tasks.push(this.warmRecentSearches())
    }

    if (strategy.userPreferences) {
      tasks.push(this.warmUserPreferences())
    }

    if (strategy.staticData) {
      tasks.push(this.warmStaticData())
    }

    await Promise.allSettled(tasks)

    this.logger.info('Cache warming completed')

  } catch (error) {
    this.logger.error('Cache warming failed', { error })
  }
}

private async warmPopularQueries(): Promise<void> {
  // Get popular queries from analytics
  const popularQueries = await this.redisClient.zrevrange('popular:queries', 0, 99, 'WITHSCORES')

  // Preload search results for popular queries
  for (let i = 0; i < popularQueries.length; i += 2) {
    const query = popularQueries[i]
    const score = popularQueries[i + 1]

    // Only warm queries with significant usage
    if (parseFloat(score) > 10) {
      await this.preloadSearchResults(query)
    }
  }
}
```

## Best Practices and Configuration

### Performance Optimization

1. **TTL Strategy**: Use appropriate TTLs based on data volatility
2. **Key Design**: Use consistent, hierarchical key naming patterns
3. **Batch Operations**: Group multiple operations when possible
4. **Memory Management**: Monitor memory usage and implement eviction policies
5. **Connection Pooling**: Use connection pooling for high-throughput scenarios

### Security Best Practices

1. **Access Control**: Implement proper Redis authentication
2. **Network Security**: Use TLS encryption for Redis connections
3. **Key Isolation**: Use key prefixes to isolate different applications
4. **Session Security**: Implement secure session management practices

---

**The CacheService provides the performance foundation for Altus 4, delivering fast response times and scalable analytics storage through intelligent Redis-based caching strategies.**
