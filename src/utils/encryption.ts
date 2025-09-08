/**
 * Encryption Utilities
 *
 * Provides static methods for password hashing, comparison, encryption, and decryption of sensitive data.
 * Uses bcrypt for password security and AES-GCM for data encryption.
 *
 * Usage:
 *   - Use hashPassword and comparePassword for user authentication
 *   - Use encrypt and decrypt for sensitive data storage
 */
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Ensure we have a valid 32-byte (64-hex) key. In test, provide deterministic fallback.
const DEFAULT_TEST_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const ENCRYPTION_KEY = (() => {
  const { ENCRYPTION_KEY: envKey } = process.env;
  if (!envKey || envKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(envKey)) {
    return process.env.NODE_ENV === 'test'
      ? DEFAULT_TEST_KEY_HEX
      : crypto.randomBytes(32).toString('hex');
  }
  return envKey;
})();
const ALGORITHM = 'aes-256-gcm';

export class EncryptionUtil {
  /**
   * Hash password using bcrypt.
   *
   * @param password - Plain text password
   * @returns Hashed password string
   */
  public static async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10) || 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash using bcrypt.
   *
   * @param password - Plain text password
   * @param hash - Hashed password
   * @returns True if match, false otherwise
   */
  public static async comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Encrypt sensitive data (e.g., database credentials) using AES-GCM.
   *
   * @param text - Plain text to encrypt
   * @returns Encrypted string with IV and auth tag
   */
  public static encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Decrypt sensitive data using AES-GCM.
   *
   * @param encryptedText - Encrypted string with IV and auth tag
   * @returns Decrypted plain text
   */
  public static decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate a secure random token
   */
  public static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a cryptographically secure random password
   */
  public static generatePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }

    return password;
  }

  /**
   * Create HMAC signature
   */
  public static createSignature(data: string, secret?: string): string {
    const key = secret || ENCRYPTION_KEY;
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  public static verifySignature(data: string, signature: string, secret?: string): boolean {
    try {
      const key = secret || ENCRYPTION_KEY;
      const expectedSignature = crypto.createHmac('sha256', key).update(data).digest('hex');

      // Check if signatures have the same length to avoid buffer comparison errors
      if (signature.length !== expectedSignature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (_error) {
      return false;
    }
  }
}
