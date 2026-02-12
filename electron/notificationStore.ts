// electron/notificationStore.ts
// SQLite Store für Notification-History
// - Verhindert Duplikate
// - Speichert wann welche Episode benachrichtigt wurde

import path from "node:path";
import { app } from "electron";
import Database from "better-sqlite3";

export interface NotificationRecord {
  id?: number;
  mediaId: number;
  episode: number;
  airingAt: number;
  notifiedAt: number;
  userId: string;
  title?: string;
}

export class NotificationStore {
  private db: any;

  constructor(dbFile?: string) {
    const file =
      dbFile ||
      path.join(app.getPath("userData"), "shokaishelf_notifications.sqlite");
    this.db = new Database(file);
    this.init();
  }

  private init() {
    // Tabelle für bereits gesendete Notifications
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS notification_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          media_id INTEGER NOT NULL,
          episode INTEGER NOT NULL,
          airing_at INTEGER NOT NULL,
          notified_at INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          title TEXT,
          UNIQUE(media_id, episode, user_id)
        );`
      )
      .run();

    // Index für schnellere Queries
    this.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_user_media
         ON notification_history(user_id, media_id);`
      )
      .run();
  }

  /**
   * Prüft ob eine Notification bereits gesendet wurde
   */
  wasNotified(mediaId: number, episode: number, userId: string): boolean {
    const stmt = this.db.prepare(
      `SELECT COUNT(*) as count
       FROM notification_history
       WHERE media_id = ? AND episode = ? AND user_id = ?;`
    );
    const result = stmt.get(mediaId, episode, userId);
    return result.count > 0;
  }

  /**
   * Speichert eine gesendete Notification
   */
  markAsNotified(record: NotificationRecord): void {
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO notification_history
       (media_id, episode, airing_at, notified_at, user_id, title)
       VALUES (?, ?, ?, ?, ?, ?);`
    );
    stmt.run(
      record.mediaId,
      record.episode,
      record.airingAt,
      record.notifiedAt,
      record.userId,
      record.title || null
    );
  }

  /**
   * Lädt Notification-Historie für einen User
   */
  getHistory(userId: string, limit = 50): NotificationRecord[] {
    const stmt = this.db.prepare(
      `SELECT
        id,
        media_id as mediaId,
        episode,
        airing_at as airingAt,
        notified_at as notifiedAt,
        user_id as userId,
        title
       FROM notification_history
       WHERE user_id = ?
       ORDER BY notified_at DESC
       LIMIT ?;`
    );
    return stmt.all(userId, limit);
  }

  /**
   * Löscht alte Einträge (älter als X Tage)
   */
  cleanup(daysOld = 30): number {
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const stmt = this.db.prepare(
      `DELETE FROM notification_history WHERE notified_at < ?;`
    );
    const result = stmt.run(cutoff);
    return result.changes;
  }

  /**
   * Schließt die Datenbank
   */
  close(): void {
    this.db.close();
  }
}
