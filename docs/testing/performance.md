---
title: Performance Testing Guide
description: Comprehensive guide to performance testing in Altus 4 covering load testing, stress testing, and performance optimization strategies.
---

# Performance Testing Guide

Comprehensive Performance Testing for Altus 4

Performance testing ensures that Altus 4 meets performance requirements under various load conditions. This guide covers load testing, stress testing, benchmarking, and performance optimization strategies.

## Performance Testing Philosophy

### Testing Objectives

Performance testing aims to:

- **Verify Response Times**: Ensure API endpoints meet SLA requirements
- **Identify Bottlenecks**: Find performance limitations in the system
- **Test Scalability**: Verify system behavior under increasing load
- **Validate Stability**: Ensure system remains stable under sustained load
- **Optimize Resource Usage**: Identify memory leaks and inefficient resource usage
- **Benchmark Performance**: Establish baseline performance metrics

### Types of Performance Testing

| Test Type             | Purpose                | Load Pattern                  | Duration      |
| --------------------- | ---------------------- | ----------------------------- | ------------- |
| **Load Testing**      | Normal expected load   | Gradual increase to target    | 10-30 minutes |
| **Stress Testing**    | Beyond normal capacity | Rapid increase past limits    | 5-15 minutes  |
| **Spike Testing**     | Sudden load increases  | Sharp spikes in traffic       | 2-10 minutes  |
| **Volume Testing**    | Large amounts of data  | Steady load with big datasets | 30-60 minutes |
| **Endurance Testing** | Extended periods       | Constant load over time       | 2-24 hours    |

## Performance Requirements

### Service Level Objectives (SLOs)

```typescript
// Performance benchmarks for Altus 4
export const performanceTargets = {
  search: {
    // Response time targets
    averageResponseTime: 150, // ms
    p95ResponseTime: 300, // ms
    p99ResponseTime: 500, // ms

    // Throughput targets
    requestsPerSecond: 1000,
    concurrentUsers: 500,

    // Error rate targets
    errorRate: 0.01, // 1%
    timeoutRate: 0.005, // 0.5%
  },

  database: {
    connectionTime: 50, // ms
    queryExecutionTime: 100, // ms
    poolUtilization: 0.8, // 80% max
    connectionPoolSize: 10,
  },

  cache: {
    hitRate: 0.85, // 85%
    responseTime: 5, // ms
    memoryUsage: 100, // MB max
    evictionRate: 0.1, // 10% max
  },

  system: {
    cpuUtilization: 0.7, // 70% max
    memoryUtilization: 0.8, // 80% max
    diskUtilization: 0.6, // 60% max
    networkLatency: 10, // ms max
  },
};
```

## Load Testing

### Basic Load Testing Setup

