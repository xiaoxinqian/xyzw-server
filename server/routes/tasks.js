const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authRequired, adminRequired } = require('../middleware/auth');
const { get, all, run } = require('../database/db');
const { getShanghaiISO } = require('../utils/time');
const { availableTasks } = require('../game/tasks/constants');
const { getAvailableTaskTypes, hasTaskType } = require('../game/tasks');
const logger = require('../utils/logger');

const router = express.Router();

// 共享调度器实例（从 app.js 注入）
let scheduler = null;
let workerManager = null;

function setDependencies(schedulerInstance, workerManagerInstance) {
  scheduler = schedulerInstance;
  workerManager = workerManagerInstance;
}

router.use(authRequired);

// 获取可用任务类型列表
router.get('/types', (req, res) => {
  res.json({ success: true, data: availableTasks });
});

// 列出任务
router.get('/', (req, res) => {
  const tasks = all(`
    SELECT t.* FROM tasks t
    ORDER BY t.enabled DESC, t.created_at DESC
  `);

  // 多账号模式：通过 account_ids 判断权限和可见性
  const filtered = tasks.filter(t => {
    let ids = [];
    if (t.account_ids) { try { ids = JSON.parse(t.account_ids); } catch (e) {} }
    if (ids.length === 0 && t.account_id) ids = [t.account_id];
    if (ids.length === 0) return req.user.role === 'admin'; // 无账号绑定的任务只有管理员可见
    // 检查至少一个绑定账号属于该用户（或管理员）
    if (req.user.role === 'admin') return true;
    for (const accId of ids) {
      const acc = get('SELECT user_id FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accId]);
      if (acc && acc.user_id === req.user.userId) return true;
    }
    return false;
  });

  // 解析 account_ids，查所有账号名
  const result = filtered.map(t => {
    let accountIds = [];
    if (t.account_ids) {
      try { accountIds = JSON.parse(t.account_ids); } catch (e) {}
    }
    if (accountIds.length === 0 && t.account_id) {
      accountIds = [t.account_id];
    }
    // 查所有绑定账号名
    const accountNames = accountIds.map(id => {
      const acc = get('SELECT name FROM game_accounts WHERE id = ?', [id]);
      return acc?.name || id;
    });
    return {
      ...t,
      account_ids: accountIds,
      account_names: accountNames,
      config: t.config ? JSON.parse(t.config) : null,
    };
  });

  res.json({ success: true, data: result });
});

// 获取单个任务
router.get('/:id', (req, res) => {
  const task = get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) {
    return res.status(404).json({ success: false, message: '任务不存在' });
  }
  // 权限检查：通过 account_ids 检查
  let ids = [];
  if (task.account_ids) { try { ids = JSON.parse(task.account_ids); } catch (e) {} }
  if (ids.length === 0 && task.account_id) ids = [task.account_id];
  if (req.user.role !== 'admin') {
    let hasAccess = false;
    for (const accId of ids) {
      const acc = get('SELECT user_id FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accId]);
      if (acc && acc.user_id === req.user.userId) { hasAccess = true; break; }
    }
    if (!hasAccess) return res.status(403).json({ success: false, message: '无权限' });
  }

  let accountIds = [];
  if (task.account_ids) {
    try { accountIds = JSON.parse(task.account_ids); } catch (e) {}
  }
  if (accountIds.length === 0 && task.account_id) {
    accountIds = [task.account_id];
  }
  task.account_ids = accountIds;
  task.config = task.config ? JSON.parse(task.config) : null;
  res.json({ success: true, data: task });
});

// 创建任务（支持多账号）
router.post('/', (req, res) => {
  const { accountId, accountIds, name, taskType, scheduleType = 'daily', executeTime = '04:00', intervalMinutes = null, config = {}, enabled = true } = req.body;

  // 兼容：accountIds 优先，否则用单个 accountId
  const ids = Array.isArray(accountIds) && accountIds.length > 0 ? accountIds : (accountId ? [accountId] : []);
  if (ids.length === 0 || !name || !taskType) {
    return res.status(400).json({ success: false, message: 'accountIds(或accountId), name, taskType 必填' });
  }

  // 权限检查所有账号
  for (const accId of ids) {
    const account = get('SELECT * FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accId]);
    if (!account) {
      return res.status(404).json({ success: false, message: `账号不存在: ${accId}` });
    }
    if (req.user.role !== 'admin' && account.user_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: '无权限' });
    }
  }

  const id = uuidv4();
  // account_id 存第一个（兼容旧逻辑），account_ids 存全部
  const firstAccId = ids[0];
  run(
    `INSERT INTO tasks (id, account_id, account_ids, name, task_type, schedule_type, execute_time, interval_minutes, enabled, config, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, firstAccId, JSON.stringify(ids), name, taskType, scheduleType, executeTime, intervalMinutes, enabled ? 1 : 0, JSON.stringify(config), getShanghaiISO()]
  );

  // 添加到调度器
  const task = get('SELECT * FROM tasks WHERE id = ?', [id]);
  if (scheduler && task.enabled) {
    scheduler.addTask(task);
  }

  res.json({ success: true, data: { id, ...task } });
});

// 更新任务
router.put('/:id', (req, res) => {
  const task = get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) {
    return res.status(404).json({ success: false, message: '任务不存在' });
  }
  // 权限检查
  let ids = [];
  if (task.account_ids) { try { ids = JSON.parse(task.account_ids); } catch (e) {} }
  if (ids.length === 0 && task.account_id) ids = [task.account_id];
  if (req.user.role !== 'admin') {
    let hasAccess = false;
    for (const accId of ids) {
      const acc = get('SELECT user_id FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accId]);
      if (acc && acc.user_id === req.user.userId) { hasAccess = true; break; }
    }
    if (!hasAccess) return res.status(403).json({ success: false, message: '无权限' });
  }

  const { name, taskType, scheduleType, executeTime, intervalMinutes, enabled, config, accountIds } = req.body;
  const updates = [];
  const params = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (taskType !== undefined) { updates.push('task_type = ?'); params.push(taskType); }
  if (scheduleType !== undefined) { updates.push('schedule_type = ?'); params.push(scheduleType); }
  if (executeTime !== undefined) { updates.push('execute_time = ?'); params.push(executeTime); }
  if (intervalMinutes !== undefined) { updates.push('interval_minutes = ?'); params.push(intervalMinutes); }
  if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
  if (config !== undefined) { updates.push('config = ?'); params.push(JSON.stringify(config)); }
  if (Array.isArray(accountIds) && accountIds.length > 0) {
    updates.push('account_ids = ?'); params.push(JSON.stringify(accountIds));
    updates.push('account_id = ?'); params.push(accountIds[0]); // 兼容字段
  }
  updates.push('updated_at = ?'); params.push(getShanghaiISO());
  params.push(req.params.id);

  run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params);

  // 更新调度器
  const updatedTask = get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (scheduler) {
    scheduler.updateTask(updatedTask);
  }

  res.json({ success: true, data: updatedTask });
});

// 启用/禁用任务
router.post('/:id/toggle', (req, res) => {
  const task = get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) {
    return res.status(404).json({ success: false, message: '任务不存在' });
  }
  // 权限检查
  let ids = [];
  if (task.account_ids) { try { ids = JSON.parse(task.account_ids); } catch (e) {} }
  if (ids.length === 0 && task.account_id) ids = [task.account_id];
  if (req.user.role !== 'admin') {
    let hasAccess = false;
    for (const accId of ids) {
      const acc = get('SELECT user_id FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accId]);
      if (acc && acc.user_id === req.user.userId) { hasAccess = true; break; }
    }
    if (!hasAccess) return res.status(403).json({ success: false, message: '无权限' });
  }

  const newEnabled = task.enabled ? 0 : 1;
  run('UPDATE tasks SET enabled = ?, updated_at = ? WHERE id = ?', [newEnabled, getShanghaiISO(), req.params.id]);

  const updatedTask = get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (scheduler) {
    scheduler.updateTask(updatedTask);
  }

  res.json({ success: true, data: { enabled: newEnabled === 1 } });
});

// 删除任务
router.delete('/:id', (req, res) => {
  const task = get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) {
    return res.status(404).json({ success: false, message: '任务不存在' });
  }
  // 权限检查
  let ids = [];
  if (task.account_ids) { try { ids = JSON.parse(task.account_ids); } catch (e) {} }
  if (ids.length === 0 && task.account_id) ids = [task.account_id];
  if (req.user.role !== 'admin') {
    let hasAccess = false;
    for (const accId of ids) {
      const acc = get('SELECT user_id FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accId]);
      if (acc && acc.user_id === req.user.userId) { hasAccess = true; break; }
    }
    if (!hasAccess) return res.status(403).json({ success: false, message: '无权限' });
  }

  run('DELETE FROM tasks WHERE id = ?', [req.params.id]);
  if (scheduler) {
    scheduler.removeTask(req.params.id);
  }

  res.json({ success: true });
});

// 手动执行任务（支持多账号顺序执行）
router.post('/:id/run', async (req, res) => {
  const task = get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) {
    return res.status(404).json({ success: false, message: '任务不存在' });
  }
  // 权限检查
  let ids = [];
  if (task.account_ids) { try { ids = JSON.parse(task.account_ids); } catch (e) {} }
  if (ids.length === 0 && task.account_id) ids = [task.account_id];
  if (req.user.role !== 'admin') {
    let hasAccess = false;
    for (const accId of ids) {
      const acc = get('SELECT user_id FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accId]);
      if (acc && acc.user_id === req.user.userId) { hasAccess = true; break; }
    }
    if (!hasAccess) return res.status(403).json({ success: false, message: '无权限' });
  }

  if (!scheduler) {
    return res.status(500).json({ success: false, message: '调度器未初始化' });
  }

  // 解析多账号
  let accountIds = [];
  if (task.account_ids) {
    try { accountIds = JSON.parse(task.account_ids); } catch (e) {}
  }
  if (accountIds.length === 0 && task.account_id) {
    accountIds = [task.account_id];
  }

  if (accountIds.length === 0) {
    return res.status(400).json({ success: false, message: '该任务没有绑定账号' });
  }

  // 单账号直接同步返回
  if (accountIds.length === 1) {
    try {
      const result = await scheduler.runManual(accountIds[0], task.task_type);
      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('task', `手动执行失败: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    }
    return;
  }

  // 多账号：用异步批次模式
  const batchId = uuidv4();
  const job = { status: 'running', total: accountIds.length, done: 0, results: [], accountIds: [...accountIds], taskType: task.task_type, createdAt: Date.now() };
  batchJobs.set(batchId, job);

  res.json({ success: true, batchId, total: accountIds.length });

  (async () => {
    for (const accountId of accountIds) {
      try {
        const result = await scheduler.runManual(accountId, task.task_type);
        job.results.push({ accountId, success: true, result });
      } catch (err) {
        logger.error('task', `手动批量执行失败 [${accountId}]: ${err.message}`);
        job.results.push({ accountId, success: false, message: err.message });
      }
      job.done++;
    }
    job.status = 'done';
    setTimeout(() => batchJobs.delete(batchId), 600000);
  })().catch(err => {
    job.status = 'error';
    job.error = err.message;
  });
});

