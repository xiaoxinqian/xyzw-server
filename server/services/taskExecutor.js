/**
 * 任务执行器 - 桥接 Worker 和 DailyTaskRunner
 * 负责执行任务、记录日志、更新状态
 */

const { v4: uuidv4 } = require('uuid');
const { get, run } = require('../database/db');
const { DailyTaskRunner, DEFAULT_SETTINGS } = require('../game/taskRunner');
const { createTask, hasTaskType } = require('../game/tasks');
const { getShanghaiISO, isNoLoginPeriod } = require('../utils/time');
const logger = require('../utils/logger');
const wsManager = require('./wsManager');

// 执行锁：防止同一账号任务并发执行
const _executionLocks = new Map(); // accountId → boolean

/**
 * 执行单个账号的每日任务
 * @param {string} accountId - 游戏账号ID
 * @param {object} workerManager - WorkerManager 实例
 * @param {object} options - { manual: bool, taskName: string }
 */
async function executeDailyTask(accountId, workerManager, options = {}) {
  const { manual = false, taskName = 'daily' } = options;
  const startTime = Date.now();

  // 执行锁检查
  if (_executionLocks.get(accountId)) {
    logger.warn('task', `账号 ${accountId} 已有任务在执行中，跳过`);
    return { success: false, message: '该账号已有任务在执行中' };
  }
  _executionLocks.set(accountId, true);

  try {
    return await _executeTaskInternal(accountId, workerManager, options, startTime);
  } finally {
    _executionLocks.delete(accountId);
  }
}

/**
 * 实际任务执行逻辑
 */