```typescript
// tests/performance/load/basic-load.test.ts
import { performance } from 'perf_hooks';
import request from 'supertest';
import { TestServer } from '../../helpers/test-server';
import { createTestUser, createTestApiKey, createTestDatabase } from '../../helpers/auth-helpers';

describe('Basic Load Testing', () => {
  let testServer: TestServer;
  let baseUrl: string;
  let testApiKey: string;
  let testDatabaseId: string;

  beforeAll(async () => {
    testServer = new TestServer();
    await testServer.start();
    baseUrl = testServer.getBaseUrl();

    const testUser = await createTestUser();
    testApiKey = await createTestApiKey(testUser.id);
    testDatabaseId = await createTestDatabase(testUser.id);
  });

  afterAll(async () => {
    await testServer.stop();
  });

  describe('Search API Load Testing', () => {
    it('should handle sustained load', async () => {
      const testDuration = 30000; // 30 seconds
      const targetRPS = 50; // 50 requests per second
      const requestInterval = 1000 / targetRPS; // ms between requests

      const results: PerformanceResult[] = [];
      const startTime = Date.now();
      let requestCount = 0;

      // Generate load for specified duration
      while (Date.now() - startTime < testDuration) {
        const requestStartTime = performance.now();

        try {
          const response = await request(baseUrl)
            .post('/api/v1/search')
            .set('Authorization', `Bearer ${testApiKey}`)
            .send({
              query: `load test query ${requestCount}`,
              databases: [testDatabaseId],
              limit: 10,
            });

          const requestEndTime = performance.now();
          const responseTime = requestEndTime - requestStartTime;

          results.push({
            requestId: requestCount,
            responseTime,
            statusCode: response.status,
            success: response.status === 200,
            timestamp: Date.now(),
          });
        } catch (error) {
          results.push({
            requestId: requestCount,
            responseTime: -1,
            statusCode: 0,
            success: false,
            error: error.message,
            timestamp: Date.now(),
          });
        }

        requestCount++;

        // Wait for next request interval
        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      // Analyze results
      const analysis = analyzePerformanceResults(results);

      // Performance assertions
      expect(analysis.totalRequests).toBeGreaterThan(0);
      expect(analysis.successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(analysis.averageResponseTime).toBeLessThan(500); // < 500ms average
      expect(analysis.p95ResponseTime).toBeLessThan(1000); // < 1s P95
      expect(analysis.actualRPS).toBeGreaterThan(targetRPS * 0.8); // Within 20% of target

      console.log('Load Test Results:', analysis);
    });

    it('should handle concurrent users', async () => {
      const concurrentUsers = 20;
      const requestsPerUser = 10;

      // Create concurrent user simulations
      const userPromises = Array.from({ length: concurrentUsers }, async (_, userId) => {
        const userResults: PerformanceResult[] = [];

        for (let requestId = 0; requestId < requestsPerUser; requestId++) {
          const startTime = performance.now();

          try {
            const response = await request(baseUrl)
              .post('/api/v1/search')
              .set('Authorization', `Bearer ${testApiKey}`)
              .send({
                query: `concurrent user ${userId} request ${requestId}`,
                databases: [testDatabaseId],
                limit: 10,
              });

            const endTime = performance.now();

            userResults.push({
              requestId: `${userId}-${requestId}`,
              responseTime: endTime - startTime,
              statusCode: response.status,
              success: response.status === 200,
              timestamp: Date.now(),
            });
          } catch (error) {
            userResults.push({
              requestId: `${userId}-${requestId}`,
              responseTime: -1,
              statusCode: 0,
              success: false,
              error: error.message,
              timestamp: Date.now(),
            });
          }

          // Small delay between requests from same user
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        return userResults;
      });

      // Execute all user simulations concurrently
      const allUserResults = await Promise.all(userPromises);
      const allResults = allUserResults.flat();

      // Analyze results
      const analysis = analyzePerformanceResults(allResults);

      // Performance assertions
      expect(analysis.totalRequests).toBe(concurrentUsers * requestsPerUser);
      expect(analysis.successRate).toBeGreaterThan(0.9); // 90% success rate
      expect(analysis.averageResponseTime).toBeLessThan(1000); // < 1s average
      expect(analysis.maxResponseTime).toBeLessThan(5000); // < 5s max

      console.log('Concurrent Users Test Results:', analysis);
    });
  });

  describe('Database Load Testing', () => {
    it('should handle database query load', async () => {
      const { DatabaseService } = await import('@/services/DatabaseService');
      const databaseService = new DatabaseService();

      const queryCount = 100;
      const concurrentQueries = 10;
      const batches = Math.ceil(queryCount / concurrentQueries);

      const results: PerformanceResult[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = Array.from({ length: concurrentQueries }, async (_, queryId) => {
          const globalQueryId = batch * concurrentQueries + queryId;
          const startTime = performance.now();

          try {
            const queryResults = await databaseService.executeFullTextSearch(
              testDatabaseId,
              `database load test query ${globalQueryId}`,
              ['test_articles'],
              ['title', 'content'],
              10,
              0
            );

            const endTime = performance.now();

            return {
              requestId: globalQueryId,
              responseTime: endTime - startTime,
              statusCode: 200,
              success: true,
              resultCount: queryResults.length,
              timestamp: Date.now(),
            };
          } catch (error) {
            const endTime = performance.now();

            return {
              requestId: globalQueryId,
              responseTime: endTime - startTime,
              statusCode: 500,
              success: false,
              error: error.message,
              timestamp: Date.now(),
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      // Analyze database performance
      const analysis = analyzePerformanceResults(results);

      expect(analysis.successRate).toBeGreaterThan(0.95);
      expect(analysis.averageResponseTime).toBeLessThan(200); // Database queries should be fast
      expect(analysis.p95ResponseTime).toBeLessThan(500);

      console.log('Database Load Test Results:', analysis);
    });
  });
});

interface PerformanceResult {
  requestId: string | number;
  responseTime: number;
  statusCode: number;
  success: boolean;
  error?: string;
  resultCount?: number;
  timestamp: number;
}

function analyzePerformanceResults(results: PerformanceResult[]) {
  const successfulResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);
  const responseTimes = successfulResults.map(r => r.responseTime).sort((a, b) => a - b);

  const totalRequests = results.length;
  const successfulRequests = successfulResults.length;
  const successRate = successfulRequests / totalRequests;

  const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const minResponseTime = responseTimes[0] || 0;
  const maxResponseTime = responseTimes[responseTimes.length - 1] || 0;
  const p50ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
  const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
  const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;

  // Calculate RPS
  const timeSpan =
    Math.max(...results.map(r => r.timestamp)) - Math.min(...results.map(r => r.timestamp));
  const actualRPS = (totalRequests / timeSpan) * 1000; // Convert to per second

  return {
    totalRequests,
    successfulRequests,
    failedRequests: failedResults.length,
    successRate: Math.round(successRate * 100) / 100,
    averageResponseTime: Math.round(averageResponseTime),
    minResponseTime: Math.round(minResponseTime),
    maxResponseTime: Math.round(maxResponseTime),
    p50ResponseTime: Math.round(p50ResponseTime),
    p95ResponseTime: Math.round(p95ResponseTime),
    p99ResponseTime: Math.round(p99ResponseTime),
    actualRPS: Math.round(actualRPS * 100) / 100,
    errors: failedResults.map(r => r.error).filter(Boolean),
  };
}
```

