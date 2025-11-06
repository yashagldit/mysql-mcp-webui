import { getDatabaseManager } from '../db/database-manager.js';

interface Session {
  id: string;
  activeConnectionId: string | null;
  activeDatabases: Map<string, string>; // connectionId -> databaseName
  lastAccessed: number;
}

/**
 * Session manager for HTTP mode
 * Tracks active connection and database per session
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

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
      // Initialize session with default connection
      const dbManager = getDatabaseManager();
      const defaultConnId = dbManager.getDefaultConnectionId();

      session = {
        id: sessionId,
        activeConnectionId: defaultConnId,
        activeDatabases: new Map(),
        lastAccessed: Date.now(),
      };

      // Try to load active database for default connection
      if (defaultConnId) {
        const activeDb = dbManager.getActiveDatabase(defaultConnId);
        if (activeDb) {
          session.activeDatabases.set(defaultConnId, activeDb);
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
   * Get active connection ID for a session
   */
  getActiveConnection(sessionId: string): string | null {
    const session = this.getOrCreateSession(sessionId);
    return session.activeConnectionId;
  }

  /**
   * Set active connection ID for a session
   */
  setActiveConnection(sessionId: string, connectionId: string): void {
    const session = this.getOrCreateSession(sessionId);
    session.activeConnectionId = connectionId;

    // If there's no active database for this connection, try to set one
    if (!session.activeDatabases.has(connectionId)) {
      const dbManager = getDatabaseManager();
      const activeDb = dbManager.getActiveDatabase(connectionId);
      if (activeDb) {
        session.activeDatabases.set(connectionId, activeDb);
      }
    }
  }

  /**
   * Get active database for a connection in a session
   */
  getActiveDatabase(sessionId: string, connectionId?: string): string | null {
    const session = this.getOrCreateSession(sessionId);
    const connId = connectionId || session.activeConnectionId;

    if (!connId) return null;

    return session.activeDatabases.get(connId) || null;
  }

  /**
   * Set active database for a connection in a session
   */
  setActiveDatabase(sessionId: string, connectionId: string, database: string): void {
    const session = this.getOrCreateSession(sessionId);
    session.activeDatabases.set(connectionId, database);
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

  /**
   * Update active connection for all existing sessions
   * Used when connection is switched globally via WebUI
   */
  setActiveConnectionForAllSessions(connectionId: string): void {
    for (const session of this.sessions.values()) {
      session.activeConnectionId = connectionId;

      // Try to load active database for the new connection
      if (!session.activeDatabases.has(connectionId)) {
        const dbManager = getDatabaseManager();
        const activeDb = dbManager.getActiveDatabase(connectionId);
        if (activeDb) {
          session.activeDatabases.set(connectionId, activeDb);
        }
      }
    }

    console.log(`Updated ${this.sessions.size} sessions to use connection: ${connectionId}`);
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
