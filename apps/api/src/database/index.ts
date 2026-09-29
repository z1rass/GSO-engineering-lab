import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Database = DatabaseSync;

export function openDatabase(path: string): Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      cover_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      hidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS idea_votes (
      idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      PRIMARY KEY (idea_id, visitor_id)
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PLANNING',
      category TEXT NOT NULL,
      planned_date TEXT,
      end_date TEXT,
      start_time TEXT,
      end_time TEXT,
      general_location TEXT NOT NULL,
      place_type TEXT NOT NULL DEFAULT 'SCHOOL',
      cover_url TEXT,
      materials TEXT NOT NULL DEFAULT '',
      idea_id INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
      hidden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS event_going (
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      PRIMARY KEY (event_id, visitor_id)
    );
    CREATE TABLE IF NOT EXISTS cover_uploads (
      id TEXT PRIMARY KEY,
      mime_type TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);
  const ideaColumns = db.prepare('PRAGMA table_info(ideas)').all() as { name: string }[];
  if (!ideaColumns.some(column => column.name === 'cover_url')) db.exec('ALTER TABLE ideas ADD COLUMN cover_url TEXT');
  return db;
}