### Advanced Load Testing

```typescript
// tests/performance/load/advanced-load.test.ts
import { LoadTestRunner } from '../../helpers/load-test-runner';

describe('Advanced Load Testing', () => {
  let loadTestRunner: LoadTestRunner;

  beforeAll(async () => {
    loadTestRunner = new LoadTestRunner({
      baseUrl: 'http://localhost:3000',
      apiKey: process.env.TEST_API_KEY!,
      databaseId: process.env.TEST_DATABASE_ID!,
    });
  });

  describe('Gradual Load Increase', () => {
    it('should handle gradual load increase', async () => {
      const testConfig = {
        phases: [
          { duration: 60000, targetRPS: 10 }, // 1 min at 10 RPS
          { duration: 60000, targetRPS: 25 }, // 1 min at 25 RPS
          { duration: 60000, targetRPS: 50 }, // 1 min at 50 RPS
          { duration: 60000, targetRPS: 100 }, // 1 min at 100 RPS
          { duration: 60000, targetRPS: 50 }, // 1 min back to 50 RPS
        ],
      };

      const results = await loadTestRunner.runPhaseTest(testConfig);

      // Analyze results by phase
      results.phases.forEach((phase, index) => {
        expect(phase.successRate).toBeGreaterThan(0.95);
        expect(phase.averageResponseTime).toBeLessThan(1000);

        console.log(`Phase ${index + 1} (${testConfig.phases[index].targetRPS} RPS):`, {
          successRate: phase.successRate,
          avgResponseTime: phase.averageResponseTime,
          p95ResponseTime: phase.p95ResponseTime,
        });
      });
    });
  });

  describe('Mixed Workload Testing', () => {
    it('should handle mixed API operations', async () => {
      const workloadConfig = {
        duration: 120000, // 2 minutes
        operations: [
          {
            name: 'search',
            weight: 70, // 70% of requests
            endpoint: '/api/v1/search',
            method: 'POST',
            payload: {
              query: 'mixed workload test',
              databases: ['test-db'],
              limit: 10,
            },
          },
          {
            name: 'suggestions',
            weight: 20, // 20% of requests
            endpoint: '/api/v1/search/suggestions',
            method: 'GET',
            params: {
              query: 'mixed workload',
              limit: 5,
            },
          },
          {
            name: 'history',
            weight: 10, // 10% of requests
            endpoint: '/api/v1/search/history',
            method: 'GET',
            params: {
              limit: 20,
            },
          },
        ],
        targetRPS: 50,
      };

      const results = await loadTestRunner.runMixedWorkloadTest(workloadConfig);

      // Verify each operation type
      results.operationResults.forEach(opResult => {
        expect(opResult.successRate).toBeGreaterThan(0.9);
        expect(opResult.averageResponseTime).toBeLessThan(1000);

        console.log(`${opResult.name} operation:`, {
          requests: opResult.totalRequests,
          successRate: opResult.successRate,
          avgResponseTime: opResult.averageResponseTime,
        });
      });
    });
  });
});
```

