import * as crypto from 'crypto';

// Read encryption key from environment variable (required)
const keyBase64 = process.env.ENCRYPTION_KEY;
// Read old encryption key for key rotation (optional)
const oldKeyBase64 = process.env.OLD_ENCRYPTION_KEY; // Add this env var key for rotation

if (!keyBase64) {
  throw new Error('ENCRYPTION_KEY environment variable is not set');
}
// Decode base64 key to Buffer (must be 32 bytes for AES-256)
const ENCRYPTION_KEY = Buffer.from(keyBase64, 'base64');
if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be a base64-encoded 32-byte string');
}

// Decode old key if present (for decrypting legacy data during key rotation)
let OLD_ENCRYPTION_KEY: Buffer | undefined = undefined;
if (oldKeyBase64) {
  OLD_ENCRYPTION_KEY = Buffer.from(oldKeyBase64, 'base64');
  if (OLD_ENCRYPTION_KEY.length !== 32) {
    throw new Error('OLD_ENCRYPTION_KEY must be a base64-encoded 32-byte string');
  }
}

// IV length for AES-GCM (12 bytes recommended)
const IV_LENGTH = 12; // Recommended IV length for AES-GCM

// Encrypts any value (stringified) using AES-256-GCM and returns base64 string
export function encrypt(value: any, key: Buffer = ENCRYPTION_KEY): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  // Stringify the value before encrypting (handles strings, objects, numbers etc)
  const stringValue = JSON.stringify(value);

  const encrypted = Buffer.concat([cipher.update(stringValue, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine iv + tag + encrypted and return as base64
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

// Decrypts a base64-encoded string using the current key, falls back to old key if present
export function decrypt(encryptedValue: string): any {
  try {
    return decryptWithKey(encryptedValue, ENCRYPTION_KEY);
  } catch (error) {
    // If decryption fails with current key, try with old key (for key rotation)
    if (OLD_ENCRYPTION_KEY) {
      return decryptWithKey(encryptedValue, OLD_ENCRYPTION_KEY);
    }
    // Log warning if decryption fails
    console.warn('Decryption failed for value:', error.message);
    return null;
  }
}

// Decrypts a base64-encoded string using a specific key
export function decryptWithKey(encryptedValue: string, key: Buffer): any {
  const buffer = Buffer.from(encryptedValue, 'base64');

  // Extract IV, authentication tag, and encrypted text from buffer
  const iv = buffer.slice(0, IV_LENGTH);
  const tag = buffer.slice(IV_LENGTH, IV_LENGTH + 16);
  const encryptedText = buffer.slice(IV_LENGTH + 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);

  // Parse decrypted string back to original type
  return JSON.parse(decrypted.toString('utf8'));
}
