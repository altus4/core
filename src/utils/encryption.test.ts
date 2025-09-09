// Mock dependencies first
const mockBcrypt = {
  hash: jest.fn(),
  compare: jest.fn(),
};

jest.mock('bcrypt', () => mockBcrypt);

// Mock crypto after declaration
const mockCipher = {
  update: jest.fn(),
  final: jest.fn(),
  getAuthTag: jest.fn(),
};

const mockDecipher = {
  setAuthTag: jest.fn(),
  update: jest.fn(),
  final: jest.fn(),
};

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(() => Buffer.from('defaultRandomBytes123456789012345', 'utf8')),
  randomInt: jest.fn(),
  createCipheriv: jest.fn(),
  createDecipheriv: jest.fn(),
  createHmac: jest.fn(),
  timingSafeEqual: jest.fn(),
}));

import crypto from 'crypto';
import { EncryptionUtil } from './encryption';

const mockCrypto = crypto as jest.Mocked<typeof crypto>;

describe('EncryptionUtil', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BCRYPT_ROUNDS;
    delete process.env.ENCRYPTION_KEY;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password with default salt rounds', async () => {
      const password = 'testPassword123';
      const hashedPassword = '$2b$12$hashedPasswordString';

      mockBcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await EncryptionUtil.hashPassword(password);

      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });

    it('should hash password with custom salt rounds from environment', async () => {
      process.env.BCRYPT_ROUNDS = '10';
      const password = 'testPassword123';
      const hashedPassword = '$2b$10$hashedPasswordString';

      mockBcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await EncryptionUtil.hashPassword(password);

      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(result).toBe(hashedPassword);
    });

    it('should handle invalid BCRYPT_ROUNDS environment variable', async () => {
      process.env.BCRYPT_ROUNDS = 'invalid';
      const password = 'testPassword123';
      const hashedPassword = '$2b$12$hashedPasswordString';

      mockBcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await EncryptionUtil.hashPassword(password);

      // Should fall back to default (12) when parseInt fails
      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });

    it('should handle bcrypt errors', async () => {
      const password = 'testPassword123';
      const error = new Error('Hashing failed');

      mockBcrypt.hash.mockRejectedValue(error);

      await expect(EncryptionUtil.hashPassword(password)).rejects.toThrow('Hashing failed');
    });

    it('should handle empty password', async () => {
      const password = '';
      const hashedPassword = '$2b$12$hashedEmptyString';

      mockBcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await EncryptionUtil.hashPassword(password);

      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'testPassword123';
      const hash = '$2b$12$hashedPasswordString';

      mockBcrypt.compare.mockResolvedValue(true);

      const result = await EncryptionUtil.comparePassword(password, hash);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching password and hash', async () => {
      const password = 'wrongPassword';
      const hash = '$2b$12$hashedPasswordString';

      mockBcrypt.compare.mockResolvedValue(false);

      const result = await EncryptionUtil.comparePassword(password, hash);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(false);
    });

    it('should handle bcrypt comparison errors', async () => {
      const password = 'testPassword123';
      const hash = '$2b$12$hashedPasswordString';
      const error = new Error('Comparison failed');

      mockBcrypt.compare.mockRejectedValue(error);

      await expect(EncryptionUtil.comparePassword(password, hash)).rejects.toThrow(
        'Comparison failed'
      );
    });

    it('should handle empty password comparison', async () => {
      const password = '';
      const hash = '$2b$12$hashedEmptyString';

      mockBcrypt.compare.mockResolvedValue(false);

      const result = await EncryptionUtil.comparePassword(password, hash);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(false);
    });

    it('should handle invalid hash format', async () => {
      const password = 'testPassword123';
      const hash = 'invalidHashFormat';

      mockBcrypt.compare.mockResolvedValue(false);

      const result = await EncryptionUtil.comparePassword(password, hash);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(false);
    });
  });

  describe('encrypt', () => {
    beforeEach(() => {
      mockCipher.update.mockReturnValue('616263646566676869');
      mockCipher.final.mockReturnValue('6a6b6c6d6e6f707172');
      mockCipher.getAuthTag.mockReturnValue(Buffer.from('authtagbuffer123', 'utf8'));

      mockCrypto.randomBytes.mockReturnValue(Buffer.from('1234567890abcdef', 'hex') as any);
      mockCrypto.createCipheriv.mockReturnValue(mockCipher as any);
    });

    it('should encrypt text successfully', () => {
      const plainText = 'sensitive data to encrypt';

      const result = EncryptionUtil.encrypt(plainText);

      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(16);
      expect(mockCrypto.createCipheriv).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer),
        expect.any(Buffer)
      );
      expect(mockCipher.update).toHaveBeenCalledWith(plainText, 'utf8', 'hex');
      expect(mockCipher.final).toHaveBeenCalledWith('hex');
      expect(mockCipher.getAuthTag).toHaveBeenCalled();

      // Should return format: iv:authTag:encrypted
      expect(result).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });

    it('should encrypt empty string', () => {
      const plainText = '';

      const result = EncryptionUtil.encrypt(plainText);

      expect(mockCipher.update).toHaveBeenCalledWith('', 'utf8', 'hex');
      expect(result).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });

    it('should handle encryption errors', () => {
      const plainText = 'sensitive data';
      const error = new Error('Cipher failed');

      mockCipher.update.mockImplementation(() => {
        throw error;
      });

      expect(() => EncryptionUtil.encrypt(plainText)).toThrow('Encryption failed: Cipher failed');
    });

    it('should handle unknown encryption errors', () => {
      const plainText = 'sensitive data';

      mockCipher.update.mockImplementation(() => {
        throw 'Unknown error';
      });

      expect(() => EncryptionUtil.encrypt(plainText)).toThrow('Encryption failed: Unknown error');
    });

    it('should use environment encryption key', () => {
      // Mock the environment variable properly by using the import-time generated key
      const plainText = 'test data';

      EncryptionUtil.encrypt(plainText);

      expect(mockCrypto.createCipheriv).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer),
        expect.any(Buffer)
      );
    });
  });

  describe('environment key selection', () => {
    const originalEnv = { ...process.env };
    afterEach(() => {
      process.env = { ...originalEnv };
      jest.resetModules();
    });

    it('uses random key in non-test when ENCRYPTION_KEY is missing (branch coverage)', async () => {
      jest.isolateModules(() => {
        process.env.NODE_ENV = 'production';
        delete process.env.ENCRYPTION_KEY;
        const rbSpy = jest
          .spyOn(require('crypto'), 'randomBytes')
          .mockReturnValue(Buffer.alloc(32, 7));
        // Re-require module to re-evaluate key selection logic
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('@/utils/encryption');
        expect(mod.EncryptionUtil).toBeDefined();
        expect(rbSpy).toHaveBeenCalled();
        rbSpy.mockRestore();
      });
    });

    it('uses provided valid ENCRYPTION_KEY (no random key)', async () => {
      jest.isolateModules(() => {
        const validKey = 'a'.repeat(64);
        process.env.NODE_ENV = 'production';
        process.env.ENCRYPTION_KEY = validKey;
        const rbSpy = jest.spyOn(require('crypto'), 'randomBytes');
        const cryptoMod = require('crypto');

        // Create a mock cipher object that behaves like the real one
        const mockCipher = {
          update: jest.fn().mockReturnValue('encrypted'),
          final: jest.fn().mockReturnValue('data'),
          getAuthTag: jest.fn().mockReturnValue(Buffer.from('authTag')),
        };

        const ccSpy = jest.spyOn(cryptoMod, 'createCipheriv').mockReturnValue(mockCipher);

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { EncryptionUtil: ModUtil } = require('@/utils/encryption');
        ModUtil.encrypt('hello');

        // Should not generate a random key when env key is valid
        expect(rbSpy).not.toHaveBeenCalledWith(32);
        // Assert the key buffer matches our env key
        const passedKey = ccSpy.mock.calls[0][1] as Buffer;
        expect(Buffer.isBuffer(passedKey)).toBe(true);
        expect(passedKey.toString('hex')).toBe(validKey);

        ccSpy.mockRestore();
        rbSpy.mockRestore();
      });
    });
  });

  describe('decrypt', () => {
    beforeEach(() => {
      mockDecipher.setAuthTag.mockReturnValue(undefined);
      mockDecipher.update.mockReturnValue('decryptedPart1');
      mockDecipher.final.mockReturnValue('decryptedPart2');

      mockCrypto.createDecipheriv.mockReturnValue(mockDecipher as any);
    });

    it('should decrypt text successfully', () => {
      const encryptedText = 'aabbccdd:eeffgghh:iijjkkllmm';

      const result = EncryptionUtil.decrypt(encryptedText);

      expect(mockCrypto.createDecipheriv).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer),
        Buffer.from('aabbccdd', 'hex')
      );
      expect(mockDecipher.setAuthTag).toHaveBeenCalledWith(Buffer.from('eeffgghh', 'hex'));
      expect(mockDecipher.update).toHaveBeenCalledWith('iijjkkllmm', 'hex', 'utf8');
      expect(mockDecipher.final).toHaveBeenCalledWith('utf8');
      expect(result).toBe('decryptedPart1decryptedPart2');
    });

    it('should handle invalid encrypted text format - too few parts', () => {
      const encryptedText = 'onlyonepart';

      expect(() => EncryptionUtil.decrypt(encryptedText)).toThrow(
        'Decryption failed: Invalid encrypted text format'
      );
    });

    it('should handle invalid encrypted text format - too many parts', () => {
      const encryptedText = 'part1:part2:part3:part4';

      expect(() => EncryptionUtil.decrypt(encryptedText)).toThrow(
        'Decryption failed: Invalid encrypted text format'
      );
    });

    it('should handle invalid encrypted text format - empty string', () => {
      const encryptedText = '';

      expect(() => EncryptionUtil.decrypt(encryptedText)).toThrow(
        'Decryption failed: Invalid encrypted text format'
      );
    });

    it('should handle decryption errors', () => {
      const encryptedText = 'aabbccdd:eeffgghh:iijjkkllmm';
      const error = new Error('Decipher failed');

      mockDecipher.update.mockImplementation(() => {
        throw error;
      });

      expect(() => EncryptionUtil.decrypt(encryptedText)).toThrow(
        'Decryption failed: Decipher failed'
      );
    });

    it('should handle unknown decryption errors', () => {
      const encryptedText = 'aabbccdd:eeffgghh:iijjkkllmm';

      mockDecipher.final.mockImplementation(() => {
        throw 'Unknown decryption error';
      });

      expect(() => EncryptionUtil.decrypt(encryptedText)).toThrow(
        'Decryption failed: Unknown error'
      );
    });

    it('should use environment encryption key for decryption', () => {
      const encryptedText = 'aabbccdd:eeffgghh:iijjkkllmm';

      EncryptionUtil.decrypt(encryptedText);

      expect(mockCrypto.createDecipheriv).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer),
        Buffer.from('aabbccdd', 'hex')
      );
    });
  });

  describe('generateToken', () => {
    it('should generate token with default length', () => {
      const mockBuffer = Buffer.from('randomBytes32CharactersLong123456', 'utf8');
      mockCrypto.randomBytes.mockReturnValue(mockBuffer as any);

      const result = EncryptionUtil.generateToken();

      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
      expect(result).toBe(mockBuffer.toString('hex'));
    });

    it('should generate token with custom length', () => {
      const mockBuffer = Buffer.from('randomBytes16Chars12', 'utf8');
      mockCrypto.randomBytes.mockReturnValue(mockBuffer as any);

      const result = EncryptionUtil.generateToken(16);

      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(16);
      expect(result).toBe(mockBuffer.toString('hex'));
    });

    it('should generate token with zero length', () => {
      const mockBuffer = Buffer.from('', 'utf8');
      mockCrypto.randomBytes.mockReturnValue(mockBuffer as any);

      const result = EncryptionUtil.generateToken(0);

      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(0);
      expect(result).toBe('');
    });

    it('should handle crypto.randomBytes errors', () => {
      const error = new Error('Random bytes generation failed');
      mockCrypto.randomBytes.mockImplementation(() => {
        throw error;
      });

      expect(() => EncryptionUtil.generateToken()).toThrow('Random bytes generation failed');
    });
  });

  describe('generatePassword', () => {
    beforeEach(() => {
      // Mock randomInt to return predictable values for testing
      let callCount = 0;
      mockCrypto.randomInt.mockImplementation(() => {
        const values = [0, 25, 51, 61]; // Indices for 'a', 'z', 'Z', '9' (index 61 for '9')
        return values[callCount++ % values.length];
      });
    });

    it('should generate password with default length', () => {
      const result = EncryptionUtil.generatePassword();

      expect(result).toHaveLength(16);
      expect(crypto.randomInt).toHaveBeenCalledTimes(16);
      // With our mock, it should generate 'azZ9azZ9azZ9azZ9'
      expect(result).toBe('azZ9azZ9azZ9azZ9');
    });

    it('should generate password with custom length', () => {
      const result = EncryptionUtil.generatePassword(8);

      expect(result).toHaveLength(8);
      expect(crypto.randomInt).toHaveBeenCalledTimes(8);
      expect(result).toBe('azZ9azZ9');
    });

    it('should generate empty password with zero length', () => {
      const result = EncryptionUtil.generatePassword(0);

      expect(result).toHaveLength(0);
      expect(result).toBe('');
    });

    it('should generate single character password', () => {
      const result = EncryptionUtil.generatePassword(1);

      expect(result).toHaveLength(1);
      expect(result).toBe('a'); // First character in our mock sequence
    });

    it('should handle crypto.randomInt errors', () => {
      const error = new Error('Random int generation failed');
      mockCrypto.randomInt.mockImplementation(() => {
        throw error;
      });

      expect(() => EncryptionUtil.generatePassword()).toThrow('Random int generation failed');
    });

    it('should use correct charset bounds', () => {
      EncryptionUtil.generatePassword(2);

      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      expect(mockCrypto.randomInt).toHaveBeenCalledWith(0, charset.length);
    });
  });

  describe('createSignature', () => {
    let mockHmac: any;

    beforeEach(() => {
      mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('mocked-signature-hex'),
      };

      mockCrypto.createHmac.mockReturnValue(mockHmac);
    });

    it('should create signature with default encryption key', () => {
      const data = 'data to sign';

      const result = EncryptionUtil.createSignature(data);

      expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', expect.any(String));
      expect(mockHmac.update).toHaveBeenCalledWith(data);
      expect(mockHmac.digest).toHaveBeenCalledWith('hex');
      expect(result).toBe('mocked-signature-hex');
    });

    it('should create signature with custom secret', () => {
      const data = 'data to sign';
      const secret = 'custom-secret-key';

      const result = EncryptionUtil.createSignature(data, secret);

      expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', secret);
      expect(mockHmac.update).toHaveBeenCalledWith(data);
      expect(mockHmac.digest).toHaveBeenCalledWith('hex');
      expect(result).toBe('mocked-signature-hex');
    });

    it('should handle empty data', () => {
      const data = '';

      const result = EncryptionUtil.createSignature(data);

      expect(mockHmac.update).toHaveBeenCalledWith('');
      expect(result).toBe('mocked-signature-hex');
    });

    it('should use environment encryption key when no secret provided', () => {
      const data = 'test data';

      EncryptionUtil.createSignature(data);

      expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', expect.any(String));
    });

    it('should handle HMAC creation errors', () => {
      const data = 'test data';
      const error = new Error('HMAC creation failed');

      mockCrypto.createHmac.mockImplementation(() => {
        throw error;
      });

      expect(() => EncryptionUtil.createSignature(data)).toThrow('HMAC creation failed');
    });
  });

  describe('verifySignature', () => {
    let mockHmac: any;

    beforeEach(() => {
      mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('expected-signature'),
      };

      mockCrypto.createHmac.mockReturnValue(mockHmac);
      mockCrypto.timingSafeEqual.mockReturnValue(true);
    });

    it('should verify valid signature with default key', () => {
      const data = 'data to verify';
      const signature = 'expected-signature';

      const result = EncryptionUtil.verifySignature(data, signature);

      expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', expect.any(String));
      expect(mockHmac.update).toHaveBeenCalledWith(data);
      expect(mockHmac.digest).toHaveBeenCalledWith('hex');
      expect(mockCrypto.timingSafeEqual).toHaveBeenCalledWith(
        Buffer.from(signature, 'hex'),
        Buffer.from('expected-signature', 'hex')
      );
      expect(result).toBe(true);
    });

    it('should verify valid signature with custom secret', () => {
      const data = 'data to verify';
      const signature = 'expected-signature';
      const secret = 'custom-secret';

      const result = EncryptionUtil.verifySignature(data, signature, secret);

      expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', secret);
      expect(result).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const data = 'data to verify';
      const signature = 'wrong-signature';
      mockCrypto.timingSafeEqual.mockReturnValue(false);

      const result = EncryptionUtil.verifySignature(data, signature);

      // Should return false due to length mismatch without calling timingSafeEqual
      expect(result).toBe(false);
    });

    it('should return false when signatures have equal length but differ', () => {
      const data = 'data to verify';
      // Match expected length from mocked digest('hex')
      const expected = 'expected-signature';
      const equalLengthDifferent = 'x'.repeat(expected.length);
      mockCrypto.timingSafeEqual.mockReturnValue(false);

      const result = EncryptionUtil.verifySignature(data, equalLengthDifferent);

      expect(mockCrypto.timingSafeEqual).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should handle empty data verification', () => {
      const data = '';
      const signature = 'some-signature';

      const result = EncryptionUtil.verifySignature(data, signature);

      expect(mockHmac.update).toHaveBeenCalledWith('');
      // Should return false due to signature length mismatch
      expect(result).toBe(false);
    });

    it('should handle empty signature', () => {
      const data = 'test data';
      const signature = '';

      const result = EncryptionUtil.verifySignature(data, signature);

      // Should return false due to signature length mismatch
      expect(result).toBe(false);
    });

    it('should use environment encryption key when no secret provided', () => {
      const data = 'test data';
      const signature = 'test-signature';

      EncryptionUtil.verifySignature(data, signature);

      expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', expect.any(String));
    });

    it('should handle HMAC creation errors during verification', () => {
      const data = 'test data';
      const signature = 'test-signature';
      const error = new Error('HMAC verification failed');

      mockCrypto.createHmac.mockImplementation(() => {
        throw error;
      });

      // Should return false instead of throwing due to try-catch wrapper
      const result = EncryptionUtil.verifySignature(data, signature);
      expect(result).toBe(false);
    });

    it('should handle timing safe equal errors', () => {
      const data = 'test data';
      const signature = 'expected-signature'; // Same length to pass length check
      const error = new Error('Timing safe comparison failed');

      mockCrypto.timingSafeEqual.mockImplementation(() => {
        throw error;
      });

      // Should return false instead of throwing due to try-catch wrapper
      const result = EncryptionUtil.verifySignature(data, signature);
      expect(result).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    // These tests use the real crypto functions (not mocked) for full integration
    beforeEach(() => {
      // Restore real crypto functions for integration tests
      jest.doMock('crypto', () => jest.requireActual('crypto'));

      // Clear modules to get fresh imports
      jest.resetModules();
    });

    afterEach(() => {
      // Restore mocks after integration tests
      jest.clearAllMocks();
    });

    it('should encrypt and decrypt data successfully', async () => {
      // Re-import EncryptionUtil to use real crypto
      const { EncryptionUtil: RealEncryptionUtil } = await import('./encryption');

      const originalText = 'This is sensitive data that needs encryption!';

      const encrypted = RealEncryptionUtil.encrypt(originalText);
      expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);

      const decrypted = RealEncryptionUtil.decrypt(encrypted);
      expect(decrypted).toBe(originalText);
    });

    it('should create and verify signatures correctly', async () => {
      // Re-import EncryptionUtil to use real crypto
      const { EncryptionUtil: RealEncryptionUtil } = await import('./encryption');

      const data = 'Important data to sign';
      const secret = 'shared-secret-key';

      const signature = RealEncryptionUtil.createSignature(data, secret);
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);

      const isValid = RealEncryptionUtil.verifySignature(data, signature, secret);
      expect(isValid).toBe(true);

      const isInvalid = RealEncryptionUtil.verifySignature(data, 'wrong-signature', secret);
      expect(isInvalid).toBe(false);
    });

    it('should generate unique tokens', async () => {
      // Re-import EncryptionUtil to use real crypto
      const { EncryptionUtil: RealEncryptionUtil } = await import('./encryption');

      const token1 = RealEncryptionUtil.generateToken(16);
      const token2 = RealEncryptionUtil.generateToken(16);

      expect(token1).not.toBe(token2);
      expect(token1).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(token2).toHaveLength(32);
    });

    it('should generate passwords with correct charset', async () => {
      // Re-import EncryptionUtil to use real crypto
      const { EncryptionUtil: RealEncryptionUtil } = await import('./encryption');

      const password = RealEncryptionUtil.generatePassword(100);
      const charset = /^[a-zA-Z0-9!@#$%^&*]+$/;

      expect(password).toHaveLength(100);
      expect(password).toMatch(charset);

      // Should contain at least one character from each category
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%^&*]/);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      // Restore real crypto functions for edge case tests
      jest.doMock('crypto', () => jest.requireActual('crypto'));
      jest.resetModules();
    });

    it('should handle very long strings for encryption', async () => {
      // Re-import EncryptionUtil to use real crypto
      const { EncryptionUtil: RealEncryptionUtil } = await import('./encryption');

      const longText = 'x'.repeat(10000);

      const encrypted = RealEncryptionUtil.encrypt(longText);
      const decrypted = RealEncryptionUtil.decrypt(encrypted);

      expect(decrypted).toBe(longText);
    });

    it('should handle special characters in encryption', async () => {
      // Re-import EncryptionUtil to use real crypto
      const { EncryptionUtil: RealEncryptionUtil } = await import('./encryption');

      const specialText = '!@#$%^&*()_+{}|:"<>?[]\\;\',./-=`~\n\t\r';

      const encrypted = RealEncryptionUtil.encrypt(specialText);
      const decrypted = RealEncryptionUtil.decrypt(encrypted);

      expect(decrypted).toBe(specialText);
    });

    it('should handle unicode characters in encryption', async () => {
      // Re-import EncryptionUtil to use real crypto
      const { EncryptionUtil: RealEncryptionUtil } = await import('./encryption');

      const unicodeText = 'Hello 世界 🌍 émojis 🚀 symbols ∆∇∈∉';

      const encrypted = RealEncryptionUtil.encrypt(unicodeText);
      const decrypted = RealEncryptionUtil.decrypt(encrypted);

      expect(decrypted).toBe(unicodeText);
    });
  });
});
