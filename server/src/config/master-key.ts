import { generateToken } from './crypto.js';
import { getDatabaseManager } from '../db/database-manager.js';

/**
 * Master key used for encrypting database passwords
 * This is stored in the database settings and generated on first run
 */

let masterKeyCache: string | null = null;

/**
 * Get or create the master encryption key
 */
export function getMasterKey(): string {
  if (masterKeyCache) {
    return masterKeyCache;
  }

  const dbManager = getDatabaseManager();
  let masterKey = dbManager.getSetting('masterKey');

  if (!masterKey) {
    // Generate new master key
    masterKey = generateToken(64);
    dbManager.setSetting('masterKey', masterKey);
    console.error('Generated new master encryption key');
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
