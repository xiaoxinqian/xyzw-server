/**
 * WorkerManager - 管理所有 Worker 实例
 * 单例模式，全局唯一
 */

const { v4: uuidv4 } = require('uuid');
const { get, all, run } = require('../database/db');
const Worker = require('../game/worker');
const { getShanghaiISO } = require('../utils/time');
const logger = require('../utils/logger');
const wsManager = require('./wsManager');

class WorkerManager {
  constructor() {
    /** @type {Map<string, Worker>} accountId → Worker */
    this.workers = new Map();
  }

  /**
   * 启动某个账号的 Worker
   */
  async start(accountId) {
    if (this.workers.has(accountId)) {
      const existing = this.workers.get(accountId);
      if (existing.status === 'connected' || existing.status === 'connecting') {
        return { success: false, message: 'Worker 已在运行' };
      }
    }

    // 确保 DB 中有 worker 记录
    let workerRow = get('SELECT * FROM workers WHERE account_id = ?', [accountId]);
    if (!workerRow) {
      const id = uuidv4();
      run(
        'INSERT INTO workers (id, account_id, status, started_at) VALUES (?, ?, ?, ?)',
        [id, accountId, 'starting', getShanghaiISO()]
      );
    } else {
      run('UPDATE workers SET status = ?, error_message = NULL WHERE account_id = ?', ['starting', accountId]);
    }

    // 获取账号信息和 user_id
    const account = get('SELECT ga.*, u.id as user_id FROM game_accounts ga JOIN users u ON ga.user_id = u.id WHERE ga.id = ? AND ga.deleted_at IS NULL', [accountId]);
    const userId = account?.user_id;

    const worker = new Worker(accountId, {
      onStatusChange: (accId, status) => {
        logger.info('worker', `状态变更: ${accId} → ${status}`);
        // 推送状态变化给用户和管理员
        const payload = { accountId: accId, status, accountName: account?.name };
        if (userId) wsManager.pushToUser(userId, 'worker:status', payload);
        wsManager.pushToAdmins('worker:status', payload);
        // 更新 DB
        run('UPDATE workers SET status = ?, last_heartbeat = ? WHERE account_id = ?', [status, getShanghaiISO(), accId]);
      },
      onLog: ({ level, message, accountId: accId }) => {
        logger[level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'info']('worker', `[${accId}] ${message}`);
      },
    });

    this.workers.set(accountId, worker);
    await worker.start();
    return { success: true };
  }

  /**
   * 停止某个账号的 Worker
   */
  async stop(accountId) {
    const worker = this.workers.get(accountId);
    if (worker) {
      await worker.stop();
      this.workers.delete(accountId);
      return { success: true };
    }
    return { success: false, message: 'Worker 未运行' };
  }

  /**
   * 重启 Worker
   */
  async restart(accountId) {
    await this.stop(accountId);
    await new Promise(r => setTimeout(r, 1000));
    return this.start(accountId);
  }

  /**
   * 获取 Worker 运行状态
   */
  getStatus(accountId) {
    const worker = this.workers.get(accountId);
    if (!worker) {
      const dbRow = get('SELECT * FROM workers WHERE account_id = ?', [accountId]);
      return {
        running: false,
        status: dbRow?.status || 'stopped',
        dbRecord: dbRow,
      };
    }

    return {
      running: true,
      status: worker.status,
      currentTask: worker.currentTask,
      reconnectCount: worker.reconnectCount,
      wsStatus: worker.getWebSocketStatus(),
    };
  }

  /**
   * 列出所有运行中的 Worker
   */
  listAll() {
    const result = [];
    for (const [accountId, worker] of this.workers) {
      result.push({
        accountId,
        status: worker.status,
        currentTask: worker.currentTask,
        reconnectCount: worker.reconnectCount,
        wsStatus: worker.getWebSocketStatus(),
      });
    }
    return result;
  }

  /**
   * 批量启动（启动所有 enabled 账号的 Worker）
   */
  async startAll() {
    const accounts = all(
      `SELECT ga.id FROM game_accounts ga WHERE ga.deleted_at IS NULL AND ga.status != 'deleted'`,
      []
    );

    const results = [];
    for (const acc of accounts) {
      try {
        const r = await this.start(acc.id);
        results.push({ accountId: acc.id, ...r });
        // 间隔启动，避免并发太多
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        results.push({ accountId: acc.id, success: false, message: err.message });
      }
    }
    return results;
  }

  /**
   * 停止所有 Worker
   */
  async stopAll() {
    const results = [];
    for (const [accountId] of this.workers) {
      try {
        await this.stop(accountId);
        results.push({ accountId, success: true });
      } catch (err) {
        results.push({ accountId, success: false, message: err.message });
      }
    }
    return results;
  }

  /**
   * 获取 Worker 实例（供任务系统调用）
   */
  getWorker(accountId) {
    return this.workers.get(accountId) || null;
  }
}

// 单例
const instance = new WorkerManager();

module.exports = instance;
