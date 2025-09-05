---
title: Scaling Guide
description: Comprehensive scaling strategies for Altus 4 covering horizontal scaling, load balancing, database optimization, and performance tuning.
---

# Scaling Guide

This guide covers strategies for scaling Altus 4 to handle increased traffic and data volumes, from small deployments to enterprise-scale operations.

## Scaling Overview

Altus 4 is designed as a stateless application that can scale horizontally. The main components that need scaling consideration are:

- **Application Servers**: Node.js instances handling API requests
- **Database Layer**: MySQL connections and query performance
- **Cache Layer**: Redis for session and result caching
- **Load Balancing**: Request distribution and failover
- **AI Services**: OpenAI API rate limiting and fallback handling

## Scaling Metrics

### Key Performance Indicators

Monitor these metrics to determine when scaling is needed:

- **Response Time**: Average and P95 response times
- **Request Rate**: Requests per second (RPS)
- **Error Rate**: Percentage of failed requests
- **Database Performance**: Query execution time and connection usage
- **Cache Hit Rate**: Redis cache effectiveness
- **Resource Utilization**: CPU, memory, and network usage

### Scaling Triggers

Consider scaling when you observe:

- Consistent response times > 500ms
- CPU utilization > 70% sustained
- Memory usage > 80% sustained
- Database connection pool exhaustion
- Cache hit rates < 80%
- Error rates > 1%

## Horizontal Scaling

### Load Balancer Configuration

#### NGINX Load Balancer

```nginx
upstream altus4_backend {
    least_conn;
    server 10.0.1.10:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.13:3000 max_fails=3 fail_timeout=30s backup;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name api.altus4.com;

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://altus4_backend;
        proxy_connect_timeout 1s;
        proxy_timeout 1s;
    }

    # API endpoints
    location /api/ {
        proxy_pass http://altus4_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Connection pooling
        proxy_http_version 1.1;
        proxy_set_header Connection "";

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 30s;

        # Retry failed requests
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_next_upstream_tries 2;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
}
```

#### HAProxy Configuration

```haproxy
global
    maxconn 4096
    daemon

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms

    option httplog
    option dontlognull
    option redispatch
    retries 3

frontend altus4_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/altus4.pem
    redirect scheme https if !{ ssl_fc }

    # Health check
    acl health_check path_beg /health
    use_backend altus4_health if health_check

    # API requests
    default_backend altus4_backend

backend altus4_backend
    balance leastconn
    option httpchk GET /health

    server app1 10.0.1.10:3000 check
    server app2 10.0.1.11:3000 check
    server app3 10.0.1.12:3000 check
    server app4 10.0.1.13:3000 check backup

backend altus4_health
    balance roundrobin
    server app1 10.0.1.10:3000 check
    server app2 10.0.1.11:3000 check
```

### Auto-Scaling with Docker Swarm

#### Docker Swarm Service

```yaml
version: '3.8'
services:
  altus4-api:
    image: altus4/api:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      - NODE_ENV=production
      - DB_HOST=mysql-cluster
      - REDIS_HOST=redis-cluster
    networks:
      - altus4-network
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3

  mysql:
    image: mysql:8.0
    deploy:
      replicas: 1
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
    volumes:
      - mysql-data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    deploy:
      replicas: 1
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
    volumes:
      - redis-data:/data

networks:
  altus4-network:
    driver: overlay

volumes:
  mysql-data:
  redis-data:
```

### Kubernetes Auto-Scaling

#### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: altus4-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: altus4-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 180
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

#### Vertical Pod Autoscaler

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: altus4-api-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: altus4-api
  updatePolicy:
    updateMode: 'Auto'
  resourcePolicy:
    containerPolicies:
      - containerName: altus4-api
        maxAllowed:
          cpu: 2
          memory: 4Gi
        minAllowed:
          cpu: 100m
          memory: 128Mi
```

## Database Scaling

### MySQL Read Replicas

#### Master-Slave Configuration

```sql
-- Master configuration (my.cnf)
[mysqld]
server-id = 1
log-bin = mysql-bin
binlog-do-db = altus4_production
binlog-format = mixed
max_connections = 500
innodb_buffer_pool_size = 2G
```

```sql
-- Slave configuration (my.cnf)
[mysqld]
server-id = 2
relay-log = mysql-relay-bin
read_only = 1
max_connections = 200
innodb_buffer_pool_size = 1G
```

#### Connection Pool Configuration

```typescript
// Read-write splitting in DatabaseService
class DatabaseService {
  private readonly writePool: mysql.Pool;
  private readonly readPools: mysql.Pool[];

  constructor() {
    // Write pool (master)
    this.writePool = mysql.createPool({
      host: process.env.DB_WRITE_HOST,
      port: 3306,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      connectionLimit: 20,
      queueLimit: 50,
    });

    // Read pools (slaves)
    this.readPools = [
      mysql.createPool({
        host: process.env.DB_READ_HOST_1,
        // ... similar configuration with lower connection limit
        connectionLimit: 10,
      }),
      mysql.createPool({
        host: process.env.DB_READ_HOST_2,
        connectionLimit: 10,
      }),
    ];
  }