// 快速执行（不需要预先创建任务）
router.post('/run-quick', (req, res) => {
  const { accountId, taskType = 'daily' } = req.body;
  if (!accountId) {
    return res.status(400).json({ success: false, message: 'accountId 必填' });
  }

  const account = get('SELECT * FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
  if (!account) {
    return res.status(404).json({ success: false, message: '账号不存在' });
  }
  if (req.user.role !== 'admin' && account.user_id !== req.user.userId) {
    return res.status(403).json({ success: false, message: '无权限' });
  }

  if (!scheduler) {
    return res.status(500).json({ success: false, message: '调度器未初始化' });
  }

  scheduler.runManual(accountId, taskType)
    .then(result => res.json({ success: true, data: result }))
    .catch(err => {
      res.status(500).json({ success: false, message: err.message });
    });
});

// 获取任务执行日志
router.get('/:id/logs', (req, res) => {
  const task = get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) {
    return res.status(404).json({ success: false, message: '任务不存在' });
  }
  // 权限检查
  let ids = [];
  if (task.account_ids) { try { ids = JSON.parse(task.account_ids); } catch (e) {} }
  if (ids.length === 0 && task.account_id) ids = [task.account_id];
  if (req.user.role !== 'admin') {
    let hasAccess = false;
    for (const accId of ids) {
      const acc = get('SELECT user_id FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accId]);
      if (acc && acc.user_id === req.user.userId) { hasAccess = true; break; }
    }
    if (!hasAccess) return res.status(403).json({ success: false, message: '无权限' });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const logs = all(
    'SELECT * FROM task_logs WHERE task_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [req.params.id, limit, offset]
  );

  const total = get('SELECT COUNT(*) as count FROM task_logs WHERE task_id = ?', [req.params.id]);

  res.json({ success: true, data: logs, total: total.count, page, limit });
});

// 调度器状态
router.get('/scheduler/status', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '无权限' });
  }
  if (!scheduler) {
    return res.status(500).json({ success: false, message: '调度器未初始化' });
  }
  res.json({ success: true, data: scheduler.getStatus() });
});

