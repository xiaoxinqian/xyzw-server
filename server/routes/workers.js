const express = require('express');
const { authRequired, adminRequired } = require('../middleware/auth');
const { get, all } = require('../database/db');
const workerManager = require('../services/workerManager');
const logger = require('../utils/logger');

const router = express.Router();

router.use(authRequired);

// 列出所有 Worker 状态
router.get('/', (req, res) => {
  const runningWorkers = workerManager.listAll();

  // 合并 DB 记录和运行时状态
  const dbWorkers = all(`
    SELECT w.*, ga.name as account_name, ga.user_id
    FROM workers w
    JOIN game_accounts ga ON w.account_id = ga.id
    WHERE ga.deleted_at IS NULL
  `);

  const result = dbWorkers.map(dbRow => {
    const runtime = runningWorkers.find(w => w.accountId === dbRow.account_id);
    return {
      ...dbRow,
      runtime: runtime || null,
    };
  });

  // 普通用户只看自己的
  const filtered = req.user.role === 'admin'
    ? result
    : result.filter(r => r.user_id === req.user.userId);

  res.json({ success: true, data: filtered });
});

// 获取单个 Worker 状态
router.get('/:accountId', (req, res) => {
  const accountId = req.params.accountId;

  // 权限检查
  const account = get('SELECT * FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
  if (!account) {
    return res.status(404).json({ success: false, message: '账号不存在' });
  }
  if (req.user.role !== 'admin' && account.user_id !== req.user.userId) {
    return res.status(403).json({ success: false, message: '无权限' });
  }

  const status = workerManager.getStatus(accountId);
  res.json({ success: true, data: status });
});

// 启动 Worker
router.post('/:accountId/start', (req, res) => {
  const accountId = req.params.accountId;

  const account = get('SELECT * FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
  if (!account) {
    return res.status(404).json({ success: false, message: '账号不存在' });
  }
  if (req.user.role !== 'admin' && account.user_id !== req.user.userId) {
    return res.status(403).json({ success: false, message: '无权限' });
  }

  workerManager.start(accountId)
    .then(result => res.json(result))
    .catch(err => {
      logger.error('worker', `启动失败: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    });
});

// 停止 Worker
router.post('/:accountId/stop', (req, res) => {
  const accountId = req.params.accountId;

  const account = get('SELECT * FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
  if (!account) {
    return res.status(404).json({ success: false, message: '账号不存在' });
  }
  if (req.user.role !== 'admin' && account.user_id !== req.user.userId) {
    return res.status(403).json({ success: false, message: '无权限' });
  }

  workerManager.stop(accountId)
    .then(result => res.json(result))
    .catch(err => {
      res.status(500).json({ success: false, message: err.message });
    });
});

// 重启 Worker
router.post('/:accountId/restart', (req, res) => {
  const accountId = req.params.accountId;

  const account = get('SELECT * FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
  if (!account) {
    return res.status(404).json({ success: false, message: '账号不存在' });
  }
  if (req.user.role !== 'admin' && account.user_id !== req.user.userId) {
    return res.status(403).json({ success: false, message: '无权限' });
  }

  workerManager.restart(accountId)
    .then(result => res.json(result))
    .catch(err => {
      res.status(500).json({ success: false, message: err.message });
    });
});

// 管理员：批量启动
router.post('/batch/start-all', adminRequired, (req, res) => {
  workerManager.startAll()
    .then(results => res.json({ success: true, data: results }))
    .catch(err => {
      res.status(500).json({ success: false, message: err.message });
    });
});

// 管理员：批量停止
router.post('/batch/stop-all', adminRequired, (req, res) => {
  workerManager.stopAll()
    .then(results => res.json({ success: true, data: results }))
    .catch(err => {
      res.status(500).json({ success: false, message: err.message });
    });
});

module.exports = router;
