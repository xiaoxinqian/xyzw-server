const express = require('express');
const { authRequired, adminRequired } = require('../middleware/auth');
const { get, all, run } = require('../database/db');
const router = express.Router();

router.use(authRequired);

// 任务执行日志（带分页和过滤）
router.get('/task-logs', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const status = req.query.status;

  let where = '1=1';
  let params = [];

  // 非管理员只能看自己的账号日志
  if (req.user.role !== 'admin') {
    const accountIds = all('SELECT id FROM game_accounts WHERE user_id = ?', [req.user.userId]).map(a => `'${a.id}'`).join(',');
    if (!accountIds) return res.json({ success: true, data: [], total: 0 });
    where += ` AND tl.account_id IN (${accountIds})`;
  }

  if (status) {
    where += ' AND tl.status = ?';
    params.push(status);
  }

  const countSql = `SELECT COUNT(*) as count FROM task_logs tl WHERE ${where}`;
  const total = get(countSql, params);

  const dataSql = `
    SELECT tl.*, ga.name as account_name
    FROM task_logs tl
    LEFT JOIN game_accounts ga ON tl.account_id = ga.id
    WHERE ${where}
    ORDER BY tl.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const logs = all(dataSql, [...params, limit, offset]);

  res.json({ success: true, data: logs, total: total?.count || 0, page, limit });
});

// 系统日志（仅管理员）
router.get('/system-logs', adminRequired, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const level = req.query.level;

  let where = '1=1';
  let params = [];
  if (level) {
    where = 'level = ?';
    params.push(level);
  }

  const total = get(`SELECT COUNT(*) as count FROM system_logs WHERE ${where}`, params);
  const logs = all(
    `SELECT * FROM system_logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({ success: true, data: logs, total: total?.count || 0, page, limit });
});

module.exports = router;
