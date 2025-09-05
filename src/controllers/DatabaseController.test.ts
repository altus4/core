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
        password: '', // Should be empty in response
        ssl: false,
        isActive: true,
      });
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockConnection.execute.mockRejectedValue(dbError);

      await expect(databaseController.getUserConnections('user-123')).rejects.toThrow(
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
        password: '', // Should be empty
      });
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
      expect(result.password).toBe(''); // Password should be empty in response
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
