const { run, get, all } = require('./db');

/**
 * 建表 + 初始化管理员
 */
function initSchema() {
  // 1. 用户表
  run(`CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    role        TEXT DEFAULT 'user',
    active      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now'))
  )`);

  // 2. 游戏账号表
  run(`CREATE TABLE IF NOT EXISTS game_accounts (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    server_id       INTEGER,
    role_id         INTEGER,
    bin_data        BLOB,
    token           TEXT,
    import_method   TEXT,
    source_url      TEXT,
    status          TEXT DEFAULT 'idle',
    token_status    TEXT DEFAULT 'unknown',
    last_refresh_error TEXT,
    last_login      TEXT,
    last_active     TEXT,
    last_refresh_at TEXT,
    deleted_at      TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // 3. Worker 状态表
  run(`CREATE TABLE IF NOT EXISTS workers (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL,
    status          TEXT DEFAULT 'stopped',
    last_heartbeat  TEXT,
    current_task    TEXT,
    reconnect_count INTEGER DEFAULT 0,
    error_message   TEXT,
    started_at      TEXT,
    FOREIGN KEY (account_id) REFERENCES game_accounts(id)
  )`);

  // 4. 任务表
  run(`CREATE TABLE IF NOT EXISTS tasks (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL,
    name            TEXT NOT NULL,
    task_type       TEXT NOT NULL,
    schedule_type   TEXT DEFAULT 'daily',
    execute_time    TEXT,
    enabled         INTEGER DEFAULT 1,
    config          TEXT,
    last_execute    TEXT,
    next_execute    TEXT,
    last_result     TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES game_accounts(id)
  )`);

  // 5. 任务执行记录表
  run(`CREATE TABLE IF NOT EXISTS task_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         TEXT NOT NULL,
    account_id      TEXT NOT NULL,
    task_type       TEXT NOT NULL,
    status          TEXT NOT NULL,
    manual          INTEGER DEFAULT 0,
    result          TEXT,
    error           TEXT,
    duration_ms     INTEGER,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (account_id) REFERENCES game_accounts(id)
  )`);

  // 6. 游戏数据历史表
  run(`CREATE TABLE IF NOT EXISTS game_data_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      TEXT NOT NULL,
    data_type       TEXT NOT NULL,
    data_value      TEXT NOT NULL,
    record_time     TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES game_accounts(id)
  )`);

  // 7. 系统日志表
  run(`CREATE TABLE IF NOT EXISTS system_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    level           TEXT NOT NULL,
    category        TEXT NOT NULL,
    message         TEXT NOT NULL,
    detail          TEXT,
    account_id      TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  )`);

  // 8. 系统配置表
  run(`CREATE TABLE IF NOT EXISTS system_config (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    description     TEXT,
    updated_at      TEXT DEFAULT (datetime('now'))
  )`);

}

/**
 * 迁移：给已有表补缺失列（CREATE TABLE IF NOT EXISTS 不会加新列）
 */
function runMigrations() {
  const migrations = [
    { table: 'game_accounts', column: 'role_name', type: 'TEXT' },
    { table: 'game_accounts', column: 'level', type: 'INTEGER' },
    { table: 'game_accounts', column: 'vip_level', type: 'INTEGER' },
    { table: 'tasks', column: 'interval_minutes', type: 'INTEGER' },
    { table: 'tasks', column: 'account_ids', type: 'TEXT' }, // JSON array of account IDs
    { table: 'tasks', column: 'updated_at', type: 'TEXT' },
  ];

  for (const m of migrations) {
    const cols = all(`PRAGMA table_info(${m.table})`).map(c => c.name);
    if (!cols.includes(m.column)) {
      run(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type}`);
      console.log(`[db] 迁移: ${m.table}.${m.column} (${m.type})`);
    }
  }
}

module.exports = { initSchema, runMigrations };
