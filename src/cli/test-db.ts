#!/usr/bin/env node

/**
 * Database connection test utility for debugging Heroku deployments
 */
import { config } from '@/config';
import mysql from 'mysql2/promise';
import { logger } from '@/utils/logger';

async function testDatabaseConnection() {
  logger.info('🔍 Testing database connection...');
  logger.info(`Environment: ${config.environment}`);

  // Log configuration (without password)
  logger.info('\n📋 Database Configuration:');
  logger.info(`Host: ${config.database.host}`);
  logger.info(`Port: ${config.database.port}`);
  logger.info(`Username: ${config.database.username}`);
  logger.info(`Database: ${config.database.database}`);
  logger.info(`Password: ${'*'.repeat(config.database.password?.length || 0)}`);

  // Log raw environment variables for debugging
  logger.info('\n🌍 Raw Environment Variables:');
  logger.info(`CLEARDB_DATABASE_URL: ${process.env.CLEARDB_DATABASE_URL ? 'SET' : 'NOT SET'}`);
  logger.info(`JAWSDB_URL: ${process.env.JAWSDB_URL ? 'SET' : 'NOT SET'}`);
  logger.info(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
  logger.info(`DB_HOST: ${process.env.DB_HOST || 'NOT SET'}`);
  logger.info(`DB_USERNAME: ${process.env.DB_USERNAME || 'NOT SET'}`);
  logger.info(`DB_DATABASE: ${process.env.DB_DATABASE || 'NOT SET'}`);

  try {
    // Test connection
    logger.info('\n🔌 Testing connection...');

    // SSL configuration for production (Heroku/ClearDB)
    const sslConfig =
      config.environment === 'production'
        ? {
            rejectUnauthorized: false, // ClearDB uses self-signed certificates
          }
        : undefined;

    const connectionConfig: any = {
      host: config.database.host,
      port: config.database.port,
      user: config.database.username,
      password: config.database.password,
      database: config.database.database,
      connectTimeout: 10000,
    };

    if (sslConfig) {
      connectionConfig.ssl = sslConfig;
    }

    const connection = await mysql.createConnection(connectionConfig);

    logger.info(`SSL enabled: ${sslConfig !== undefined}`);

    logger.info('✅ Database connection successful!');

    // Test basic query
    logger.info('\n📊 Testing basic query...');
    const [rows] = await connection.execute('SELECT 1 as test, NOW() as currentTime');
    logger.info('Query result:', rows);

    // Check database info
    logger.info('\n🏷️  Database Information:');
    const [dbInfo] = await connection.execute(
      'SELECT DATABASE() as current_db, VERSION() as mysql_version'
    );
    logger.info('Database info:', dbInfo);

    // List existing tables
    logger.info('\n📋 Existing Tables:');
    const [tables] = await connection.execute('SHOW TABLES');
    logger.info('Tables:', tables);

    // Check if migrations table exists
    logger.info('\n🔍 Checking migrations table...');
    try {
      const [migrations] = await connection.execute(
        'SELECT * FROM migrations ORDER BY id DESC LIMIT 5'
      );
      logger.info('Recent migrations:', migrations);
    } catch (_error) {
      logger.info('❌ Migrations table does not exist or is empty');
    }

    await connection.end();
    logger.info('\n✅ Database test completed successfully!');
  } catch (error: any) {
    logger.error('\n❌ Database connection failed:');
    logger.error(`Error code: ${error.code}`);
    logger.error(`Error message: ${error.message}`);
    logger.error('Error details:', error);

    // Common error suggestions
    if (error.code === 'ENOTFOUND') {
      logger.info('\n💡 Suggestions:');
      logger.info('- Check if the database host is correct');
      logger.info('- Verify add-on is properly provisioned');
      logger.info('- Run: heroku addons');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      logger.info('\n💡 Suggestions:');
      logger.info('- Check database credentials');
      logger.info('- Verify CLEARDB_DATABASE_URL is set correctly');
      logger.info('- Run: heroku config:get CLEARDB_DATABASE_URL');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      logger.info('\n💡 Suggestions:');
      logger.info('- Database name might be incorrect');
      logger.info('- Check the database name in the connection URL');
    }

    process.exit(1);
  }
}

// Run the test
testDatabaseConnection().catch(error => {
  logger.error('Unexpected error:', error);
  process.exit(1);
});
