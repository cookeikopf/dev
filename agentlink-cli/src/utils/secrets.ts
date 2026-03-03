import { safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomBytes } from 'crypto';

/**
 * Encrypted Secrets Manager for AgentLink CLI
 * Uses OS-native keychain when available, falls back to encrypted file
 */

const SECRETS_FILE = path.join(process.cwd(), '.agentlink', 'secrets.enc');
const SALT_FILE = path.join(process.cwd(), '.agentlink', '.salt');

/**
 * Check if we're in an environment with secure storage
 */
function hasSecureStorage(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/**
 * Get or create encryption key (derived from machine-specific data)
 */
function getEncryptionKey(): Buffer {
  let salt: Buffer;
  
  if (fs.existsSync(SALT_FILE)) {
    salt = fs.readFileSync(SALT_FILE);
  } else {
    salt = randomBytes(32);
    fs.mkdirSync(path.dirname(SALT_FILE), { recursive: true });
    fs.writeFileSync(SALT_FILE, salt, { mode: 0o600 }); // Owner read/write only
  }
  
  // Use machine-specific data as key material
  const machineId = process.env.MACHINE_ID || process.env.HOSTNAME || 'default';
  return createHash('sha256').update(machineId).update(salt).digest();
}

/**
 * Store a secret securely
 */
export async function storeSecret(key: string, value: string): Promise<void> {
  if (!value) {
    throw new Error('Cannot store empty secret');
  }

  fs.mkdirSync(path.dirname(SECRETS_FILE), { recursive: true });

  // Try OS-native secure storage first
  if (hasSecureStorage()) {
    try {
      const encrypted = safeStorage.encryptString(value);
      const existing = loadSecretsFile();
      existing[key] = encrypted.toString('base64');
      existing._meta = { ...existing._meta, usesOSStorage: true };
      saveSecretsFile(existing);
      return;
    } catch (error) {
      console.warn('OS secure storage failed, falling back to file encryption');
    }
  }

  // Fallback: Encrypt with machine-derived key
  const keyBuffer = getEncryptionKey();
  const encrypted = encryptAES(value, keyBuffer);
  
  const existing = loadSecretsFile();
  existing[key] = encrypted;
  existing._meta = { ...existing._meta, usesOSStorage: false };
  saveSecretsFile(existing);
}

/**
 * Retrieve a secret
 */
export async function retrieveSecret(key: string): Promise<string | null> {
  const secrets = loadSecretsFile();
  const encrypted = secrets[key];
  
  if (!encrypted) {
    return null;
  }

  // Check if using OS storage
  if (secrets._meta?.usesOSStorage && hasSecureStorage()) {
    try {
      const buffer = Buffer.from(encrypted, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      console.error('Failed to decrypt using OS storage');
      return null;
    }
  }

  // Fallback: Decrypt with machine-derived key
  const keyBuffer = getEncryptionKey();
  return decryptAES(encrypted, keyBuffer);
}

/**
 * Delete a secret
 */
export async function deleteSecret(key: string): Promise<void> {
  const secrets = loadSecretsFile();
  delete secrets[key];
  saveSecretsFile(secrets);
}

/**
 * List all stored secret keys (not values!)
 */
export function listSecretKeys(): string[] {
  const secrets = loadSecretsFile();
  return Object.keys(secrets).filter(k => !k.startsWith('_'));
}

/**
 * Clear ALL secrets (use with caution!)
 */
export async function clearAllSecrets(): Promise<void> {
  if (fs.existsSync(SECRETS_FILE)) {
    fs.unlinkSync(SECRETS_FILE);
  }
  if (fs.existsSync(SALT_FILE)) {
    fs.unlinkSync(SALT_FILE);
  }
}

// ============================================================================
// Private Helper Functions
// ============================================================================

function loadSecretsFile(): Record<string, string> {
  if (!fs.existsSync(SECRETS_FILE)) {
    return { _meta: {} };
  }
  
  try {
    const data = fs.readFileSync(SECRETS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { _meta: {} };
  }
}

function saveSecretsFile(secrets: Record<string, any>): void {
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2), { mode: 0o600 });
}

function encryptAES(plaintext: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = require('crypto').createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decryptAES(ciphertext: string, key: Buffer): string | null {
  try {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = require('crypto').createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

/**
 * Validate secret key format
 */
export function validateSecretKey(key: string): boolean {
  // Only allow alphanumeric and underscore, max 50 chars
  return /^[a-zA-Z0-9_]{1,50}$/.test(key);
}

/**
 * Mask a secret for display (show only first 4 and last 4 chars)
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) {
    return '****';
  }
  return value.slice(0, 4) + '...' + value.slice(-4);
}
