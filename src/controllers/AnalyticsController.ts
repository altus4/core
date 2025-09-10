/**
 * AnalyticsController
 *
 * Handles analytics operations such as retrieving search trends, insights, and statistics for users.
 * Integrates with CacheService and AIService for analytics and insights.
 * Manages its own database connection for direct queries.
 *
 * Usage:
 *   - Instantiate and use getSearchTrends() to retrieve user analytics
 *   - Use other methods for advanced analytics and insights
 */
import { config } from '@/config';
import { AIService } from '@/services/AIService';
import { CacheService } from '@/services/CacheService';
import type { AIInsight, SearchAnalytics, TrendInsight } from '@/types';
import { logger } from '@/utils/logger';
import type { RowDataPacket } from 'mysql2/promise';
import { createConnection } from 'mysql2/promise';

export class AnalyticsController {
  /**
   * MySQL connection promise for analytics database operations.
   */
  private connection = createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.username,
    password: config.database.password,
    database: config.database.database,
  });

  /**
   * CacheService instance for analytics caching and statistics.
   */
  private cacheService: CacheService;

  /**
   * AIService instance for generating insights and advanced analytics.
   */
  private aiService: AIService;

  /**
   * Initialize the AnalyticsController and its dependencies.
   */
  constructor() {
    this.cacheService = new CacheService();
    this.aiService = new AIService();
    this.initializeConnection();
  }

  /**
   * Establish and test the database connection for analytics operations.
   * Logs success or failure.
   */
  private async initializeConnection(): Promise<void> {
    try {
      const conn = await this.connection;
      await conn.ping();
      logger.info('AnalyticsController database connection established');
    } catch (error) {
      logger.error('Failed to establish AnalyticsController database connection:', error);
    }
  }

  /**
   * Get search trends for a user over a specified period.
   * Aggregates top queries, query volume, response time, and popular categories.
   *
   * @param userId - ID of the user
   * @param params - Object containing startDate, endDate, and period
   * @returns Array of TrendInsight objects
   */
  public async getSearchTrends(
    userId: string,
    params: {
      startDate?: string;
      endDate?: string;
      period?: 'day' | 'week' | 'month' | '3months' | '6months' | 'year';
    }
  ): Promise<TrendInsight[]> {
    try {
      const { period = 'week' } = params;
      const days = this.getPeriodDays(period);

      const trends: TrendInsight[] = [
        {
          period,
          topQueries: await this.cacheService.getTopQueries(userId, days),
          queryVolume: await this.cacheService.getQueryVolume(userId, days),
          avgResponseTime: await this.cacheService.getAverageResponseTime(userId, days),
          popularCategories: await this.cacheService.getPopularCategories(userId, days),
        },
      ];

      return trends;
    } catch (error) {
      logger.error(`Failed to get search trends for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get performance metrics for a user
   */
  public async getPerformanceMetrics(
    userId: string,
    params: {
      startDate?: string;
      endDate?: string;
      period?: 'day' | 'week' | 'month' | '3months' | '6months' | 'year';
    }
  ): Promise<any> {
    try {
      const conn = await this.connection;
      const { startDate, endDate, period = 'week' } = params;
      const dateRange = this.getDateRange(startDate, endDate, period);

      // Get performance metrics from database
      const [metrics] = await conn.execute<RowDataPacket[]>(
        `SELECT
           AVG(execution_time_ms) as avg_response_time,
           MAX(execution_time_ms) as max_response_time,
           MIN(execution_time_ms) as min_response_time,
           COUNT(*) as total_queries,
           AVG(result_count) as avg_results,
           DATE(created_at) as date
         FROM search_analytics
         WHERE user_id = ? AND created_at >= ? AND created_at <= ?
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [userId, dateRange.start, dateRange.end]
      );

      // Get query distribution by search mode
      const [modeDistribution] = await conn.execute<RowDataPacket[]>(
        `SELECT
           search_mode,
           COUNT(*) as count,
           AVG(execution_time_ms) as avg_time
         FROM search_analytics
         WHERE user_id = ? AND created_at >= ? AND created_at <= ?
         GROUP BY search_mode`,
        [userId, dateRange.start, dateRange.end]
      );

      return {
        timeSeriesData: metrics,
        searchModeDistribution: modeDistribution,
        summary: {
          totalQueries: metrics.reduce((sum: number, day: any) => sum + day.total_queries, 0),
          averageResponseTime:
            metrics.length > 0
              ? metrics.reduce((sum: number, day: any) => sum + day.avg_response_time, 0) /
                metrics.length
              : 0,
          averageResults:
            metrics.length > 0
              ? metrics.reduce((sum: number, day: any) => sum + day.avg_results, 0) / metrics.length
              : 0,
        },
      };
    } catch (error) {
      logger.error(`Failed to get performance metrics for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get popular queries for a user
   */
  public async getPopularQueries(
    userId: string,
    params: {
      startDate?: string;
      endDate?: string;
      period?: 'day' | 'week' | 'month' | '3months' | '6months' | 'year';
    }
  ): Promise<any[]> {
    try {
      const conn = await this.connection;
      const { startDate, endDate, period = 'week' } = params;
      const dateRange = this.getDateRange(startDate, endDate, period);

      const [queries] = await conn.execute<RowDataPacket[]>(
        `SELECT
           query_text,
           COUNT(*) as frequency,
           AVG(execution_time_ms) as avg_time,
           AVG(result_count) as avg_results,
           MAX(created_at) as last_used
         FROM search_analytics
         WHERE user_id = ? AND created_at >= ? AND created_at <= ?
         GROUP BY query_text
         ORDER BY frequency DESC, avg_results DESC
         LIMIT 20`,
        [userId, dateRange.start, dateRange.end]
      );

      return queries;
    } catch (error) {
      logger.error(`Failed to get popular queries for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get detailed search history
   */
  public async getSearchHistory(
    userId: string,
    params: {
      startDate?: string;
      endDate?: string;
      period?: 'day' | 'week' | 'month' | '3months' | '6months' | 'year';
      limit?: number;
      offset?: number;
    }
  ): Promise<{ items: SearchAnalytics[]; total: number }> {
    try {
      const conn = await this.connection;
      const { startDate, endDate, period = 'week', limit = 100, offset = 0 } = params;
      const dateRange = this.getDateRange(startDate, endDate, period);

      // Get total count
      const [countResult] = await conn.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total
         FROM search_analytics
         WHERE user_id = ? AND created_at >= ? AND created_at <= ?`,
        [userId, dateRange.start, dateRange.end]
      );

      // Get search history with pagination
      const [history] = await conn.execute<RowDataPacket[]>(
        `SELECT
           id,
           query_text as query,
           search_mode,
           result_count as resultCount,
           execution_time_ms as executionTime,
           database_id as database,
           created_at as timestamp
         FROM search_analytics
         WHERE user_id = ? AND created_at >= ? AND created_at <= ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, dateRange.start, dateRange.end, limit, offset]
      );

      const items: SearchAnalytics[] = history.map(row => ({
        id: row.id,
        userId,
        query: row.query,
        database: row.database || '',
        executionTime: row.executionTime,
        resultCount: row.resultCount,
        timestamp: new Date(row.timestamp),
      }));

      return {
        items,
        total: countResult[0].total,
      };
    } catch (error) {
      logger.error(`Failed to get search history for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get AI-powered insights
   */
  public async getInsights(
    userId: string,
    params: {
      startDate?: string;
      endDate?: string;
      period?: 'day' | 'week' | 'month' | '3months' | '6months' | 'year';
    }
  ): Promise<AIInsight[]> {
    try {
      if (!this.aiService.isAvailable()) {
        return [];
      }

      // Get recent queries for analysis
      const recentQueries = await this.getRecentQueries(userId, params.period || 'week');

      // Map period to AI service compatible format
      const periodMap: Record<string, 'day' | 'week' | 'month'> = {
        day: 'day',
        week: 'week',
        month: 'month',
        '3months': 'month',
        '6months': 'month',
        year: 'month',
      };

      const aiPeriod = periodMap[params.period || 'week'] || 'week';
      const insights = await this.aiService.generateInsights(recentQueries, aiPeriod);

      return insights;
    } catch (error) {
      logger.error(`Failed to get insights for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get comprehensive dashboard data
   */
  public async getDashboardData(
    userId: string,
    params: {
      startDate?: string;
      endDate?: string;
      period?: 'day' | 'week' | 'month' | '3months' | '6months' | 'year';
    }
  ): Promise<any> {
    try {
      const [trends, performance, popularQueries, insights] = await Promise.all([
        this.getSearchTrends(userId, params),
        this.getPerformanceMetrics(userId, params),
        this.getPopularQueries(userId, { ...params, period: params.period }),
        this.getInsights(userId, params),
      ]);

      return {
        trends: trends[0] || null,
        performance,
        popularQueries: popularQueries.slice(0, 10),
        insights,
        summary: {
          period: params.period || 'week',
          totalQueries: performance.summary?.totalQueries || 0,
          averageResponseTime: performance.summary?.averageResponseTime || 0,
          topQuery: popularQueries[0]?.query_text || 'No queries yet',
        },
      };
    } catch (error) {
      logger.error(`Failed to get dashboard data for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Admin-only: Get system overview
   */
  public async getSystemOverview(params: {
    startDate?: string;
    endDate?: string;
    period?: 'day' | 'week' | 'month' | '3months' | '6months' | 'year';
  }): Promise<any> {
    try {
      const conn = await this.connection;
      const { startDate, endDate, period = 'week' } = params;
      const dateRange = this.getDateRange(startDate, endDate, period);

      // Get system-wide metrics
      const [systemMetrics] = await conn.execute<RowDataPacket[]>(
        `SELECT
           COUNT(DISTINCT user_id) as active_users,
           COUNT(*) as total_queries,
           AVG(execution_time_ms) as avg_response_time,
           AVG(result_count) as avg_results
         FROM search_analytics
         WHERE created_at >= ? AND created_at <= ?`,
        [dateRange.start, dateRange.end]
      );

      // Get user growth
      const [userGrowth] = await conn.execute<RowDataPacket[]>(
        `SELECT
           DATE(created_at) as date,
           COUNT(*) as new_users
         FROM users
         WHERE created_at >= ? AND created_at <= ?
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [dateRange.start, dateRange.end]
      );

      // Get query volume over time
      const [queryVolume] = await conn.execute<RowDataPacket[]>(
        `SELECT
           DATE(created_at) as date,
           COUNT(*) as query_count,
           COUNT(DISTINCT user_id) as active_users
         FROM search_analytics
         WHERE created_at >= ? AND created_at <= ?
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [dateRange.start, dateRange.end]
      );

      return {
        summary: systemMetrics[0],
        userGrowth,
        queryVolume,
        period,
      };
    } catch (error) {
      logger.error('Failed to get system overview:', error);
      throw error;
    }
  }

  /**
   * Admin-only: Get user activity
   */
  public async getUserActivity(params: {
    startDate?: string;
    endDate?: string;
    period?: 'day' | 'week' | 'month' | '3months' | '6months' | 'year';
    limit?: number;
    offset?: number;
  }): Promise<any> {
    try {
      const conn = await this.connection;
      const { startDate, endDate, period = 'week', limit = 100, offset = 0 } = params;
      const dateRange = this.getDateRange(startDate, endDate, period);

      const [activity] = await conn.execute<RowDataPacket[]>(
        `SELECT
           u.id,
           u.email,
           u.name,
           u.role,
           COUNT(sa.id) as query_count,
           AVG(sa.execution_time_ms) as avg_response_time,
           MAX(sa.created_at) as last_query,
           u.last_active
         FROM users u
         LEFT JOIN search_analytics sa ON u.id = sa.user_id
           AND sa.created_at >= ? AND sa.created_at <= ?
         WHERE u.is_active = true
         GROUP BY u.id
         ORDER BY query_count DESC, last_query DESC
         LIMIT ? OFFSET ?`,
        [dateRange.start, dateRange.end, limit, offset]
      );

      return activity;
    } catch (error) {
      logger.error('Failed to get user activity:', error);
      throw error;
    }
  }

  /**
   * Admin-only: Get system performance metrics
   */
  public async getSystemPerformanceMetrics(params: {
    startDate?: string;
    endDate?: string;
    period?: 'day' | 'week' | 'month' | '3months' | '6months' | 'year';
  }): Promise<any> {
    try {
      const conn = await this.connection;
      const { startDate, endDate, period = 'week' } = params;
      const dateRange = this.getDateRange(startDate, endDate, period);

      // Get performance metrics over time
      const [performance] = await conn.execute<RowDataPacket[]>(
        `SELECT
           DATE(created_at) as date,
           COUNT(*) as query_count,
           AVG(execution_time_ms) as avg_response_time,
           MAX(execution_time_ms) as max_response_time,
           COUNT(DISTINCT user_id) as active_users
         FROM search_analytics
         WHERE created_at >= ? AND created_at <= ?
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [dateRange.start, dateRange.end]
      );

      // Get slowest queries
      const [slowQueries] = await conn.execute<RowDataPacket[]>(
        `SELECT
           query_text,
           execution_time_ms,
           result_count,
           created_at,
           u.email as user_email
         FROM search_analytics sa
         JOIN users u ON sa.user_id = u.id
         WHERE sa.created_at >= ? AND sa.created_at <= ?
         ORDER BY execution_time_ms DESC
         LIMIT 10`,
        [dateRange.start, dateRange.end]
      );

      return {
        timeSeriesData: performance,
        slowestQueries: slowQueries,
        summary: {
          totalQueries: performance.reduce((sum: number, day: any) => sum + day.query_count, 0),
          averageResponseTime:
            performance.length > 0
              ? performance.reduce((sum: number, day: any) => sum + day.avg_response_time, 0) /
                performance.length
              : 0,
          peakResponseTime: Math.max(...performance.map((day: any) => day.max_response_time)),
        },
      };
    } catch (error) {
      logger.error('Failed to get system performance metrics:', error);
      throw error;
    }
  }

  // Helper methods

  private getPeriodDays(period: string): number {
    switch (period) {
      case 'day':
        return 1;
      case 'week':
        return 7;
      case 'month':
        return 30;
      case '3months':
        return 90;
      case '6months':
        return 180;
      case 'year':
        return 365;
      default:
        return 7;
    }
  }

  private getDateRange(startDate?: string, endDate?: string, period?: string) {
    const end = endDate ? new Date(endDate) : new Date();

    let start: Date;
    if (startDate) {
      start = new Date(startDate);
    } else {
      const days = this.getPeriodDays(period || 'week');
      start = new Date();
      start.setDate(start.getDate() - days);
    }

    return {
      start: `${start.toISOString().split('T')[0]} 00:00:00`,
      end: `${end.toISOString().split('T')[0]} 23:59:59`,
    };
  }

  private async getRecentQueries(userId: string, period: string): Promise<string[]> {
    try {
      const conn = await this.connection;
      const days = this.getPeriodDays(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [queries] = await conn.execute<RowDataPacket[]>(
        `SELECT query_text
         FROM search_analytics
         WHERE user_id = ? AND created_at >= ?
         GROUP BY query_text
         ORDER BY MAX(created_at) DESC
         LIMIT 50`,
        [userId, startDate]
      );

      return queries.map(row => row.query_text);
    } catch (error) {
      logger.error(`Failed to get recent queries for user ${userId}:`, error);
      return [];
    }
  }
}