  async executeQuery(query: string, params: any[], forceWrite = false): Promise<any> {
    const isWriteOperation = forceWrite || this.isWriteQuery(query);
    const pool = isWriteOperation ? this.writePool : this.getReadPool();

    return pool.execute(query, params);
  }

  private getReadPool(): mysql.Pool {
    // Round-robin or least-connections selection
    return this.readPools[Math.floor(Math.random() * this.readPools.length)];
  }

  private isWriteQuery(query: string): boolean {
    const writeKeywords = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER'];
    return writeKeywords.some(keyword => query.trim().toUpperCase().startsWith(keyword));
  }
}
```

### Database Connection Pooling

```typescript
// Dynamic connection pool sizing
class ConnectionPoolManager {
  private pools: Map<string, mysql.Pool> = new Map();

  createPool(config: DatabaseConfig): mysql.Pool {
    const poolSize = this.calculatePoolSize(config);

    const pool = mysql.createPool({
      ...config,
      connectionLimit: poolSize.max,
      queueLimit: poolSize.queue,
      timeout: 60000,
      acquireTimeout: 60000,

      // Connection management
      reconnect: true,
      idleTimeout: 300000,
      maxIdle: Math.floor(poolSize.max * 0.5),

      // Performance settings
      multipleStatements: false,
      queryTimeout: 30000,
    });

    return pool;
  }

  private calculatePoolSize(config: DatabaseConfig): PoolConfig {
    const baseCPUs = os.cpus().length;
    const expectedConcurrency = parseInt(process.env.EXPECTED_CONCURRENCY || '100');

    return {
      max: Math.min(baseCPUs * 2, Math.ceil(expectedConcurrency / 10)),
      queue: expectedConcurrency * 2,
    };
  }
}
```

## Redis Scaling

### Redis Cluster Configuration

#### Redis Cluster Setup

```bash
# Create Redis cluster nodes
redis-server --port 7000 --cluster-enabled yes --cluster-config-file nodes-7000.conf
redis-server --port 7001 --cluster-enabled yes --cluster-config-file nodes-7001.conf
redis-server --port 7002 --cluster-enabled yes --cluster-config-file nodes-7002.conf
redis-server --port 7003 --cluster-enabled yes --cluster-config-file nodes-7003.conf
redis-server --port 7004 --cluster-enabled yes --cluster-config-file nodes-7004.conf
redis-server --port 7005 --cluster-enabled yes --cluster-config-file nodes-7005.conf

# Initialize cluster
redis-cli --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 --cluster-replicas 1
```

#### Redis Cluster Client Configuration

```typescript
import Redis from 'ioredis';

class CacheService {
  private redis: Redis.Cluster;

  constructor() {
    this.redis = new Redis.Cluster(
      [
        { host: '127.0.0.1', port: 7000 },
        { host: '127.0.0.1', port: 7001 },
        { host: '127.0.0.1', port: 7002 },
      ],
      {
        clusterRetryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableOfflineQueue: false,
        redisOptions: {
          password: process.env.REDIS_PASSWORD,
          connectTimeout: 1000,
          commandTimeout: 5000,
        },
      }
    );
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      logger.error('Cache get failed', { key, error });
      return null; // Graceful degradation
    }
  }
}
```

### Redis Sentinel for High Availability

```javascript
const Redis = require('ioredis');

const redis = new Redis({
  sentinels: [
    { host: '127.0.0.1', port: 26379 },
    { host: '127.0.0.1', port: 26380 },
    { host: '127.0.0.1', port: 26381 },
  ],
  name: 'altus4-master',
  role: 'master',
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});
```

## Application-Level Scaling

### Connection Pool Management

```typescript
class DatabaseConnectionManager {
  private pools: Map<string, mysql.Pool> = new Map();
  private healthChecks: Map<string, NodeJS.Timeout> = new Map();

  async createPool(databaseId: string, config: DatabaseConfig): Promise<mysql.Pool> {
    const pool = mysql.createPool({
      ...config,
      connectionLimit: this.calculateConnectionLimit(),
      queueLimit: this.calculateQueueLimit(),

      // Health monitoring
      pingInterval: 60000,
      reconnect: true,
      timeout: 60000,
    });

    // Start health monitoring
    this.startHealthCheck(databaseId, pool);
    this.pools.set(databaseId, pool);

    return pool;
  }

  private calculateConnectionLimit(): number {
    const cpuCores = os.cpus().length;
    const memoryGB = Math.floor(os.totalmem() / 1024 ** 3);
    const baseConnections = Math.max(cpuCores * 2, 10);

    // Scale based on available memory
    return Math.min(baseConnections + Math.floor(memoryGB / 2), 50);
  }