## Stress Testing

### System Stress Testing

```typescript
// tests/performance/stress/system-stress.test.ts
import { StressTestRunner } from '../../helpers/stress-test-runner';

describe('System Stress Testing', () => {
  let stressTestRunner: StressTestRunner;

  beforeAll(async () => {
    stressTestRunner = new StressTestRunner({
      baseUrl: 'http://localhost:3000',
      apiKey: process.env.TEST_API_KEY!,
    });
  });

  describe('Breaking Point Testing', () => {
    it('should find system breaking point', async () => {
      const stressConfig = {
        startRPS: 50,
        maxRPS: 500,
        rpsIncrement: 50,
        phaseLength: 30000, // 30 seconds per phase
        failureThreshold: 0.05, // 5% error rate threshold
      };

      const results = await stressTestRunner.findBreakingPoint(stressConfig);

      expect(results.breakingPointRPS).toBeGreaterThan(stressConfig.startRPS);
      expect(results.maxStableRPS).toBeLessThanOrEqual(results.breakingPointRPS);

      console.log('Stress Test Results:', {
        maxStableRPS: results.maxStableRPS,
        breakingPointRPS: results.breakingPointRPS,
        maxResponseTime: results.maxResponseTime,
        errorRate: results.errorRate,
      });

      // System should handle at least 100 RPS
      expect(results.maxStableRPS).toBeGreaterThan(100);
    });
  });

  describe('Resource Exhaustion Testing', () => {
    it('should handle memory pressure', async () => {
      const memoryStressConfig = {
        duration: 300000, // 5 minutes
        targetRPS: 100,
        largePayloadSize: 10000, // 10KB payloads
        monitorMemory: true,
      };

      const results = await stressTestRunner.runMemoryStressTest(memoryStressConfig);

      // System should not crash under memory pressure
      expect(results.systemCrashed).toBe(false);
      expect(results.memoryLeakDetected).toBe(false);
      expect(results.finalSuccessRate).toBeGreaterThan(0.8);

      console.log('Memory Stress Results:', {
        peakMemoryUsage: results.peakMemoryUsage,
        memoryGrowthRate: results.memoryGrowthRate,
        gcFrequency: results.gcFrequency,
      });
    });

    it('should handle connection pool exhaustion', async () => {
      const connectionStressConfig = {
        duration: 180000, // 3 minutes
        targetRPS: 200,
        connectionHoldTime: 5000, // Hold connections for 5 seconds
        maxConcurrentConnections: 100,
      };

      const results = await stressTestRunner.runConnectionStressTest(connectionStressConfig);

      // System should gracefully handle connection limits
      expect(results.connectionErrors).toBeLessThan(results.totalRequests * 0.1);
      expect(results.timeoutErrors).toBeLessThan(results.totalRequests * 0.05);

      console.log('Connection Stress Results:', {
        peakConnections: results.peakConnections,
        connectionErrors: results.connectionErrors,
        timeoutErrors: results.timeoutErrors,
      });
    });
  });

  describe('Spike Testing', () => {
    it('should handle traffic spikes', async () => {
      const spikeConfig = {
        baselineRPS: 20,
        spikeRPS: 200,
        spikeDuration: 30000, // 30 seconds
        recoveryTime: 60000, // 1 minute recovery
        numberOfSpikes: 3,
      };

      const results = await stressTestRunner.runSpikeTest(spikeConfig);

      // System should recover from spikes
      results.spikes.forEach((spike, index) => {
        expect(spike.recoveryTime).toBeLessThan(30000); // Recover within 30 seconds
        expect(spike.errorsDuringSpike).toBeLessThan(spike.requestsDuringSpike * 0.2);

        console.log(`Spike ${index + 1}:`, {
          peakRPS: spike.peakRPS,
          recoveryTime: spike.recoveryTime,
          errorRate: spike.errorsDuringSpike / spike.requestsDuringSpike,
        });
      });
    });
  });
});
```

