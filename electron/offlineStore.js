// electron/offlineStore.js
// SQLite-based offline cache for library data

import Database from 'better-sqlite3';
import path from 'node:path';
import { app } from 'electron';
import { devLog, devWarn, logError } from './utils/logger.js';

// ============================================================================
// OFFLINE STORE
// ============================================================================

export class OfflineStore {
  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'offline-cache.db');
    this.db = new Database(dbPath);
    this.cacheDuration = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.initialize();
  }

  initialize() {
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

    devLog('[OfflineStore] Initialized');
  }

  // ============================================================================
  // LIBRARY CACHE
  // ============================================================================

  cacheLibrary(userId, entries) {
    const now = Date.now();

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO library_cache
      (media_id, user_id, status, progress, score, started_at, completed_at, updated_at, media, cached_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((entries) => {
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
    devLog(`[OfflineStore] Cached ${entries.length} entries for user ${userId}`);
  }

  getCachedLibrary(userId) {
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

    return stmt.all(userId);
  }

  getCachedEntryByMediaId(userId, mediaId) {
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

    return stmt.get(userId, mediaId);
  }

  updateCachedEntry(userId, mediaId, updates) {
    const fields = [];
    const values = [];

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

  getLastCacheTime(userId) {
    const stmt = this.db.prepare(`
      SELECT MAX(cached_at) as lastCached FROM library_cache WHERE user_id = ?
    `);
    const result = stmt.get(userId);
    return result?.lastCached || 0;
  }

  isCacheValid(userId) {
    const lastCached = this.getLastCacheTime(userId);
    return Date.now() - lastCached < this.cacheDuration;
  }

  clearCache(userId) {
    const stmt = this.db.prepare('DELETE FROM library_cache WHERE user_id = ?');
    stmt.run(userId);
    devLog(`[OfflineStore] Cleared cache for user ${userId}`);
  }

  // ============================================================================
  // SYNC QUEUE
  // ============================================================================

  enqueue(userId, action, payload) {
    const stmt = this.db.prepare(`
      INSERT INTO sync_queue (user_id, action, payload, created_at)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(userId, action, JSON.stringify(payload), Date.now());
    devLog(`[OfflineStore] Queued action: ${action} for user ${userId}`);
    return result.lastInsertRowid;
  }

  getPendingQueue(userId) {
    const stmt = this.db.prepare(`
      SELECT id, action, payload, attempts
      FROM sync_queue
      WHERE user_id = ? AND synced_at IS NULL
      ORDER BY created_at ASC
    `);

    return stmt.all(userId).map(row => ({
      id: row.id,
      action: row.action,
      payload: JSON.parse(row.payload),
      attempts: row.attempts,
    }));
  }

  getQueueCount(userId) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM sync_queue
      WHERE user_id = ? AND synced_at IS NULL
    `);
    const result = stmt.get(userId);
    return result.count;
  }

  markSynced(id) {
    const stmt = this.db.prepare(`
      UPDATE sync_queue SET synced_at = ? WHERE id = ?
    `);
    stmt.run(Date.now(), id);
  }

  markFailed(id, error) {
    const stmt = this.db.prepare(`
      UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?
    `);
    stmt.run(error, id);
  }

  removeFromQueue(id) {
    const stmt = this.db.prepare('DELETE FROM sync_queue WHERE id = ?');
    stmt.run(id);
  }

  clearSyncedQueue() {
    const stmt = this.db.prepare('DELETE FROM sync_queue WHERE synced_at IS NOT NULL');
    stmt.run();
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  cleanup() {
    // Remove old cached entries
    const oldestAllowed = Date.now() - this.cacheDuration;
    const stmt = this.db.prepare('DELETE FROM library_cache WHERE cached_at < ?');
    const result = stmt.run(oldestAllowed);
    if (result.changes > 0) {
      devLog(`[OfflineStore] Cleaned up ${result.changes} old cache entries`);
    }

    // Remove old synced queue items (older than 7 days)
    const queueStmt = this.db.prepare('DELETE FROM sync_queue WHERE synced_at IS NOT NULL AND synced_at < ?');
    queueStmt.run(oldestAllowed);
  }

  close() {
    this.db.close();
    devLog('[OfflineStore] Closed');
  }
}

export default OfflineStore;
