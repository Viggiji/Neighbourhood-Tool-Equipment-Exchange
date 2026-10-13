const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'ntee.db');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  db.exec(`
    -- Residents / user accounts
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name     TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      block_code    TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'neighbor',
      is_verified   INTEGER NOT NULL DEFAULT 0,
      verify_token  TEXT,
      login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until  TEXT,
      remember_token TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Tools & Equipment
    CREATE TABLE IF NOT EXISTS tools (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      title         TEXT    NOT NULL,
      category      TEXT    NOT NULL,
      description   TEXT    NOT NULL,
      condition     TEXT    NOT NULL DEFAULT 'Good',
      deposit_amount REAL   NOT NULL DEFAULT 0,
      status        TEXT    NOT NULL DEFAULT 'Available',
      image_url     TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Index for quick email lookups
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    -- Index for tool feed queries
    CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);
    CREATE INDEX IF NOT EXISTS idx_tools_user ON tools(user_id);
  `);

  try {
    db.exec("ALTER TABLE tools ADD COLUMN image_url TEXT;");
  } catch (e) {
    // Column might already exist
  }
}

module.exports = { getDb };