## Performance Monitoring

### Real-time Performance Monitoring

```typescript
// tests/performance/monitoring/performance-monitor.ts
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private isMonitoring = false;

  async startMonitoring(interval: number = 1000): Promise<void> {
    this.isMonitoring = true;

    const monitoringLoop = async () => {
      while (this.isMonitoring) {
        const timestamp = Date.now();

        // Collect application metrics
        const appMetrics = await this.collectApplicationMetrics();
        this.metrics.push({ ...appMetrics, timestamp });

        // Collect system metrics
        const sysMetrics = await this.collectSystemMetrics();
        this.systemMetrics.push({ ...sysMetrics, timestamp });

        await new Promise(resolve => setTimeout(resolve, interval));
      }
    };

    monitoringLoop();
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
  }

  private async collectApplicationMetrics(): Promise<Partial<PerformanceMetrics>> {
    const memUsage = process.memoryUsage();

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      eventLoopDelay: await this.measureEventLoopDelay(),
      activeHandles: (process as any)._getActiveHandles().length,
      activeRequests: (process as any)._getActiveRequests().length,
    };
  }

  private async collectSystemMetrics(): Promise<Partial<SystemMetrics>> {
    const cpuUsage = process.cpuUsage();

    return {
      cpuUser: cpuUsage.user,
      cpuSystem: cpuUsage.system,
      uptime: process.uptime(),
      loadAverage: require('os').loadavg(),
    };
  }

  private async measureEventLoopDelay(): Promise<number> {
    return new Promise(resolve => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        resolve(delay);
      });
    });
  }

  getMetricsSummary(): PerformanceSummary {
    const heapUsages = this.metrics.map(m => m.heapUsed).filter(Boolean) as number[];
    const eventLoopDelays = this.metrics.map(m => m.eventLoopDelay).filter(Boolean) as number[];

    return {
      duration:
        this.metrics.length > 0
          ? this.metrics[this.metrics.length - 1].timestamp - this.metrics[0].timestamp
          : 0,

      memory: {
        avgHeapUsed: this.average(heapUsages),
        maxHeapUsed: Math.max(...heapUsages),
        minHeapUsed: Math.min(...heapUsages),
      },

      eventLoop: {
        avgDelay: this.average(eventLoopDelays),
        maxDelay: Math.max(...eventLoopDelays),
        p95Delay: this.percentile(eventLoopDelays, 0.95),
      },

      handles: {
        avgActive: this.average(this.metrics.map(m => m.activeHandles).filter(Boolean) as number[]),
        maxActive: Math.max(
          ...(this.metrics.map(m => m.activeHandles).filter(Boolean) as number[])
        ),
      },
    };
  }

  private average(numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private percentile(numbers: number[], p: number): number {
    const sorted = numbers.sort((a, b) => a - b);
    const index = Math.floor(sorted.length * p);
    return sorted[index];
  }
}

interface PerformanceMetrics {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  eventLoopDelay: number;
  activeHandles: number;
  activeRequests: number;
}

interface SystemMetrics {
  timestamp: number;
  cpuUser: number;
  cpuSystem: number;
  uptime: number;
  loadAverage: number[];
}

interface PerformanceSummary {
  duration: number;
  memory: {
    avgHeapUsed: number;
    maxHeapUsed: number;
    minHeapUsed: number;
  };
  eventLoop: {
    avgDelay: number;
    maxDelay: number;
    p95Delay: number;
  };
  handles: {
    avgActive: number;
    maxActive: number;
  };
}
```

