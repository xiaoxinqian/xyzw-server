const { getShanghaiISO } = require('./time');
const { run } = require('../database/db');

/**
 * 写入系统日志
 */
function log(level, category, message, detail = null, accountId = null) {
  try {
    run(
      `INSERT INTO system_logs (level, category, message, detail, account_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [level, category, message, detail ? JSON.stringify(detail) : null, accountId, getShanghaiISO()]
    );
  } catch (e) {
    console.error(`[日志写入失败] ${e.message}`);
  }

  const prefix = level === 'ERROR' ? '❌' : level === 'WARNING' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} [${getShanghaiISO()}] [${category}] ${message}`);
}

function info(category, message, detail, accountId) {
  log('INFO', category, message, detail, accountId);
}

function warn(category, message, detail, accountId) {
  log('WARNING', category, message, detail, accountId);
}

function error(category, message, detail, accountId) {
  log('ERROR', category, message, detail, accountId);
}

module.exports = { log, info, warn, error };
