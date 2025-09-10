import { AIService } from '@/services/AIService';
import { CacheService } from '@/services/CacheService';
import type { AIInsight } from '@/types';
import { createConnection } from 'mysql2/promise';
import { AnalyticsController } from './AnalyticsController';

// Mock dependencies
jest.mock('@/services/CacheService');
jest.mock('@/services/AIService');
jest.mock('mysql2/promise');
jest.mock('@/config', () => ({
  config: {
    database: {
      host: 'localhost',
      port: 3306,
      username: 'test',
      password: 'test',
      database: 'altus4_test',
    },
  },
}));
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('AnalyticsController', () => {
  let analyticsController: AnalyticsController;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockAIService: jest.Mocked<AIService>;
  let mockConnection: any;

  const mockTrendData = {
    topQueries: ['query 1', 'query 2'],
    queryVolume: 100,
    avgResponseTime: 150,
    popularCategories: ['category 1', 'category 2'],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database connection
    mockConnection = {
      execute: jest.fn(),
      ping: jest.fn(),
    };
    (createConnection as jest.Mock).mockResolvedValue(mockConnection);

    // Mock CacheService
    mockCacheService = {
      getTopQueries: jest.fn().mockResolvedValue(mockTrendData.topQueries),
      getQueryVolume: jest.fn().mockResolvedValue(mockTrendData.queryVolume),
      getAverageResponseTime: jest.fn().mockResolvedValue(mockTrendData.avgResponseTime),
      getPopularCategories: jest.fn().mockResolvedValue(mockTrendData.popularCategories),
    } as any;

    // Mock AIService
    mockAIService = {
      isAvailable: jest.fn().mockReturnValue(true),
      generateInsights: jest.fn(),
    } as any;

    // Setup service constructors
    (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(
      () => mockCacheService
    );
    (AIService as jest.MockedClass<typeof AIService>).mockImplementation(() => mockAIService);

    analyticsController = new AnalyticsController();
  });

  describe('getSearchTrends', () => {
    it('should get search trends with default period', async () => {
      const result = await analyticsController.getSearchTrends('user-123', {});

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        period: 'week',
        topQueries: mockTrendData.topQueries,
        queryVolume: mockTrendData.queryVolume,
        avgResponseTime: mockTrendData.avgResponseTime,
        popularCategories: mockTrendData.popularCategories,
      });

      expect(mockCacheService.getTopQueries).toHaveBeenCalledWith('user-123', 7);
      expect(mockCacheService.getQueryVolume).toHaveBeenCalledWith('user-123', 7);
      expect(mockCacheService.getAverageResponseTime).toHaveBeenCalledWith('user-123', 7);
      expect(mockCacheService.getPopularCategories).toHaveBeenCalledWith('user-123', 7);
    });

    it('should get search trends for different periods', async () => {
      const testCases = [
        { period: 'day' as const, expectedDays: 1 },
        { period: 'month' as const, expectedDays: 30 },
        { period: '3months' as const, expectedDays: 90 },
        { period: '6months' as const, expectedDays: 180 },
        { period: 'year' as const, expectedDays: 365 },
      ];

      for (const { period, expectedDays } of testCases) {
        jest.clearAllMocks();

        const result = await analyticsController.getSearchTrends('user-123', { period });

        expect(result[0].period).toBe(period);
        expect(mockCacheService.getTopQueries).toHaveBeenCalledWith('user-123', expectedDays);
      }
    });

    it('should handle cache service errors', async () => {
      const cacheError = new Error('Cache service error');
      mockCacheService.getTopQueries.mockRejectedValue(cacheError);

      await expect(
        analyticsController.getSearchTrends('user-123', { period: 'week' })
      ).rejects.toThrow('Cache service error');
    });
  });

  describe('getPerformanceMetrics', () => {
    const mockMetricsData = [
      {
        avg_response_time: 100,
        max_response_time: 200,
        min_response_time: 50,
        total_queries: 10,
        avg_results: 5,
        date: '2024-01-01',
      },
    ];

    const mockModeDistribution = [
      {
        search_mode: 'natural',
        count: 15,
        avg_time: 120,
      },
    ];

    it('should get performance metrics successfully', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([mockMetricsData])
        .mockResolvedValueOnce([mockModeDistribution]);

      const result = await analyticsController.getPerformanceMetrics('user-123', {
        period: 'week',
      });

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({
        timeSeriesData: mockMetricsData,
        searchModeDistribution: mockModeDistribution,
        summary: {
          totalQueries: 10,
          averageResponseTime: 100,
          averageResults: 5,
        },
      });
    });

    it('should handle custom date range', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([mockMetricsData])
        .mockResolvedValueOnce([mockModeDistribution]);

      await analyticsController.getPerformanceMetrics('user-123', {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ? AND created_at >= ? AND created_at <= ?'),
        ['user-123', '2024-01-01 00:00:00', '2024-01-07 23:59:59']
      );
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockConnection.execute.mockRejectedValue(dbError);

      await expect(analyticsController.getPerformanceMetrics('user-123', {})).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('getPopularQueries', () => {
    const mockQueriesData = [
      {
        query_text: 'popular query',
        frequency: 10,
        avg_time: 150,
        avg_results: 5,
        last_used: '2024-01-01',
      },
    ];

    it('should get popular queries successfully', async () => {
      mockConnection.execute.mockResolvedValue([mockQueriesData]);

      const result = await analyticsController.getPopularQueries('user-123', { period: 'week' });

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY query_text'),
        expect.arrayContaining(['user-123'])
      );
      expect(result).toEqual(mockQueriesData);
    });

    it('should limit results to 20', async () => {
      mockConnection.execute.mockResolvedValue([mockQueriesData]);

      await analyticsController.getPopularQueries('user-123', {});

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 20'),
        expect.any(Array)
      );
    });
  });

  describe('getSearchHistory', () => {
    const mockHistoryData = [
      {
        id: 'search-1',
        query: 'test query',
        search_mode: 'natural',
        resultCount: 5,
        executionTime: 100,
        database: 'db-1',
        timestamp: new Date('2024-01-01'),
      },
    ];

    it('should get search history successfully', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([[{ total: 1 }]])
        .mockResolvedValueOnce([mockHistoryData]);

      const result = await analyticsController.getSearchHistory('user-123', {
        limit: 10,
        offset: 0,
      });

      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({
        items: [
          {
            id: 'search-1',
            userId: 'user-123',
            query: 'test query',
            database: 'db-1',
            executionTime: 100,
            resultCount: 5,
            timestamp: new Date('2024-01-01'),
          },
        ],
        total: 1,
      });
    });

    it('should use default pagination parameters', async () => {
      mockConnection.execute.mockResolvedValueOnce([[{ total: 100 }]]).mockResolvedValueOnce([[]]);

      await analyticsController.getSearchHistory('user-123', {});

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        expect.arrayContaining([100, 0])
      );
    });
  });

  describe('getInsights', () => {
    const mockInsights: AIInsight[] = [
      {
        type: 'trend_analysis',
        description: 'Increasing search volume',
        confidence: 0.8,
        actionable: true,
        data: {},
      },
    ];

    it('should get insights when AI is available', async () => {
      mockAIService.isAvailable.mockReturnValue(true);
      mockAIService.generateInsights.mockResolvedValue(mockInsights);
      mockConnection.execute.mockResolvedValue([[{ query_text: 'recent query' }]]);

      const result = await analyticsController.getInsights('user-123', { period: 'week' });

      expect(mockAIService.generateInsights).toHaveBeenCalledWith(['recent query'], 'week');
      expect(result).toEqual(mockInsights);
    });

    it('should return empty array when AI is not available', async () => {
      mockAIService.isAvailable.mockReturnValue(false);

      const result = await analyticsController.getInsights('user-123', {});

      expect(mockAIService.generateInsights).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should map periods correctly for AI service', async () => {
      mockAIService.isAvailable.mockReturnValue(true);
      mockAIService.generateInsights.mockResolvedValue([]);
      mockConnection.execute.mockResolvedValue([[]]);

      await analyticsController.getInsights('user-123', { period: '3months' });

      expect(mockAIService.generateInsights).toHaveBeenCalledWith([], 'month');
    });

    it('should handle AI service errors gracefully', async () => {
      mockAIService.isAvailable.mockReturnValue(true);
      mockAIService.generateInsights.mockRejectedValue(new Error('AI service error'));
      mockConnection.execute.mockResolvedValue([[]]);

      const result = await analyticsController.getInsights('user-123', {});

      expect(result).toEqual([]);
    });
  });

  describe('getDashboardData', () => {
    it('should get comprehensive dashboard data', async () => {
      // Setup mocks for all dashboard components
      jest.spyOn(analyticsController, 'getSearchTrends').mockResolvedValue([
        {
          period: 'week',
          topQueries: ['query 1'],
          queryVolume: 50,
          avgResponseTime: 100,
          popularCategories: ['cat 1'],
        },
      ]);

      jest.spyOn(analyticsController, 'getPerformanceMetrics').mockResolvedValue({
        summary: { totalQueries: 50, averageResponseTime: 100 },
      });

      jest
        .spyOn(analyticsController, 'getPopularQueries')
        .mockResolvedValue([{ query_text: 'top query', frequency: 10 }]);

      jest.spyOn(analyticsController, 'getInsights').mockResolvedValue([]);

      const result = await analyticsController.getDashboardData('user-123', { period: 'week' });

      expect(result).toMatchObject({
        trends: {
          period: 'week',
          topQueries: ['query 1'],
          queryVolume: 50,
          avgResponseTime: 100,
          popularCategories: ['cat 1'],
        },
        performance: {
          summary: { totalQueries: 50, averageResponseTime: 100 },
        },
        popularQueries: [{ query_text: 'top query', frequency: 10 }],
        insights: [],
        summary: {
          period: 'week',
          totalQueries: 50,
          averageResponseTime: 100,
          topQuery: 'top query',
        },
      });
    });

    it('should handle missing data gracefully', async () => {
      jest.spyOn(analyticsController, 'getSearchTrends').mockResolvedValue([]);
      jest.spyOn(analyticsController, 'getPerformanceMetrics').mockResolvedValue({});
      jest.spyOn(analyticsController, 'getPopularQueries').mockResolvedValue([]);
      jest.spyOn(analyticsController, 'getInsights').mockResolvedValue([]);

      const result = await analyticsController.getDashboardData('user-123', {});

      expect(result.summary).toMatchObject({
        period: 'week',
        totalQueries: 0,
        averageResponseTime: 0,
        topQuery: 'No queries yet',
      });
    });
  });

  describe('Admin methods', () => {
    describe('getSystemOverview', () => {
      const mockSystemMetrics = [
        {
          active_users: 100,
          total_queries: 1000,
          avg_response_time: 150,
          avg_results: 5,
        },
      ];

      it('should get system overview for admins', async () => {
        mockConnection.execute
          .mockResolvedValueOnce([mockSystemMetrics])
          .mockResolvedValueOnce([[{ date: '2024-01-01', new_users: 5 }]])
          .mockResolvedValueOnce([[{ date: '2024-01-01', query_count: 100, active_users: 10 }]]);

        const result = await analyticsController.getSystemOverview({ period: 'week' });

        expect(result).toMatchObject({
          summary: mockSystemMetrics[0],
          userGrowth: [{ date: '2024-01-01', new_users: 5 }],
          queryVolume: [{ date: '2024-01-01', query_count: 100, active_users: 10 }],
          period: 'week',
        });
      });
    });

    describe('getUserActivity', () => {
      it('should get user activity for admins', async () => {
        const mockActivity = [
          {
            id: 'user-1',
            email: 'user1@example.com',
            name: 'User 1',
            role: 'user',
            query_count: 10,
            avg_response_time: 150,
            last_query: '2024-01-01',
            last_active: '2024-01-01',
          },
        ];

        mockConnection.execute.mockResolvedValue([mockActivity]);

        const result = await analyticsController.getUserActivity({ limit: 10, offset: 0 });

        expect(result).toEqual(mockActivity);
        expect(mockConnection.execute).toHaveBeenCalledWith(
          expect.stringContaining('LEFT JOIN search_analytics'),
          expect.arrayContaining([10, 0])
        );
      });
    });

    describe('getSystemPerformanceMetrics', () => {
      it('should get system performance metrics for admins', async () => {
        const mockPerformance = [
          {
            date: '2024-01-01',
            query_count: 100,
            avg_response_time: 150,
            max_response_time: 500,
            active_users: 10,
          },
        ];

        const mockSlowQueries = [
          {
            query_text: 'slow query',
            execution_time_ms: 1000,
            result_count: 1,
            created_at: '2024-01-01',
            user_email: 'user@example.com',
          },
        ];

        mockConnection.execute
          .mockResolvedValueOnce([mockPerformance])
          .mockResolvedValueOnce([mockSlowQueries]);

        const result = await analyticsController.getSystemPerformanceMetrics({ period: 'week' });

        expect(result).toMatchObject({
          timeSeriesData: mockPerformance,
          slowestQueries: mockSlowQueries,
          summary: {
            totalQueries: 100,
            averageResponseTime: 150,
            peakResponseTime: 500,
          },
        });
      });
    });
  });

  describe('Helper methods', () => {
    describe('getPeriodDays', () => {
      it('should return correct days for each period', () => {
        const testCases = [
          { period: 'day', expectedDays: 1 },
          { period: 'week', expectedDays: 7 },
          { period: 'month', expectedDays: 30 },
          { period: '3months', expectedDays: 90 },
          { period: '6months', expectedDays: 180 },
          { period: 'year', expectedDays: 365 },
          { period: 'unknown', expectedDays: 7 }, // default
        ];

        for (const { period, expectedDays } of testCases) {
          const result = (analyticsController as any).getPeriodDays(period);
          expect(result).toBe(expectedDays);
        }
      });
    });

    describe('getDateRange', () => {
      it('should create date range from custom dates', () => {
        const result = (analyticsController as any).getDateRange('2024-01-01', '2024-01-07');

        expect(result).toEqual({
          start: '2024-01-01 00:00:00',
          end: '2024-01-07 23:59:59',
        });
      });

      it('should create date range from period', () => {
        const result = (analyticsController as any).getDateRange(undefined, undefined, 'week');

        expect(result.start).toMatch(/\d{4}-\d{2}-\d{2} 00:00:00/);
        expect(result.end).toMatch(/\d{4}-\d{2}-\d{2} 23:59:59/);
      });
    });

    describe('getRecentQueries', () => {
      it('should get recent queries for user', async () => {
        const mockQueries = [{ query_text: 'recent query' }];
        mockConnection.execute.mockResolvedValue([mockQueries]);

        const result = await (analyticsController as any).getRecentQueries('user-123', 'week');

        expect(result).toEqual(['recent query']);
        expect(mockConnection.execute).toHaveBeenCalledWith(
          expect.stringContaining('SELECT query_text'),
          expect.arrayContaining(['user-123'])
        );
      });

      it('should handle errors gracefully', async () => {
        mockConnection.execute.mockRejectedValue(new Error('Database error'));

        const result = await (analyticsController as any).getRecentQueries('user-123', 'week');

        expect(result).toEqual([]);
      });
    });
  });

  describe('Error Handling Coverage', () => {
    it('should handle database connection initialization error', async () => {
      const { logger } = require('@/utils/logger');

      // Mock connection to throw error on ping
      mockConnection.ping.mockRejectedValue(new Error('Connection failed'));

      // Create a new instance to trigger the initialization error
      (createConnection as jest.Mock).mockResolvedValue(mockConnection);

      // Instantiate a fresh controller so its constructor runs initializeConnection
      // after we've configured the ping() rejection above.
      // This ensures the error path logs as expected in this test.
      new AnalyticsController();

      // Wait a bit for the async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to establish AnalyticsController database connection:',
        expect.any(Error)
      );
    });

    it('should handle getPopularQueries error', async () => {
      const { logger } = require('@/utils/logger');

      mockConnection.execute.mockRejectedValue(new Error('Database query failed'));

      await expect(
        analyticsController.getPopularQueries('user-123', { period: 'week' })
      ).rejects.toThrow('Database query failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get popular queries for user user-123:',
        expect.any(Error)
      );
    });

    it('should handle getSearchHistory error', async () => {
      const { logger } = require('@/utils/logger');

      mockConnection.execute
        .mockResolvedValueOnce([[{ total: 100 }]]) // Count query succeeds
        .mockRejectedValueOnce(new Error('History query failed')); // History query fails

      await expect(
        analyticsController.getSearchHistory('user-123', { period: 'week' })
      ).rejects.toThrow('History query failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get search history for user user-123:',
        expect.any(Error)
      );
    });

    it('should handle getDashboardData error', async () => {
      const { logger } = require('@/utils/logger');

      // Reset the cache service to succeed, then make database fail
      mockCacheService.getTopQueries.mockResolvedValue(['query1', 'query2']);
      mockCacheService.getQueryVolume.mockResolvedValue(100);
      mockCacheService.getAverageResponseTime.mockResolvedValue(150);
      mockCacheService.getPopularCategories.mockResolvedValue(['cat1', 'cat2']);

      // Make the database connection fail
      mockConnection.execute.mockRejectedValue(new Error('Dashboard query failed'));

      await expect(
        analyticsController.getDashboardData('user-123', { period: 'week' })
      ).rejects.toThrow('Dashboard query failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get dashboard data for user user-123:',
        expect.any(Error)
      );
    });

    it('should handle getSystemOverview error', async () => {
      const { logger } = require('@/utils/logger');

      mockConnection.execute.mockRejectedValue(new Error('System overview failed'));

      await expect(analyticsController.getSystemOverview({ period: 'week' })).rejects.toThrow(
        'System overview failed'
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get system overview:',
        expect.any(Error)
      );
    });

    it('should handle getUserActivity error', async () => {
      const { logger } = require('@/utils/logger');

      mockConnection.execute.mockRejectedValue(new Error('User activity failed'));

      await expect(analyticsController.getUserActivity({ limit: 10, offset: 0 })).rejects.toThrow(
        'User activity failed'
      );

      expect(logger.error).toHaveBeenCalledWith('Failed to get user activity:', expect.any(Error));
    });

    it('should handle getSystemPerformanceMetrics error', async () => {
      const { logger } = require('@/utils/logger');

      mockConnection.execute.mockRejectedValue(new Error('Performance metrics failed'));

      await expect(
        analyticsController.getSystemPerformanceMetrics({ period: 'week' })
      ).rejects.toThrow('Performance metrics failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get system performance metrics:',
        expect.any(Error)
      );
    });
  });
});
