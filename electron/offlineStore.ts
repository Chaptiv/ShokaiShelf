// electron/offlineStore.ts
// SQLite-based offline cache for library data

import Database from 'better-sqlite3';
import path from 'node:path';
import { app } from 'electron';
import { ShokaiErrorFactory } from './ShokaiErrors.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CachedEntry {
  id: number;
  mediaId: number;
  userId: string;
  status: string;
  progress: number;
  score: number;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: number;
  media: string; // JSON stringified media object
  cachedAt: number;
}

export interface CachedLibrary {
  userId: string;
  entries: CachedEntry[];
  cachedAt: number;
}

// ============================================================================
// OFFLINE STORE
// ============================================================================

export class OfflineStore {
  private db: Database.Database;
  private cacheDuration: number = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'offline-cache.db');
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS library_cache (
        id INTEGER PRIMARY KEY,
        media_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        score INTEGER DEFAULT 0,
        started_at TEXT,
        completed_at TEXT,
        updated_at INTEGER,
        media TEXT NOT NULL,
        cached_at INTEGER NOT NULL,
        UNIQUE(media_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_library_cache_user ON library_cache(user_id);
      CREATE INDEX IF NOT EXISTS idx_library_cache_status ON library_cache(user_id, status);

      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_error TEXT,
        synced_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON sync_queue(user_id);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(synced_at) WHERE synced_at IS NULL;
    `);

    console.log('[OfflineStore] Initialized');
  }

  // ============================================================================
  // LIBRARY CACHE
  // ============================================================================

  cacheLibrary(userId: string, entries: any[]): void {
    const now = Date.now();

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO library_cache
      (media_id, user_id, status, progress, score, started_at, completed_at, updated_at, media, cached_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((entries: any[]) => {
      for (const entry of entries) {
        insert.run(
          entry.media?.id || entry.mediaId,
          userId,
          entry.status,
          entry.progress || 0,
          entry.score || 0,
          entry.startedAt ? JSON.stringify(entry.startedAt) : null,
          entry.completedAt ? JSON.stringify(entry.completedAt) : null,
          entry.updatedAt || now,
          JSON.stringify(entry.media),
          now
        );
      }
    });

    insertMany(entries);
    console.log(`[OfflineStore] Cached ${entries.length} entries for user ${userId}`);
  }

  getCachedLibrary(userId: string): CachedEntry[] {
    const stmt = this.db.prepare(`
      SELECT
        id,
        media_id as mediaId,
        user_id as userId,
        status,
        progress,
        score,
        started_at as startedAt,
        completed_at as completedAt,
        updated_at as updatedAt,
        media,
        cached_at as cachedAt
      FROM library_cache
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `);

    return stmt.all(userId) as CachedEntry[];
  }

  getCachedEntryByMediaId(userId: string, mediaId: number): CachedEntry | null {
    const stmt = this.db.prepare(`
      SELECT
        id,
        media_id as mediaId,
        user_id as userId,
        status,
        progress,
        score,
        started_at as startedAt,
        completed_at as completedAt,
        updated_at as updatedAt,
        media,
        cached_at as cachedAt
      FROM library_cache
      WHERE user_id = ? AND media_id = ?
    `);

    return stmt.get(userId, mediaId) as CachedEntry | null;
  }

  updateCachedEntry(userId: string, mediaId: number, updates: Partial<CachedEntry>): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.progress !== undefined) {
      fields.push('progress = ?');
      values.push(updates.progress);
    }
    if (updates.score !== undefined) {
      fields.push('score = ?');
      values.push(updates.score);
    }

    if (fields.length === 0) return;

    fields.push('cached_at = ?');
    values.push(Date.now());

    values.push(userId, mediaId);

    const stmt = this.db.prepare(`
      UPDATE library_cache
      SET ${fields.join(', ')}
      WHERE user_id = ? AND media_id = ?
    `);

    stmt.run(...values);
  }

  getLastCacheTime(userId: string): number {
    const stmt = this.db.prepare(`
      SELECT MAX(cached_at) as lastCached FROM library_cache WHERE user_id = ?
    `);
    const result = stmt.get(userId) as { lastCached: number | null };
    return result?.lastCached || 0;
  }

  isCacheValid(userId: string): boolean {
    const lastCached = this.getLastCacheTime(userId);
    return Date.now() - lastCached < this.cacheDuration;
  }

  clearCache(userId: string): void {
    const stmt = this.db.prepare('DELETE FROM library_cache WHERE user_id = ?');
    stmt.run(userId);
    console.log(`[OfflineStore] Cleared cache for user ${userId}`);
  }

  // ============================================================================
  // SYNC QUEUE
  // ============================================================================

  enqueue(userId: string, action: string, payload: any): number {
    const stmt = this.db.prepare(`
      INSERT INTO sync_queue (user_id, action, payload, created_at)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(userId, action, JSON.stringify(payload), Date.now());
    console.log(`[OfflineStore] Queued action: ${action} for user ${userId}`);
    return result.lastInsertRowid as number;
  }

  getPendingQueue(userId: string): { id: number; action: string; payload: any; attempts: number }[] {
    const stmt = this.db.prepare(`
      SELECT id, action, payload, attempts
      FROM sync_queue
      WHERE user_id = ? AND synced_at IS NULL
      ORDER BY created_at ASC
    `);

    return (stmt.all(userId) as any[])
      .map(row => {
        try {
          return {
            id: row.id,
            action: row.action,
            payload: JSON.parse(row.payload),
            attempts: row.attempts,
          };
        } catch (error) {
          const shokaiError = ShokaiErrorFactory.jsonParseError(
            `sync_queue item ${row.id}`,
            error
          );
          console.error(`[OfflineStore] ${shokaiError.getDisplayMessage()}`);
          console.error('[OfflineStore] Error details:', JSON.stringify(shokaiError.toJSON(), null, 2));
          // Skip corrupted entries
          return null;
        }
      })
      .filter(item => item !== null) as any[];
  }

  getQueueCount(userId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM sync_queue
      WHERE user_id = ? AND synced_at IS NULL
    `);
    const result = stmt.get(userId) as { count: number };
    return result.count;
  }

  markSynced(id: number): void {
    const stmt = this.db.prepare(`
      UPDATE sync_queue SET synced_at = ? WHERE id = ?
    `);
    stmt.run(Date.now(), id);
  }

  markFailed(id: number, error: string): void {
    const stmt = this.db.prepare(`
      UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?
    `);
    stmt.run(error, id);
  }

  removeFromQueue(id: number): void {
    const stmt = this.db.prepare('DELETE FROM sync_queue WHERE id = ?');
    stmt.run(id);
  }

  clearSyncedQueue(): void {
    const stmt = this.db.prepare('DELETE FROM sync_queue WHERE synced_at IS NOT NULL');
    stmt.run();
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  cleanup(): void {
    // Remove old cached entries
    const oldestAllowed = Date.now() - this.cacheDuration;
    const stmt = this.db.prepare('DELETE FROM library_cache WHERE cached_at < ?');
    const result = stmt.run(oldestAllowed);
    if (result.changes > 0) {
      console.log(`[OfflineStore] Cleaned up ${result.changes} old cache entries`);
    }

    // Remove old synced queue items (older than 7 days)
    const queueStmt = this.db.prepare('DELETE FROM sync_queue WHERE synced_at IS NOT NULL AND synced_at < ?');
    queueStmt.run(oldestAllowed);
  }

  close(): void {
    this.db.close();
    console.log('[OfflineStore] Closed');
  }
}

export default OfflineStore;
