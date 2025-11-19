import { getDatabaseManager } from '../db/database-manager.js';
import type { DatabaseContext } from '../db/connection-manager.js';
import { loadEnvironment } from '../config/environment.js';

interface Session {
  id: string;
  activeConnections: Set<string>; // connectionIds
  activeDatabases: Map<string, DatabaseContext>; // alias -> context
  currentDatabaseAlias: string | null;
  lastAccessed: number;
  responseFormat: 'json' | 'toon' | null; // Response format preference for this session
}

/**
 * Session manager for HTTP mode
 * Tracks active databases per session (v4.0 alias-based)
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private config = loadEnvironment();

  constructor() {
    // Start cleanup timer
    this.startCleanup();
  }

  /**
   * Get or create a session
   */
  getOrCreateSession(sessionId: string): Session {
    let session = this.sessions.get(sessionId);

    if (!session) {
      // Initialize session with current database
      const dbManager = getDatabaseManager();
      const currentAlias = dbManager.getCurrentDatabaseAlias();

      session = {
        id: sessionId,
        activeConnections: new Set(),
        activeDatabases: new Map(),
        currentDatabaseAlias: currentAlias,
        lastAccessed: Date.now(),
        responseFormat: null,
      };

      // Load current database if set
      if (currentAlias) {
        const dbContext = dbManager.getDatabaseByAlias(currentAlias);
        if (dbContext) {
          session.activeConnections.add(dbContext.connectionId);
          session.activeDatabases.set(currentAlias, {
            ...dbContext,
            lastAccessed: Date.now(),
          });
        }
      }

      this.sessions.set(sessionId, session);
      console.log(`Created new session: ${sessionId}`);
    } else {
      // Update last accessed time
      session.lastAccessed = Date.now();
    }

    return session;
  }

  /**
   * Activate a database by alias for a session
   */
  activateDatabase(sessionId: string, alias: string): void {
    const session = this.getOrCreateSession(sessionId);

    // Check if already active
    if (session.activeDatabases.has(alias)) {
      // Update last accessed
      const context = session.activeDatabases.get(alias)!;
      context.lastAccessed = Date.now();
      return;
    }

    // Get database context
    const dbManager = getDatabaseManager();
    const dbContext = dbManager.getDatabaseByAlias(alias);
    if (!dbContext) {
      throw new Error(`Database with alias '${alias}' not found`);
    }

    // Check if we need to evict databases (reached limit)
    if (session.activeDatabases.size >= this.config.maxActiveDatabases) {
      this.evictLRUDatabase(session);
    }

    // Add to active databases
    const context: DatabaseContext = {
      ...dbContext,
      lastAccessed: Date.now(),
    };
    session.activeDatabases.set(alias, context);
    session.activeConnections.add(dbContext.connectionId);

    // Check if we need to evict connections (reached limit)
    if (session.activeConnections.size > this.config.maxActiveConnections) {
      this.evictUnusedConnections(session);
    }
  }

  /**
   * Deactivate a database by alias for a session
   */
  deactivateDatabase(sessionId: string, alias: string): void {
    const session = this.getOrCreateSession(sessionId);
    const context = session.activeDatabases.get(alias);

    if (!context) {
      return; // Already inactive
    }

    // Remove from active databases
    session.activeDatabases.delete(alias);

    // Check if connection has no more active databases
    const hasOtherDbs = Array.from(session.activeDatabases.values()).some(
      (ctx) => ctx.connectionId === context.connectionId
    );
    if (!hasOtherDbs) {
      session.activeConnections.delete(context.connectionId);
    }

    // If this was the current database, clear current
    if (session.currentDatabaseAlias === alias) {
      session.currentDatabaseAlias = null;
    }
  }

  /**
   * Set the current database for a session
   */
  setCurrentDatabase(sessionId: string, alias: string): void {
    const session = this.getOrCreateSession(sessionId);
    const dbManager = getDatabaseManager();
    const context = dbManager.getDatabaseByAlias(alias);

    if (!context) {
      throw new Error(`Database with alias '${alias}' not found`);
    }

    session.currentDatabaseAlias = alias;
  }

  /**
   * Get the current database for a session
   */
  getCurrentDatabase(sessionId: string): DatabaseContext | null {
    const session = this.getOrCreateSession(sessionId);

    if (!session.currentDatabaseAlias) {
      return null;
    }

    return session.activeDatabases.get(session.currentDatabaseAlias) || null;
  }

  /**
   * Get all active databases for a session
   */
  getActiveDatabases(sessionId: string): DatabaseContext[] {
    const session = this.getOrCreateSession(sessionId);
    return Array.from(session.activeDatabases.values());
  }

  /**
   * Get all active connection IDs for a session
   */
  getActiveConnections(sessionId: string): Set<string> {
    const session = this.getOrCreateSession(sessionId);
    return new Set(session.activeConnections);
  }

  /**
   * Update last accessed time for a database in a session
   */
  updateLastAccessed(sessionId: string, alias: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const context = session.activeDatabases.get(alias);
    if (context) {
      context.lastAccessed = Date.now();
    }
  }

  /**
   * Set the response format for a session
   */
  setResponseFormat(sessionId: string, format: 'json' | 'toon' | null): void {
    const session = this.getOrCreateSession(sessionId);
    session.responseFormat = format;
  }

  /**
   * Get the response format for a session
   */
  getResponseFormat(sessionId: string): 'json' | 'toon' | null {
    const session = this.sessions.get(sessionId);
    return session?.responseFormat || null;
  }

  /**
   * Evict the least recently used database from a session
   */
  private evictLRUDatabase(session: Session): void {
    // Don't evict the current database
    const candidates = Array.from(session.activeDatabases.entries())
      .filter(([alias]) => alias !== session.currentDatabaseAlias);

    if (candidates.length === 0) {
      console.warn('Cannot evict databases: only current database is active');
      return;
    }

    // Find LRU
    const [lruAlias] = candidates.reduce((min, current) =>
      current[1].lastAccessed < min[1].lastAccessed ? current : min
    );

    console.log(`Evicting LRU database from session ${session.id}: ${lruAlias}`);
    const context = session.activeDatabases.get(lruAlias);
    if (context) {
      session.activeDatabases.delete(lruAlias);

      // Check if connection has no more active databases
      const hasOtherDbs = Array.from(session.activeDatabases.values()).some(
        (ctx) => ctx.connectionId === context.connectionId
      );
      if (!hasOtherDbs) {
        session.activeConnections.delete(context.connectionId);
      }
    }
  }

  /**
   * Evict connections that have no active databases from a session
   */
  private evictUnusedConnections(session: Session): void {
    const unusedConnections: string[] = [];

    for (const connectionId of session.activeConnections) {
      const hasDatabases = Array.from(session.activeDatabases.values()).some(
        (ctx) => ctx.connectionId === connectionId
      );

      if (!hasDatabases) {
        unusedConnections.push(connectionId);
      }
    }

    for (const connectionId of unusedConnections) {
      session.activeConnections.delete(connectionId);
      console.log(`Evicted unused connection from session ${session.id}: ${connectionId}`);
    }
  }

  // ============================================================================
  // Legacy methods for backward compatibility (deprecated)
  // ============================================================================

  /**
   * @deprecated Use getCurrentDatabase() instead
   */
  getActiveConnection(sessionId: string): string | null {
    const current = this.getCurrentDatabase(sessionId);
    return current?.connectionId || null;
  }

  /**
   * @deprecated Use setCurrentDatabase() instead
   */
  setActiveConnection(_sessionId: string, _connectionId: string): void {
    console.warn('setActiveConnection is deprecated, use setCurrentDatabase with alias instead');
  }

  /**
   * @deprecated Use getCurrentDatabase() instead
   */
  getActiveDatabase(sessionId: string, _connectionId?: string): string | null {
    const current = this.getCurrentDatabase(sessionId);
    return current?.database || null;
  }

  /**
   * @deprecated Use setCurrentDatabase() and activateDatabase() instead
   */
  setActiveDatabase(_sessionId: string, _connectionId: string, _database: string): void {
    console.warn('setActiveDatabase is deprecated, use setCurrentDatabase with alias instead');
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    console.log(`Deleted session: ${sessionId}`);
  }

  /**
   * Start periodic cleanup of stale sessions
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, this.CLEANUP_INTERVAL);

    // Don't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Clean up sessions that haven't been accessed recently
   */
  cleanupStaleSessions(): void {
    const now = Date.now();
    const cutoff = now - this.SESSION_TIMEOUT;
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastAccessed < cutoff) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} stale sessions`);
    }
  }

  /**
   * Stop cleanup timer (for shutdown)
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get session count (for monitoring)
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}

// Singleton instance
let sessionManagerInstance: SessionManager | null = null;

/**
 * Get or create the session manager singleton
 */
export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}
