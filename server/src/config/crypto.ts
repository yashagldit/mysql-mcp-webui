import crypto from 'crypto';
import type { EncryptedData } from '../types/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM mode
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits
const TAG_LENGTH = 16;

/**
 * Generates a cryptographically secure random token
 * @param length Length of the token (default: 64 characters)
 * @returns Random hex string
 */
export function generateToken(length: number = 64): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Derives an encryption key from the server token using scrypt
 * @param serverToken The server authentication token
 * @param salt Salt for key derivation
 * @returns Derived key buffer
 */
function deriveKey(serverToken: string, salt: Buffer): Buffer {
  return crypto.scryptSync(serverToken, salt, KEY_LENGTH);
}

/**
 * Encrypts a password using AES-256-GCM
 * @param password Plain text password
 * @param serverToken Server token used for key derivation
 * @returns Encrypted data object with iv, authTag, and encrypted content
 */
export function encryptPassword(password: string, serverToken: string): EncryptedData {
  try {
    // Generate random IV and salt
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key from server token
    const key = deriveKey(serverToken, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt password
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted,
      iv: iv.toString('hex') + ':' + salt.toString('hex'), // Store IV and salt together
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    throw new Error(`Failed to encrypt password: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts a password using AES-256-GCM
 * @param encryptedData Encrypted data object
 * @param serverToken Server token used for key derivation
 * @returns Decrypted plain text password
 */
export function decryptPassword(encryptedData: EncryptedData, serverToken: string): string {
  try {
    // Parse IV and salt
    const [ivHex, saltHex] = encryptedData.iv.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const salt = Buffer.from(saltHex, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');

    // Derive key from server token
    const key = deriveKey(serverToken, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt password
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Failed to decrypt password: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param a First string
 * @param b Second string
 * @returns True if strings are equal
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return crypto.timingSafeEqual(bufA, bufB);
}