// 批量执行任务（异步排队执行）
const batchJobs = new Map(); // batchId -> { status, total, done, results, accountIds, taskType, createdAt }

router.post('/batch-run', (req, res) => {
  const { accountIds, taskType = 'daily' } = req.body;
  if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
    return res.status(400).json({ success: false, message: 'accountIds 必填且为数组' });
  }
  if (!scheduler) {
    return res.status(500).json({ success: false, message: '调度器未初始化' });
  }

  // 权限检查
  for (const accountId of accountIds) {
    const account = get('SELECT * FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
    if (!account) {
      return res.status(404).json({ success: false, message: `账号不存在: ${accountId}` });
    }
    if (req.user.role !== 'admin' && account.user_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: '无权限' });
    }
  }

  const batchId = uuidv4();
  const job = { status: 'running', total: accountIds.length, done: 0, results: [], accountIds: [...accountIds], taskType, createdAt: Date.now() };
  batchJobs.set(batchId, job);

  // 立即返回 batchId
  res.json({ success: true, batchId, total: accountIds.length });

  // 后台排队执行
  (async () => {
    for (const accountId of accountIds) {
      try {
        const result = await scheduler.runManual(accountId, taskType);
        job.results.push({ accountId, success: true, result });
      } catch (err) {
        logger.error('task', `批量执行失败 [${accountId}]: ${err.message}`);
        job.results.push({ accountId, success: false, message: err.message });
      }
      job.done++;
    }
    job.status = 'done';
    // 10分钟后清理
    setTimeout(() => batchJobs.delete(batchId), 600000);
  })().catch(err => {
    logger.error('task', `批次 ${batchId} 异常: ${err.message}`);
    job.status = 'error';
    job.error = err.message;
  });
});

// 查询批量执行进度
router.get('/batch-status/:batchId', (req, res) => {
  const job = batchJobs.get(req.params.batchId);
  if (!job) return res.status(404).json({ success: false, message: '批次不存在或已过期' });
  res.json({
    success: true,
    status: job.status,
    total: job.total,
    done: job.done,
    results: job.results,
  });
});

module.exports = { router, setDependencies };