  private startHealthCheck(databaseId: string, pool: mysql.Pool): void {
    const interval = setInterval(async () => {
      try {
        await pool.execute('SELECT 1');
      } catch (error) {
        logger.error('Database health check failed', { databaseId, error });
        // Implement reconnection logic
        await this.reconnectPool(databaseId);
      }
    }, 30000);

    this.healthChecks.set(databaseId, interval);
  }
}
```

### AI Service Scaling

```typescript
class AIService {
  private requestQueue: Queue = new Queue();
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 60,
      interval: 'minute',
    });
  }

  async enhanceSearchResults(results: SearchResult[]): Promise<EnhancedResult[]> {
    // Check rate limit
    const allowed = await this.rateLimiter.removeTokens(1);
    if (!allowed) {
      logger.warn('AI service rate limited, using fallback');
      return this.fallbackEnhancement(results);
    }

    // Queue request to handle burst traffic
    return new Promise((resolve, reject) => {
      this.requestQueue.add(async () => {
        try {
          const enhanced = await this.callOpenAI(results);
          resolve(enhanced);
        } catch (error) {
          logger.error('AI enhancement failed', { error });
          resolve(this.fallbackEnhancement(results));
        }
      });
    });
  }

  private fallbackEnhancement(results: SearchResult[]): EnhancedResult[] {
    // Implement basic enhancement without AI
    return results.map(result => ({
      ...result,
      category: this.basicCategorization(result),
      summary: this.extractSummary(result.content),
    }));
  }
}
```

## Monitoring Scaling Performance

### Custom Metrics

```typescript
class MetricsCollector {
  private prometheus = require('prom-client');

  constructor() {
    // Application metrics
    this.requestDuration = new this.prometheus.Histogram({
      name: 'altus4_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    this.activeConnections = new this.prometheus.Gauge({
      name: 'altus4_database_connections_active',
      help: 'Number of active database connections',
      labelNames: ['database_id'],
    });

    this.cacheHitRatio = new this.prometheus.Gauge({
      name: 'altus4_cache_hit_ratio',
      help: 'Cache hit ratio',
      labelNames: ['cache_type'],
    });

    this.searchLatency = new this.prometheus.Histogram({
      name: 'altus4_search_duration_seconds',
      help: 'Search operation duration',
      labelNames: ['search_mode', 'database_count'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    });
  }
}
```

### Performance Benchmarking

```typescript
class PerformanceBenchmark {
  async runLoadTest(config: LoadTestConfig): Promise<BenchmarkResults> {
    const results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      throughput: 0,
    };

    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    for (let i = 0; i < config.concurrentUsers; i++) {
      promises.push(this.simulateUser(config.duration));
    }

    await Promise.allSettled(promises);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    results.throughput = results.totalRequests / duration;

    return results;
  }

  private async simulateUser(duration: number): Promise<void> {
    const endTime = Date.now() + duration * 1000;

    while (Date.now() < endTime) {
      const startTime = Date.now();
      try {
        await this.makeRequest();
        const latency = Date.now() - startTime;
        this.recordLatency(latency);
      } catch (error) {
        this.recordError(error);
      }

      // Wait between requests
      await this.sleep(Math.random() * 1000);
    }
  }
}
```

## Scaling Checklist

### Infrastructure Scaling

- [ ] Load balancer configured with health checks
- [ ] Application servers auto-scaling enabled
- [ ] Database read replicas configured
- [ ] Redis cluster or sentinel setup
- [ ] CDN configured for static assets
- [ ] Monitoring and alerting configured

### Application Scaling

- [ ] Connection pooling optimized
- [ ] Caching strategy implemented
- [ ] Rate limiting configured
- [ ] Circuit breakers implemented
- [ ] Graceful degradation for external services
- [ ] Async processing for heavy operations

### Database Scaling

- [ ] Read-write splitting implemented
- [ ] Connection pool sizing optimized
- [ ] Query optimization completed
- [ ] Indexes analyzed and optimized
- [ ] Database monitoring configured
- [ ] Backup strategy scales with data

### Performance Validation

- [ ] Load testing completed
- [ ] Performance benchmarks established
- [ ] Scaling triggers defined
- [ ] Monitoring dashboards created
- [ ] Alert thresholds configured
- [ ] Disaster recovery tested

## Scaling Best Practices

1. **Monitor First**: Establish comprehensive monitoring before scaling
2. **Scale Gradually**: Increase capacity incrementally to validate changes
3. **Test Scaling**: Use staging environments to test scaling configurations
4. **Plan for Failures**: Implement circuit breakers and fallback mechanisms
5. **Cache Aggressively**: Use multi-level caching to reduce database load
6. **Optimize Queries**: Ensure all database queries are optimized before scaling
7. **Monitor Costs**: Track infrastructure costs as you scale
8. **Document Changes**: Keep scaling procedures documented and updated