### Database Performance Testing

```typescript
// tests/performance/database/database-performance.test.ts
import { DatabaseService } from '@/services/DatabaseService';
import { PerformanceMonitor } from '../monitoring/performance-monitor';

describe('Database Performance Testing', () => {
  let databaseService: DatabaseService;
  let performanceMonitor: PerformanceMonitor;

  beforeAll(async () => {
    databaseService = new DatabaseService();
    performanceMonitor = new PerformanceMonitor();
  });

  describe('Query Performance', () => {
    it('should execute queries within performance targets', async () => {
      const testQueries = [
        'mysql performance optimization',
        'database indexing strategies',
        'query performance tuning',
        'full text search optimization',
        'connection pool management',
      ];

      await performanceMonitor.startMonitoring(500); // Monitor every 500ms

      const queryResults = [];

      for (const query of testQueries) {
        const iterations = 20;
        const queryTimes = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();

          await databaseService.executeFullTextSearch(
            'test-db-id',
            query,
            ['test_articles'],
            ['title', 'content'],
            20,
            0
          );

          const endTime = performance.now();
          queryTimes.push(endTime - startTime);
        }

        const avgTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
        const maxTime = Math.max(...queryTimes);
        const minTime = Math.min(...queryTimes);

        queryResults.push({
          query,
          avgTime,
          maxTime,
          minTime,
          iterations,
        });

        // Performance assertions
        expect(avgTime).toBeLessThan(100); // Average < 100ms
        expect(maxTime).toBeLessThan(500); // Max < 500ms
      }

      performanceMonitor.stopMonitoring();
      const summary = performanceMonitor.getMetricsSummary();

      console.log('Query Performance Results:', queryResults);
      console.log('System Performance Summary:', summary);

      // System performance assertions
      expect(summary.eventLoop.avgDelay).toBeLessThan(10); // Event loop delay < 10ms
      expect(summary.memory.maxHeapUsed).toBeLessThan(100 * 1024 * 1024); // Max heap < 100MB
    });

    it('should handle concurrent database connections', async () => {
      const concurrentConnections = 20;
      const queriesPerConnection = 10;

      const connectionPromises = Array.from(
        { length: concurrentConnections },
        async (_, connId) => {
          const connectionResults = [];

          for (let queryId = 0; queryId < queriesPerConnection; queryId++) {
            const startTime = performance.now();

            try {
              const results = await databaseService.executeFullTextSearch(
                'test-db-id',
                `concurrent query ${connId}-${queryId}`,
                ['test_articles'],
                ['title', 'content'],
                10,
                0
              );

              const endTime = performance.now();

              connectionResults.push({
                connectionId: connId,
                queryId,
                responseTime: endTime - startTime,
                resultCount: results.length,
                success: true,
              });
            } catch (error) {
              const endTime = performance.now();

              connectionResults.push({
                connectionId: connId,
                queryId,
                responseTime: endTime - startTime,
                success: false,
                error: error.message,
              });
            }
          }

          return connectionResults;
        }
      );

      const allResults = (await Promise.all(connectionPromises)).flat();

      // Analyze concurrent performance
      const successfulQueries = allResults.filter(r => r.success);
      const failedQueries = allResults.filter(r => !r.success);
      const successRate = successfulQueries.length / allResults.length;

      const responseTimes = successfulQueries.map(r => r.responseTime);
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      // Performance assertions
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(avgResponseTime).toBeLessThan(200); // Average < 200ms
      expect(maxResponseTime).toBeLessThan(1000); // Max < 1s

      console.log('Concurrent Database Performance:', {
        totalQueries: allResults.length,
        successRate,
        avgResponseTime,
        maxResponseTime,
        failedQueries: failedQueries.length,
      });
    });
  });
});
```

## Performance Optimization

### Identifying Bottlenecks

