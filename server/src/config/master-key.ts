import { generateToken } from './crypto.js';
import { getDatabaseManager } from '../db/database-manager.js';

/**
 * Master key used for encrypting database passwords
 * This is stored in the database settings and generated on first run
 */

let masterKeyCache: string | null = null;

/**
 * Get or create the master encryption key
 * Uses atomic INSERT OR IGNORE to prevent race conditions between multiple instances
 */
export function getMasterKey(): string {
  if (masterKeyCache) {
    return masterKeyCache;
  }

  const dbManager = getDatabaseManager();
  let masterKey = dbManager.getSetting('masterKey');

  if (!masterKey) {
    // Generate a candidate key
    const candidateKey = generateToken(64);

    // Try to insert only if not exists (atomic operation)
    // Returns true if inserted, false if key already existed
    const wasInserted = dbManager.setSettingIfNotExists('masterKey', candidateKey);

    // Read the actual key (either ours or from another instance)
    masterKey = dbManager.getSetting('masterKey');

    if (wasInserted) {
      console.error('Generated new master encryption key');
    }

    if (!masterKey) {
      throw new Error('Failed to get or create master key');
    }
  }

  masterKeyCache = masterKey;
  return masterKey;
}

/**
 * Rotate the master key (requires re-encrypting all passwords)
 * This is a dangerous operation and should be done with caution
 */
export async function rotateMasterKey(): Promise<string> {
  const dbManager = getDatabaseManager();
  const oldKey = getMasterKey();
  const newKey = generateToken(64);

  // Get all connections
  const connections = dbManager.getAllConnections();

  // Re-encrypt all passwords
  for (const conn of connections) {
    const plainPassword = dbManager.getDecryptedPassword(conn.id, oldKey);
    dbManager.updateConnection(
      conn.id,
      { password: plainPassword },
      newKey
    );
  }

  // Save new master key
  dbManager.setSetting('masterKey', newKey);
  masterKeyCache = newKey;

  console.error('Master key rotated successfully');
  return newKey;
}
