/**
 * Type Definitions
 *
 * Provides main interfaces for database connections, search requests/responses, categories, suggestions, and analytics.
 * Used throughout the application for type safety and data structure consistency.
 *
 * Usage:
 *   - Import interfaces for strong typing in services, controllers, and routes
 */

export interface DatabaseConnection {
  /** Unique identifier for the connection */
  id: string;
  /** Human-readable name for the connection */
  name: string;
  /** Hostname or IP address of the database */
  host: string;
  /** Port number for the database */
  port: number;
  /** Database name */
  database: string;
  /** Username for authentication */
  username: string;
  /** Password (encrypted in storage) */
  password: string; // Will be encrypted in storage
  /** Whether SSL is enabled */
  ssl?: boolean;
  /** Timestamp when created */
  createdAt: Date;
  /** Timestamp when updated */
  updatedAt: Date;
  /** Whether the connection is active */
  isActive: boolean;
}

export interface SearchRequest {
  /** Search query string */
  query: string;
  /** List of database IDs to search */
  databases?: string[];
  /** List of table names to search */
  tables?: string[];
  /** List of column names to search */
  columns?: string[];
  /** Optional filters for search */
  filters?: Record<string, any>;
  /** Search mode: natural, boolean, or semantic */
  searchMode?: 'natural' | 'boolean' | 'semantic';
  /** Result limit per page */
  limit?: number;
  /** Result offset for pagination */
  offset?: number;
  /** Whether to include analytics in response */
  includeAnalytics?: boolean;
  /** User ID of the requester */
  userId: string;
}

export interface SearchResult {
  /** Unique result ID */
  id: string;
  /** Table name where result was found */
  table: string;
  /** Database name where result was found */
  database: string;
  /** Relevance score for ranking */
  relevanceScore: number;
  /** List of columns that matched */
  matchedColumns: string[];
  /** Result data as key-value pairs */
  data: Record<string, any>;
  /** Optional snippet for preview */
  snippet?: string;
  /** Optional categories for result */
  categories?: string[];
}

export interface SearchResponse {
  /** Array of search results */
  results: SearchResult[];
  /** Array of result categories */
  categories: Category[];
  /** Array of query suggestions */
  suggestions: QuerySuggestion[];
  /** Optional search trends and insights */
  trends?: TrendInsight[];
  /** Optional query optimization suggestions */
  queryOptimization?: OptimizationSuggestion[];
  /** Total count of results */
  totalCount: number;
  /** Execution time in ms */
  executionTime: number;
  /** Current page number */
  page: number;
  /** Results per page */
  limit: number;
}

export interface Category {
  /** Category name */
  name: string;
  /** Number of results in category */
  count: number;
  /** Confidence score for category */
  confidence: number;
}

export interface QuerySuggestion {
  /** Suggested query text */
  text: string;
  /** Score for suggestion relevance */
  score: number;
  /** Type of suggestion */
  type: 'spelling' | 'semantic' | 'popular';
}

export interface TrendInsight {
  period: 'day' | 'week' | 'month' | '3months' | '6months' | 'year';
  topQueries: string[];
  queryVolume: number;
  avgResponseTime: number;
  popularCategories: string[];
}

export interface OptimizationSuggestion {
  type: 'index' | 'query' | 'schema';
  description: string;
  impact: 'low' | 'medium' | 'high';
  sqlSuggestion?: string;
}

export interface TableSchema {
  database: string;
  table: string;
  columns: ColumnInfo[];
  fullTextIndexes: FullTextIndex[];
  estimatedRows: number;
  lastAnalyzed: Date;
}

export interface ColumnInfo {
  name: string;
  type: string;
  isFullTextIndexed: boolean;
  isSearchable: boolean;
  dataPreview?: string[];
}

export interface FullTextIndex {
  name: string;
  columns: string[];
  type: 'FULLTEXT';
  cardinality?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  connectedDatabases: string[];
  createdAt: Date;
  lastActive: Date;
}

export interface SearchAnalytics {
  id: string;
  userId: string;
  query: string;
  database: string;
  executionTime: number;
  resultCount: number;
  clickedResults?: string[];
  satisfaction?: number;
  timestamp: Date;
}

export interface AIInsight {
  type: 'query_optimization' | 'trend_analysis' | 'semantic_enhancement';
  confidence: number;
  description: string;
  actionable: boolean;
  data: Record<string, any>;
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: Date;
    requestId: string;
    version: string;
    apiKeyTier?: string;
  };
}

// Database connection pool configuration
export interface ConnectionPoolConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  acquireTimeout: number;
  timeout: number;
  reconnect: boolean;
  ssl?: string | boolean;
}

// Configuration interfaces
export interface AppConfig {
  port: number;
  environment: 'development' | 'production' | 'test';
  jwtSecret: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  timeout: {
    openai: number;
  };
}