```typescript
// tests/performance/optimization/bottleneck-analysis.test.ts
import { ProfiledSearchService } from '../../helpers/profiled-search-service';

describe('Bottleneck Analysis', () => {
  let profiledService: ProfiledSearchService;

  beforeAll(() => {
    profiledService = new ProfiledSearchService();
  });

  it('should identify performance bottlenecks', async () => {
    const searchRequest = {
      query: 'performance bottleneck analysis',
      databases: ['test-db-1', 'test-db-2', 'test-db-3'],
      userId: 'test-user',
      searchMode: 'semantic' as const,
      limit: 50,
    };

    // Execute profiled search
    const result = await profiledService.profiledSearch(searchRequest);

    // Analyze timing breakdown
    const timingBreakdown = result.timingBreakdown;

    console.log('Performance Breakdown:', {
      totalTime: result.totalExecutionTime,
      cacheCheck: timingBreakdown.cacheCheck,
      aiProcessing: timingBreakdown.aiProcessing,
      databaseQueries: timingBreakdown.databaseQueries,
      resultProcessing: timingBreakdown.resultProcessing,
      cacheStorage: timingBreakdown.cacheStorage,
    });

    // Identify bottlenecks (operations taking > 30% of total time)
    const bottlenecks = Object.entries(timingBreakdown)
      .filter(([_, time]) => time > result.totalExecutionTime * 0.3)
      .map(([operation, time]) => ({
        operation,
        time,
        percentage: (time / result.totalExecutionTime) * 100,
      }));

    if (bottlenecks.length > 0) {
      console.log('Identified Bottlenecks:', bottlenecks);
    }

    // Performance optimization suggestions
    const suggestions = generateOptimizationSuggestions(timingBreakdown, result.totalExecutionTime);
    console.log('Optimization Suggestions:', suggestions);

    // Assert reasonable performance
    expect(result.totalExecutionTime).toBeLessThan(1000); // Total < 1s
    expect(timingBreakdown.databaseQueries).toBeLessThan(500); // DB queries < 500ms
  });
});

function generateOptimizationSuggestions(breakdown: any, totalTime: number): string[] {
  const suggestions = [];

  if (breakdown.databaseQueries > totalTime * 0.5) {
    suggestions.push(
      'Database queries are taking >50% of execution time. Consider optimizing indexes or query structure.'
    );
  }

  if (breakdown.aiProcessing > totalTime * 0.4) {
    suggestions.push(
      'AI processing is taking >40% of execution time. Consider caching AI results or using faster models.'
    );
  }

  if (breakdown.cacheCheck > 50) {
    suggestions.push(
      'Cache check is taking >50ms. Consider optimizing cache key generation or using faster cache.'
    );
  }

  if (breakdown.resultProcessing > totalTime * 0.3) {
    suggestions.push(
      'Result processing is taking >30% of execution time. Consider optimizing result transformation logic.'
    );
  }

  return suggestions;
}
```

### Performance Regression Testing

```typescript
// tests/performance/regression/performance-regression.test.ts
import { PerformanceBenchmark } from '../../helpers/performance-benchmark';

describe('Performance Regression Testing', () => {
  let benchmark: PerformanceBenchmark;

  beforeAll(async () => {
    benchmark = new PerformanceBenchmark();
    await benchmark.loadBaselineMetrics();
  });

  it('should not regress from baseline performance', async () => {
    const testScenarios = [
      {
        name: 'basic_search',
        operation: () => benchmark.executeBasicSearch(),
        baselineTime: 150, // ms
      },
      {
        name: 'semantic_search',
        operation: () => benchmark.executeSemanticSearch(),
        baselineTime: 300, // ms
      },
      {
        name: 'multi_database_search',
        operation: () => benchmark.executeMultiDatabaseSearch(),
        baselineTime: 250, // ms
      },
      {
        name: 'cached_search',
        operation: () => benchmark.executeCachedSearch(),
        baselineTime: 25, // ms
      },
    ];

    const regressionResults = [];

    for (const scenario of testScenarios) {
      const iterations = 10;
      const executionTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await scenario.operation();
        const endTime = performance.now();

        executionTimes.push(endTime - startTime);
      }

      const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const regressionPercentage =
        ((avgTime - scenario.baselineTime) / scenario.baselineTime) * 100;

      regressionResults.push({
        scenario: scenario.name,
        baselineTime: scenario.baselineTime,
        currentTime: avgTime,
        regressionPercentage,
        isRegression: regressionPercentage > 10, // >10% slower is regression
      });

      // Assert no significant regression
      expect(regressionPercentage).toBeLessThan(20); // Max 20% regression allowed

      if (regressionPercentage > 10) {
        console.warn(
          `Performance regression detected in ${scenario.name}: ${regressionPercentage.toFixed(2)}% slower`
        );
      }
    }

    console.log('Performance Regression Results:', regressionResults);

    // Update baseline if performance improved
    const improvements = regressionResults.filter(r => r.regressionPercentage < -5); // >5% improvement
    if (improvements.length > 0) {
      console.log('Performance improvements detected:', improvements);
      await benchmark.updateBaselineMetrics(regressionResults);
    }
  });
});
```

