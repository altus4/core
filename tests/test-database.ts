/**
 * Test Database Setup
 *
 * Provides utilities for setting up and managing test database connections
 * for integration tests.
 */

import { logger } from '@/utils/logger';
import mysql from 'mysql2/promise';

export interface TestDatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl?: boolean;
}

export class TestDatabase {
  private connection: mysql.Connection | null = null;
  private pool: mysql.Pool | null = null;

  constructor(private config: TestDatabaseConfig) {}

  /**
   * Create a test database connection
   */
  async connect(): Promise<mysql.Connection> {
    if (this.connection) {
      return this.connection;
    }

    try {
      this.connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
        ssl: this.config.ssl ? {} : undefined,
        multipleStatements: true,
        charset: 'utf8mb4',
      });

      return this.connection;
    } catch (error) {
      logger.error('Failed to connect to test database:', error);
      throw error;
    }
  }

  /**
   * Create a connection pool for tests
   */
  createPool(): mysql.Pool {
    if (this.pool) {
      return this.pool;
    }

    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
      ssl: this.config.ssl ? {} : undefined,
      connectionLimit: 5,
    });

    return this.pool;
  }

  /**
   * Setup test database schema
   */
  async setupSchema(): Promise<void> {
    const connection = await this.connect();

    try {
      await connection.execute(`CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user') DEFAULT 'user',
        isActive TINYINT(1) DEFAULT 1,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`);

      await connection.execute(`CREATE TABLE IF NOT EXISTS database_connections (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INT NOT NULL,
        database_name VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        password TEXT NOT NULL,
        use_ssl TINYINT(1) DEFAULT 0,
        isActive TINYINT(1) DEFAULT 1,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )`);

      await connection.execute(`CREATE TABLE IF NOT EXISTS test_articles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(100),
        author VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FULLTEXT(title, content)
      )`);

      await connection.execute(`INSERT IGNORE INTO test_articles (id, title, content, category, author) VALUES
      (1, 'Getting Started with MySQL', 'MySQL is a popular open-source database management system. This article covers the basics of setting up and using MySQL for your applications.', 'database', 'John Doe'),
      (2, 'Advanced MySQL Queries', 'Learn how to write complex queries in MySQL including joins, subqueries, and advanced functions for better performance.', 'database', 'Jane Smith'),
      (3, 'Node.js Best Practices', 'Explore the best practices for developing scalable Node.js applications including error handling and performance optimization.', 'programming', 'Bob Johnson'),
      (4, 'Full-Text Search in MySQL', 'MySQL provides powerful full-text search capabilities that can be used to build sophisticated search features.', 'database', 'Alice Williams'),
      (5, 'TypeScript for Large Applications', 'TypeScript brings type safety to JavaScript, making it ideal for large-scale applications and team development.', 'programming', 'Charlie Brown')`);

      await connection.execute(`CREATE TABLE IF NOT EXISTS searches (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        query TEXT NOT NULL,
        searchMode ENUM('natural', 'boolean', 'semantic') DEFAULT 'natural',
        database_list TEXT,
        table_list TEXT,
        resultCount INT DEFAULT 0,
        executionTime INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )`);

      await connection.execute(`CREATE TABLE IF NOT EXISTS analytics (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        eventType VARCHAR(50) NOT NULL,
        eventData TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )`);
    } catch (error) {
      logger.error('Failed to setup database schema:', error);
      throw error;
    }
  }

  /**
   * Clean up test data
   */
  async cleanup(): Promise<void> {
    const connection = await this.connect();

    await connection.execute('DELETE FROM analytics');
    await connection.execute('DELETE FROM searches');
    await connection.execute('DELETE FROM database_connections');
    await connection.execute('DELETE FROM users');
    await connection.execute('ALTER TABLE test_articles AUTO_INCREMENT = 6');
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * Get connection for direct queries
   */
  getConnection(): mysql.Connection {
    if (!this.connection) {
      throw new Error('Database connection not established. Call connect() first.');
    }
    return this.connection;
  }

  /**
   * Execute a query
   */
  async query(sql: string, values?: any[]): Promise<any> {
    const connection = await this.connect();
    const results = await connection.execute(sql, values);
    return Array.isArray(results) ? results[0] : results;
  }
}

// Default test database configuration
export const testDatabaseConfig: TestDatabaseConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '3306'),
  username: process.env.TEST_DB_USERNAME || 'root',
  password: process.env.TEST_DB_PASSWORD || '',
  database: process.env.TEST_DB_DATABASE || 'altus4_test',
  ssl: process.env.TEST_DB_SSL === 'true',
};

// Singleton test database instance
export const testDatabase = new TestDatabase(testDatabaseConfig);
