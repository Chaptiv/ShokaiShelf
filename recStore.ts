// electron/recStore.ts
import path from "node:path";
import { app } from "electron";
import Database from "better-sqlite3";

export type RecEventType =
  | "impression"
  | "click"
  | "add_to_ptw"
  | "hide"
  | "play_start";

export interface RecEvent {
  ts: number;
  userId: string;
  itemId: number;
  type: RecEventType;
  context?: string | null;
}

export class RecStore {
  private db: any;

  constructor(dbFile?: string) {
    const file =
      dbFile ||
      path.join(app.getPath("userData"), "shokaishelf_rec.sqlite");
    this.db = new Database(file);
    this.init();
  }

  private init() {
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS rec_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          item_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          context TEXT
        );`
      )
      .run();

    // optional wie in Swift: Modelle
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS rec_models (
          user_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          PRIMARY KEY (user_id, key)
        );`
      )
      .run();
  }

  insertEvent(ev: RecEvent) {
    const stmt = this.db.prepare(
      `INSERT INTO rec_events (ts, user_id, item_id, type, context)
       VALUES (@ts, @userId, @itemId, @type, @context);`
    );
    stmt.run({
      ts: ev.ts,
      userId: ev.userId,
      itemId: ev.itemId,
      type: ev.type,
      context: ev.context ?? null,
    });
  }

  loadEvents(userId: string, limit = 200): RecEvent[] {
    const stmt = this.db.prepare(
      `SELECT ts, user_id as userId, item_id as itemId, type, context
       FROM rec_events
       WHERE user_id = ?
       ORDER BY ts DESC
       LIMIT ?;`
    );
    return stmt.all(userId, limit);
  }

  setModel(userId: string, key: string, value: unknown) {
    const stmt = this.db.prepare(
      `INSERT INTO rec_models (user_id, key, value)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value;`
    );
    stmt.run(userId, key, JSON.stringify(value));
  }

  getModel(userId: string, key: string): unknown | null {
    const stmt = this.db.prepare(
      `SELECT value FROM rec_models
       WHERE user_id = ? AND key = ?;`
    );
    const row = stmt.get(userId, key);
    if (!row) return null;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }
}