## Test Configuration

### Performance Test Configuration

```javascript
// jest.performance.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/performance'],
  testMatch: ['<rootDir>/tests/performance/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/performance-setup.ts'],
  testTimeout: 300000, // 5 minutes for performance tests
  maxWorkers: 1, // Run performance tests sequentially
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage/performance',
  reporters: [
    'default',
    [
      '<rootDir>/tests/helpers/performance-reporter.js',
      {
        outputFile: 'performance-results.json',
      },
    ],
  ],
};
```

## Best Practices

### Performance Testing Guidelines

1. **Establish Baselines**: Define performance targets and baseline metrics
2. **Test Realistic Scenarios**: Use realistic data volumes and usage patterns
3. **Monitor System Resources**: Track CPU, memory, and I/O during tests
4. **Test Different Load Patterns**: Include steady load, spikes, and gradual increases
5. **Isolate Performance Tests**: Run in dedicated environment without interference
6. **Automate Performance Testing**: Include in CI/CD pipeline for regression detection
7. **Document Results**: Keep historical performance data for trend analysis

### Common Performance Anti-patterns

```typescript
// Avoid these performance anti-patterns

// ❌ N+1 Query Problem
async function badGetUsersWithProfiles(userIds: string[]) {
  const users = [];
  for (const userId of userIds) {
    const user = await userService.getUser(userId); // N queries
    const profile = await profileService.getProfile(userId); // N more queries
    users.push({ ...user, profile });
  }
  return users;
}

// ✅ Batch Queries
async function goodGetUsersWithProfiles(userIds: string[]) {
  const [users, profiles] = await Promise.all([
    userService.getUsersByIds(userIds), // 1 query
    profileService.getProfilesByUserIds(userIds), // 1 query
  ]);

  return users.map(user => ({
    ...user,
    profile: profiles.find(p => p.userId === user.id),
  }));
}

// ❌ Blocking Operations
async function badProcessResults(results: SearchResult[]) {
  for (const result of results) {
    await processResult(result); // Blocking sequential processing
  }
}

// ✅ Concurrent Processing
async function goodProcessResults(results: SearchResult[]) {
  await Promise.all(results.map(result => processResult(result))); // Concurrent processing
}

// ❌ Memory Leaks
class BadCacheService {
  private cache = new Map(); // Never cleaned up

  set(key: string, value: any) {
    this.cache.set(key, value); // Memory leak - no TTL or size limit
  }
}

// ✅ Proper Memory Management
class GoodCacheService {
  private cache = new Map();
  private maxSize = 1000;

  set(key: string, value: any, ttl: number = 300000) {
    // Implement LRU eviction and TTL
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, { value, expires: Date.now() + ttl });
  }
}
```

## Related Documentation

- **[Unit Testing Guide](./unit.md)** - Unit testing strategies and patterns
- **[Integration Testing Guide](./integration.md)** - Integration testing implementation
- **[Testing Overview](./index.md)** - Complete testing strategy
- **[Development Standards](../development/standards.md)** - Code quality standards

---

**Performance testing ensures Altus 4 meets performance requirements under various load conditions. Use these strategies and tools to identify bottlenecks, validate scalability, and maintain optimal performance.**