async function _executeTaskInternal(accountId, workerManager, options, startTime) {
  const { manual = false, taskName = 'daily' } = options;

  // 获取 Worker
  const worker = workerManager.getWorker(accountId);
  if (!worker || worker.status !== 'connected') {
    // 尝试启动 Worker
    if (!worker) {
      const startResult = await workerManager.start(accountId);
      if (!startResult.success) {
        await _logTask(accountId, taskName, 'failed', manual, 'Worker 启动失败: ' + (startResult.message || ''), null, startTime);
        return { success: false, message: 'Worker 启动失败' };
      }
    }

    // 等待连接
    const maxWait = 15000;
    const waited = await _waitForConnection(workerManager, accountId, maxWait);
    if (!waited) {
      await _logTask(accountId, taskName, 'failed', manual, 'Worker 连接超时', null, startTime);
      return { success: false, message: 'Worker 连接超时' };
    }
  }

  const w = workerManager.getWorker(accountId);

  // 等待角色信息加载完成，确保游戏服务器已建立上下文
  try {
    await w.waitForReady(15000);
  } catch (e) {
    logger.warn('task', `等待角色就绪超时: ${e.message}，继续执行任务`);
  }

  // 免登录时段检查
  if (isNoLoginPeriod()) {
    await _logTask(accountId, taskName, 'skipped', manual, '免登录时段，跳过执行', null, startTime);
    return { success: false, reason: 'no_login_period', message: '免登录时段' };
  }

  // 设置当前任务
  w.setCurrentTask(taskName);

  // 从 DB 获取任务配置和用户ID
  const account = get('SELECT * FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
  const settings = account ? { ...DEFAULT_SETTINGS } : DEFAULT_SETTINGS;
  const userId = account?.user_id;

  // 推送任务开始事件
  if (userId) wsManager.pushToUser(userId, 'task:start', { accountId, taskName, manual, accountName: account?.name });
  wsManager.pushToAdmins('task:start', { accountId, taskName, manual, accountName: account?.name });

  // 创建日志回调
  const onLog = ({ time, message, type }) => {
    logger.info('task', `[${account?.name || accountId}] ${message}`);
    if (userId) wsManager.pushToUser(userId, 'task:log', { accountId, taskName, message, type, time });
  };

  // 从 DB 获取任务配置
  const taskRow = get('SELECT * FROM tasks WHERE account_id = ? AND task_type = ?', [accountId, taskName]);
  let taskConfig = {};
  if (taskRow?.config) {
    try { taskConfig = JSON.parse(taskRow.config); } catch (e) { taskConfig = {}; }
  }

  // 通过任务注册表创建任务实例
  const deps = { worker: w, onLog, config: { ...settings, ...taskConfig } };
  const taskFn = createTask(taskName, deps);

  if (!taskFn) {
    // 未知任务类型，回退到 DailyTaskRunner
    const runner = new DailyTaskRunner(w, settings, onLog);
    try {
      const result = await runner.run();
      const duration = Date.now() - startTime;
      await _logTask(accountId, taskName, 'success', manual, JSON.stringify(result), null, startTime);
      if (userId) wsManager.pushToUser(userId, 'task:complete', { accountId, taskName, result, duration });
      wsManager.pushToAdmins('task:complete', { accountId, taskName, result, duration });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await _logTask(accountId, taskName, 'failed', manual, error.message, null, startTime);
      if (userId) wsManager.pushToUser(userId, 'task:failed', { accountId, taskName, error: error.message, duration });
      wsManager.pushToAdmins('task:failed', { accountId, taskName, error: error.message, duration });
      return { success: false, message: error.message };
    } finally {
      w.setCurrentTask(null);
      try {
        await workerManager.stop(accountId);
        logger.info('task', `任务完成，已自动断开账号 ${accountId} 的连接`);
      } catch (stopErr) {
        logger.warn('task', `断开连接失败: ${stopErr.message}`);
      }
    }
  }

  // 执行注册表任务
  try {
    const result = await taskFn();
    const duration = Date.now() - startTime;
    await _logTask(accountId, taskName, 'success', manual, JSON.stringify(result), null, startTime);
    if (userId) wsManager.pushToUser(userId, 'task:complete', { accountId, taskName, result, duration });
    wsManager.pushToAdmins('task:complete', { accountId, taskName, result, duration });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    await _logTask(accountId, taskName, 'failed', manual, error.message, null, startTime);
    if (userId) wsManager.pushToUser(userId, 'task:failed', { accountId, taskName, error: error.message, duration });
    wsManager.pushToAdmins('task:failed', { accountId, taskName, error: error.message, duration });
    return { success: false, message: error.message };
  } finally {
    w.setCurrentTask(null);
    // 任务完成后自动断开连接，避免占用账号导致被顶
    try {
      await workerManager.stop(accountId);
      logger.info('task', `任务完成，已自动断开账号 ${accountId} 的连接`);
    } catch (stopErr) {
      logger.warn('task', `断开连接失败: ${stopErr.message}`);
    }
  }
}

/**
 * 等待 Worker 连接就绪
 */
async function _waitForConnection(workerManager, accountId, maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const w = workerManager.getWorker(accountId);
    if (w && w.status === 'connected') return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

/**
 * 记录任务日志到 DB
 */
async function _logTask(accountId, taskName, status, manual, result, error, startTime) {
  const duration = Date.now() - startTime;
  const taskRow = get('SELECT id FROM tasks WHERE account_id = ? AND task_type = ?', [accountId, taskName]);

  run(
    `INSERT INTO task_logs (task_id, account_id, task_type, status, manual, result, error, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      taskRow?.id || 'ad-hoc',
      accountId,
      taskName,
      status,
      manual ? 1 : 0,
      result,
      error,
      duration,
      getShanghaiISO(),
    ]
  );

  // 更新任务的 last_execute
  if (taskRow) {
    run(
      'UPDATE tasks SET last_execute = ?, last_result = ? WHERE id = ?',
      [getShanghaiISO(), status, taskRow.id]
    );
  }

  logger.info('task', `任务完成: ${taskName} [${accountId}] → ${status} (${duration}ms)`);
}

module.exports = { executeDailyTask };
