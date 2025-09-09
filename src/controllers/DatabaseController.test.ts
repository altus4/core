import { DatabaseService } from '@/services/DatabaseService';
import type { DatabaseConnection, TableSchema } from '@/types';
import { EncryptionUtil } from '@/utils/encryption';
import { createConnection } from 'mysql2/promise';
import { DatabaseController } from './DatabaseController';

// Mock dependencies
jest.mock('@/services/DatabaseService');
jest.mock('@/utils/encryption');
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
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}));

describe('DatabaseController', () => {
  let databaseController: DatabaseController;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockConnection: any;
  let mockEncryptionUtil: jest.Mocked<typeof EncryptionUtil>;

  const mockDbConnection: DatabaseConnection = {
    id: 'conn-123',
    name: 'Test Connection',
    host: 'localhost',
    port: 3306,
    database: 'test_db',
    username: 'test_user',
    password: 'test_pass',
    ssl: false,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock connection methods
    mockConnection = {
      execute: jest.fn(),
      ping: jest.fn(),
      end: jest.fn(),
    };

    // Mock createConnection
    (createConnection as jest.Mock).mockResolvedValue(mockConnection);

    // Mock DatabaseService
    mockDatabaseService = {
      addConnection: jest.fn(),
      removeConnection: jest.fn(),
      testConnection: jest.fn(),
      discoverSchema: jest.fn(),
    } as any;
    (DatabaseService as jest.MockedClass<typeof DatabaseService>).mockImplementation(
      () => mockDatabaseService
    );

    // Mock EncryptionUtil
    mockEncryptionUtil = {
      encrypt: jest.fn().mockReturnValue('encrypted-password'),
      decrypt: jest.fn().mockReturnValue('decrypted-password'),
    } as any;
    Object.assign(EncryptionUtil, mockEncryptionUtil);

    databaseController = new DatabaseController();
  });

  describe('getUserConnections', () => {
    it('should get user connections successfully', async () => {
      const mockRows = [
        {
          id: 'conn-123',
          name: 'Test Connection',
          host: 'localhost',
          port: 3306,
          database_name: 'test_db',
          username: 'test_user',
          ssl_enabled: false,
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
      ];

      mockConnection.execute.mockResolvedValue([mockRows]);

      const result = await databaseController.getUserConnections('user-123');

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name, host, port'),
        ['user-123']
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'conn-123',
        name: 'Test Connection',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        // password field should not be present in response
        ssl: false,
        isActive: true,
      });
      expect(result[0]).not.toHaveProperty('password');
    });

    it('should map fallback fields when alternative columns are present/missing', async () => {
      const mockRows = [
        {
          id: 'conn-456',
          name: 'Alt Fields Conn',
          host: '127.0.0.1',
          port: 3307,
          // database_name missing; uses fallback to database
          database: 'alt_db',
          username: 'alt_user',
          // ssl_enabled missing; uses fallback to ssl
          ssl: true,
          // is_active missing; defaults to true
          // created_at/updated_at missing; defaults to now
        } as any,
      ];

      mockConnection.execute.mockResolvedValue([mockRows]);

      const result = await databaseController.getUserConnections('user-abc');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'conn-456',
        name: 'Alt Fields Conn',
        host: '127.0.0.1',
        port: 3307,
        database: 'alt_db',
        username: 'alt_user',
        ssl: true,
        isActive: true,
      });
      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].updatedAt).toBeInstanceOf(Date);
    });

    it('constructor should log error if initial ping fails (no throw)', async () => {
      // Make first createConnection().ping reject to exercise initializeConnection catch
      const failingConn = { ping: jest.fn().mockRejectedValue(new Error('ping fail')) } as any;
      const okConn = { ping: jest.fn().mockResolvedValue(undefined) } as any;
      (createConnection as jest.Mock)
        .mockResolvedValueOnce(failingConn) // used by controller.connection
        .mockResolvedValueOnce(okConn); // fallback for any subsequent direct calls

      const controller = new DatabaseController();
      // Allow microtask queue to process initializeConnection
      await new Promise(r => setImmediate(r));
      expect(controller).toBeInstanceOf(DatabaseController);
    });

    it('should handle database errors', async () => {
      // Mock the connection properly
      const dbError = new Error('Database connection failed');
      const errorConnection = {
        execute: jest.fn().mockRejectedValue(dbError),
        ping: jest.fn(),
      };
      (createConnection as jest.Mock).mockResolvedValueOnce(errorConnection);

      const controller = new DatabaseController();

      await expect(controller.getUserConnections('user-123')).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('getConnection', () => {
    it('should get specific connection successfully', async () => {
      const mockRows = [
        {
          id: 'conn-123',
          name: 'Test Connection',
          host: 'localhost',
          port: 3306,
          database_name: 'test_db',
          username: 'test_user',
          ssl_enabled: false,
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
      ];

      mockConnection.execute.mockResolvedValue([mockRows]);

      const result = await databaseController.getConnection('user-123', 'conn-123');

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ? AND user_id = ?'),
        ['conn-123', 'user-123']
      );
      expect(result).toMatchObject({
        id: 'conn-123',
        name: 'Test Connection',
        // password field should not be present in response
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should map alternative column names and defaults', async () => {
      const mockRows = [
        {
          id: 'conn-789',
          name: 'Single Conn',
          host: 'db.local',
          port: 3306,
          // database_name missing; fallback to database
          database: 'single_db',
          username: 'user1',
          // ssl_enabled missing; fallback to ssl
          ssl: false,
          // is_active missing; defaults to true
        } as any,
      ];

      mockConnection.execute.mockResolvedValue([mockRows]);

      const result = await databaseController.getConnection('user-x', 'conn-789');
      expect(result).toMatchObject({
        id: 'conn-789',
        database: 'single_db',
        ssl: false,
        isActive: true,
      });
      expect((result as any).password).toBeUndefined();
    });

    it('should return null when connection not found', async () => {
      mockConnection.execute.mockResolvedValue([[]]);

      const result = await databaseController.getConnection('user-123', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('addConnection', () => {
    const newConnectionData = {
      name: 'New Connection',
      host: 'localhost',
      port: 3306,
      database: 'new_db',
      username: 'new_user',
      password: 'new_pass',
      ssl: false,
    };

    it('should add connection successfully', async () => {
      // Mock successful test connection
      jest.spyOn(databaseController as any, 'testConnectionData').mockResolvedValue(undefined);
      mockConnection.execute.mockResolvedValue([{ insertId: 1 }]);
      mockDatabaseService.addConnection.mockResolvedValue();

      const result = await databaseController.addConnection('user-123', newConnectionData);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO database_connections'),
        expect.arrayContaining([
          'mock-uuid-123',
          'user-123',
          'New Connection',
          'localhost',
          3306,
          'new_db',
          'new_user',
          'encrypted-password',
          false,
          true,
          expect.any(Date),
          expect.any(Date),
          'connected',
        ])
      );
      expect(mockDatabaseService.addConnection).toHaveBeenCalled();
      expect(result).not.toHaveProperty('new_pass'); // Password should not be in response
      expect(result.id).toBe('mock-uuid-123');
    });

    it('should handle connection test failure', async () => {
      const testError = new Error('Connection test failed');
      jest.spyOn(databaseController as any, 'testConnectionData').mockRejectedValue(testError);

      await expect(databaseController.addConnection('user-123', newConnectionData)).rejects.toThrow(
        'Connection test failed'
      );
      expect(mockConnection.execute).not.toHaveBeenCalled();
    });

    it('should add connection with SSL enabled', async () => {
      jest.spyOn(databaseController as any, 'testConnectionData').mockResolvedValue(undefined);
      mockConnection.execute.mockResolvedValue([{ insertId: 1 }]);
      mockDatabaseService.addConnection.mockResolvedValue();

      await databaseController.addConnection('user-ssl', {
        name: 'SSL Conn',
        host: 'secure-host',
        port: 3306,
        database: 'secure_db',
        username: 'secure_user',
        password: 'secure_pass',
        ssl: true,
      });

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO database_connections'),
        expect.arrayContaining([
          'user-ssl',
          'SSL Conn',
          'secure-host',
          3306,
          'secure_db',
          'secure_user',
          'encrypted-password',
          true,
        ])
      );
    });
  });

  describe('updateConnection', () => {
    const updates = {
      name: 'Updated Connection',
      host: 'new-host',
      port: 3307,
    };

    it('should update connection successfully', async () => {
      // Mock existing connection
      jest
        .spyOn(databaseController, 'getConnection')
        .mockResolvedValue(mockDbConnection)
        .mockResolvedValueOnce(mockDbConnection); // First call in method

      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await databaseController.updateConnection('user-123', 'conn-123', updates);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE database_connections SET'),
        expect.arrayContaining(['Updated Connection', 'new-host', 3307])
      );
      expect(result).toBeDefined();
    });

    it('should return null when connection not found', async () => {
      jest.spyOn(databaseController, 'getConnection').mockResolvedValue(null);

      const result = await databaseController.updateConnection('user-123', 'nonexistent', updates);

      expect(result).toBeNull();
    });

    it('should handle empty updates', async () => {
      jest.spyOn(databaseController, 'getConnection').mockResolvedValue(mockDbConnection);

      const result = await databaseController.updateConnection('user-123', 'conn-123', {});

      expect(result).toEqual(mockDbConnection);
      expect(mockConnection.execute).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.anything()
      );
    });

    it('should update database, username, password and ssl fields', async () => {
      const current = { ...mockDbConnection } as any;
      jest
        .spyOn(databaseController, 'getConnection')
        .mockResolvedValue(current)
        .mockResolvedValueOnce(current);

      const encryptSpy = jest
        .spyOn(EncryptionUtil, 'encrypt')
        .mockReturnValue('encrypted-updated-password' as any);
      jest
        .spyOn<any, any>(databaseController as any, 'testConnectionData')
        .mockResolvedValue(undefined);

      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await databaseController.updateConnection('user-123', 'conn-123', {
        database: 'db_new',
        username: 'user_new',
        password: 'pass_new',
        ssl: true,
      });

      expect(encryptSpy).toHaveBeenCalledWith('pass_new');
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE database_connections SET'),
        expect.arrayContaining(['db_new', 'user_new', 'encrypted-updated-password', true])
      );
      expect(result).toBeDefined();
    });
  });

  describe('removeConnection', () => {
    it('should remove connection successfully', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);
      mockDatabaseService.removeConnection.mockResolvedValue();

      const result = await databaseController.removeConnection('user-123', 'conn-123');

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'UPDATE database_connections SET is_active = false, updated_at = ? WHERE id = ? AND user_id = ?',
        [expect.any(Date), 'conn-123', 'user-123']
      );
      expect(mockDatabaseService.removeConnection).toHaveBeenCalledWith('conn-123');
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 0 }]);

      const result = await databaseController.removeConnection('user-123', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      mockDatabaseService.testConnection.mockResolvedValue(true);
      mockConnection.execute.mockResolvedValue([]);

      const result = await databaseController.testConnection('user-123', 'conn-123');

      expect(mockDatabaseService.testConnection).toHaveBeenCalledWith('conn-123');
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE database_connections SET last_tested'),
        [expect.any(Date), 'active', 'conn-123', 'user-123']
      );
      expect(result).toEqual({
        connected: true,
        message: 'Connection successful',
      });
    });

    it('should test connection only when password updated', async () => {
      // Mock testConnectionData method to track calls
      const spy = jest
        .spyOn<any, any>(databaseController as any, 'testConnectionData')
        .mockResolvedValue(undefined);

      // Mock getConnection directly to return a consistent connection object
      const mockConnectionData = {
        id: 'c1',
        name: 'Test Connection',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'user',
        ssl: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(databaseController, 'getConnection').mockResolvedValue(mockConnectionData);

      // Mock the database update operation
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }, {}]);

      // Test 1: Password update - should call testConnectionData
      await databaseController.updateConnection('user1', 'c1', { password: 'newpass' } as any);
      expect(spy).toHaveBeenCalledTimes(1);

      spy.mockClear();

      // Test 2: Host update only - should NOT call testConnectionData
      await databaseController.updateConnection('user1', 'c1', { host: 'other' } as any);
      expect(spy).not.toHaveBeenCalled();

      // Restore spies
      jest.restoreAllMocks();
    });

    it('should handle failed connection test', async () => {
      mockDatabaseService.testConnection.mockResolvedValue(false);
      mockConnection.execute.mockResolvedValue([]);

      const result = await databaseController.testConnection('user-123', 'conn-123');

      expect(result).toEqual({
        connected: false,
        message: 'Connection failed',
      });
    });

    it('should handle test errors gracefully', async () => {
      const testError = new Error('Connection timeout');
      mockDatabaseService.testConnection.mockRejectedValue(testError);

      const result = await databaseController.testConnection('user-123', 'conn-123');

      expect(result).toEqual({
        connected: false,
        message: 'Connection timeout',
      });
    });
  });

  describe('discoverSchema', () => {
    const mockSchemas: TableSchema[] = [
      {
        database: 'test_db',
        table: 'users',
        columns: [
          { name: 'id', type: 'int', isFullTextIndexed: false, isSearchable: true },
          { name: 'name', type: 'varchar', isFullTextIndexed: true, isSearchable: true },
        ],
        fullTextIndexes: [],
        estimatedRows: 100,
        lastAnalyzed: new Date('2024-01-01'),
      },
    ];

    it('should discover schema successfully', async () => {
      jest.spyOn(databaseController, 'getConnection').mockResolvedValue(mockDbConnection);
      mockDatabaseService.discoverSchema.mockResolvedValue(mockSchemas);

      const result = await databaseController.discoverSchema('user-123', 'conn-123');

      expect(databaseController.getConnection).toHaveBeenCalledWith('user-123', 'conn-123');
      expect(mockDatabaseService.discoverSchema).toHaveBeenCalledWith('conn-123');
      expect(result).toEqual(mockSchemas);
    });

    it('should throw error when connection not found', async () => {
      jest.spyOn(databaseController, 'getConnection').mockResolvedValue(null);

      await expect(databaseController.discoverSchema('user-123', 'nonexistent')).rejects.toThrow(
        'Connection not found'
      );
    });
  });

  describe('getConnectionStatuses', () => {
    it('should get all connection statuses', async () => {
      const mockConnections = [
        { ...mockDbConnection, id: 'conn-1' },
        { ...mockDbConnection, id: 'conn-2' },
      ];
      jest.spyOn(databaseController, 'getUserConnections').mockResolvedValue(mockConnections);
      jest
        .spyOn(databaseController, 'testConnection')
        .mockResolvedValueOnce({ connected: true, message: 'OK' })
        .mockResolvedValueOnce({ connected: false, message: 'Failed' });

      const result = await databaseController.getConnectionStatuses('user-123');

      expect(result).toEqual({
        'conn-1': true,
        'conn-2': false,
      });
    });

    it('should handle errors gracefully', async () => {
      jest
        .spyOn(databaseController, 'getUserConnections')
        .mockRejectedValue(new Error('Database error'));

      await expect(databaseController.getConnectionStatuses('user-123')).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('private methods', () => {
    describe('testConnectionData', () => {
      const testData = {
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
        ssl: false,
      };

      it('should test connection successfully', async () => {
        const testConnection = {
          ping: jest.fn().mockResolvedValue(undefined),
          end: jest.fn().mockResolvedValue(undefined),
        };
        (createConnection as jest.Mock).mockResolvedValue(testConnection);

        await expect(
          (databaseController as any).testConnectionData(testData)
        ).resolves.toBeUndefined();

        expect(createConnection).toHaveBeenCalledWith({
          host: 'localhost',
          port: 3306,
          user: 'test_user',
          password: 'test_pass',
          database: 'test_db',
          connectTimeout: 10000,
        });
        expect(testConnection.ping).toHaveBeenCalled();
        expect(testConnection.end).toHaveBeenCalled();
      });

      it('should add SSL config when ssl is true', async () => {
        const testConnection = {
          ping: jest.fn().mockResolvedValue(undefined),
          end: jest.fn().mockResolvedValue(undefined),
        };
        (createConnection as jest.Mock).mockResolvedValue(testConnection);

        await (databaseController as any).testConnectionData({ ...testData, ssl: true });

        expect(createConnection).toHaveBeenCalledWith({
          host: 'localhost',
          port: 3306,
          user: 'test_user',
          password: 'test_pass',
          database: 'test_db',
          connectTimeout: 10000,
          ssl: 'Amazon RDS',
        });
      });

      it('should handle connection failures', async () => {
        const connectionError = new Error('Connection refused');
        const testConnection = {
          ping: jest.fn().mockRejectedValue(connectionError),
          end: jest.fn().mockResolvedValue(undefined),
        };
        (createConnection as jest.Mock).mockResolvedValue(testConnection);

        await expect((databaseController as any).testConnectionData(testData)).rejects.toThrow(
          'Database connection test failed: Connection refused'
        );

        expect(testConnection.end).toHaveBeenCalled();
      });
    });
  });
});
