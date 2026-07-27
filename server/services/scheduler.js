/**
 * 任务调度器
 * 使用 node-cron，按上海时区定时执行
 * 支持每日定时执行 + 手动触发
 */

const cron = require('node-cron');
const { get, all, run } = require('../database/db');
const { getShanghaiISO, isNoLoginPeriod } = require('../utils/time');
const { executeDailyTask } = require('./taskExecutor');
const logger = require('../utils/logger');

class TaskScheduler {
  constructor(workerManager) {
    this.workerManager = workerManager;
    /** @type {Map<string, cron.ScheduledTask>} taskId → cron job */
    this.cronJobs = new Map();
    /** @type {Map<string, NodeJS.Timeout>} taskId → interval timer */
    this.intervalTimers = new Map();

    // 默认每日执行时间（上海时间 04:00）
    this.defaultCronExpression = '0 4 * * *';
    this.timezone = 'Asia/Shanghai';
  }

  /**
   * 初始化：加载所有 enabled 的定时任务
   */
  init() {
    // 清理旧 job
    this.stopAll();

    const tasks = all(
      `SELECT * FROM tasks WHERE enabled = 1`
    );

    for (const task of tasks) {
      this._scheduleTask(task);
    }

    logger.info('scheduler', `已加载 ${this.cronJobs.size} 个定时任务, ${this.intervalTimers.size} 个间隔任务`);
  }

  /**
   * 调度单个任务
   */
  _scheduleTask(task) {
    // 停止旧 job
    this._stopTask(task.id);

    if (task.schedule_type === 'interval') {
      // 间隔调度模式
      const minutes = task.interval_minutes || 30;
      const intervalMs = minutes * 60 * 1000;

      // 新创建的间隔任务不立即执行，等第一个间隔周期到了再执行
      // （避免导入账号时凌晨被立即踢上号）

      const timer = setInterval(async () => {
        await this._executeTask(task);
      }, intervalMs);

      this.intervalTimers.set(task.id, timer);

      // 更新 next_execute
      const next = new Date(Date.now() + intervalMs);
      run('UPDATE tasks SET next_execute = ? WHERE id = ?', [getShanghaiISO(next), task.id]);

      logger.info('scheduler', `间隔任务已调度: ${task.name} → 每${minutes}分钟`);
      return;
    }

    if (task.schedule_type === 'cron') {
      // cron 表达式模式，execute_time 字段存储完整 cron 表达式
      const cronExpr = task.execute_time;
      if (!cronExpr || !cron.validate(cronExpr)) {
        logger.error('scheduler', `无效的 cron 表达式: ${cronExpr} (task: ${task.id})`);
        return;
      }

      const job = cron.schedule(cronExpr, async () => {
        await this._executeTask(task);
      }, {
        timezone: this.timezone,
      });

      this.cronJobs.set(task.id, job);
      this._updateNextExecute(task.id, cronExpr);
      logger.info('scheduler', `任务已调度: ${task.name} → ${cronExpr} (${this.timezone})`);
      return;
    }

    // 默认 daily 模式
    // 解析执行时间（格式 HH:MM）
    let cronExpr = this.defaultCronExpression;
    if (task.execute_time) {
      const [h, m] = task.execute_time.split(':');
      if (h !== undefined && m !== undefined) {
        cronExpr = `${parseInt(m)} ${parseInt(h)} * * *`;
      }
    }

    if (!cron.validate(cronExpr)) {
      logger.error('scheduler', `无效的 cron 表达式: ${cronExpr} (task: ${task.id})`);
      return;
    }

    const job = cron.schedule(cronExpr, async () => {
      await this._executeTask(task);
    }, {
      timezone: this.timezone,
    });

    this.cronJobs.set(task.id, job);

    // 更新 next_execute
    this._updateNextExecute(task.id, cronExpr);

    logger.info('scheduler', `任务已调度: ${task.name} → ${cronExpr} (${this.timezone})`);
  }

  /**
   * 解析任务绑定的所有账号ID
   */
  _getTaskAccountIds(task) {
    // 优先用 account_ids（JSON数组），否则回退到单个 account_id
    if (task.account_ids) {
      try {
        const ids = JSON.parse(task.account_ids);
        if (Array.isArray(ids) && ids.length > 0) return ids;
      } catch (e) {}
    }
    return task.account_id ? [task.account_id] : [];
  }

  /**
   * 执行任务（带免登录时段检查）— 支持多账号顺序执行
   */
  async _executeTask(task) {
    const accountIds = this._getTaskAccountIds(task);
    if (accountIds.length === 0) {
      logger.warn('scheduler', `任务 ${task.name} 没有绑定账号，跳过`);
      return;
    }

    logger.info('scheduler', `开始执行任务: ${task.name} [${accountIds.length}个账号]`);

    if (isNoLoginPeriod()) {
      logger.warn('scheduler', `免登录时段，跳过: ${task.name}`);
      this._scheduleDelayedRetry(task);
      return;
    }

    // 顺序执行每个账号（一个完成断开后再执行下一个）
    for (const accountId of accountIds) {
      try {
        const result = await executeDailyTask(accountId, this.workerManager, {
          manual: false,
          taskName: task.task_type,
        });
        logger.info('scheduler', `任务执行完成: ${task.name} [${accountId}]`, result);
      } catch (err) {
        logger.error('scheduler', `任务执行异常: ${task.name} [${accountId}] - ${err.message}`);
        // 继续执行下一个账号，不中断
      }
    }
  }

  /**
   * 免登录时段延迟重试
   */
  _scheduleDelayedRetry(task) {
    // 计算下一个可执行时间（简单的30分钟后重试）
    setTimeout(async () => {
      if (isNoLoginPeriod()) {
        this._scheduleDelayedRetry(task);
      } else {
        logger.info('scheduler', `免登录时段结束，重试: ${task.name}`);
        await this._executeTask(task);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * 停止单个任务
   */
  _stopTask(taskId) {
    const job = this.cronJobs.get(taskId);
    if (job) {
      job.stop();
      this.cronJobs.delete(taskId);
    }
    const timer = this.intervalTimers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.intervalTimers.delete(taskId);
    }
  }

  /**
   * 添加新任务到调度器
   */
  addTask(task) {
    if (task.enabled) {
      this._scheduleTask(task);
    }
  }

  /**
   * 更新任务调度
   */
  updateTask(task) {
    this._stopTask(task.id);
    if (task.enabled) {
      this._scheduleTask(task);
    }
  }

  /**
   * 移除任务
   */
  removeTask(taskId) {
    this._stopTask(taskId);
  }

  /**
   * 停止所有任务
   */
  stopAll() {
    for (const [id, job] of this.cronJobs) {
      job.stop();
    }
    this.cronJobs.clear();
    for (const [id, timer] of this.intervalTimers) {
      clearInterval(timer);
    }
    this.intervalTimers.clear();
  }

  /**
   * 手动执行任务
   */
  async runManual(accountId, taskType = 'daily') {
    logger.info('scheduler', `手动执行: ${taskType} [${accountId}]`);
    return executeDailyTask(accountId, this.workerManager, {
      manual: true,
      taskName: taskType,
    });
  }

  /**
   * 计算 next_execute 时间
   */
  _updateNextExecute(taskId, cronExpr) {
    try {
      // 解析 cron 表达式估算下次执行时间
      // 简化逻辑：如果是 daily 模式（N H * * *），算今天/明天的时间
      // 如果是 cron 模式，用 cron-parser 估算
      let nextDate = null;

      const parts = cronExpr.trim().split(/\s+/);
      if (parts.length === 5 && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
        // daily 模式: M H * * *
        const minute = parseInt(parts[0]);
        const hour = parseInt(parts[1]);
        const now = new Date();
        // 转上海时间
        const shanghaiOffset = 8 * 60 * 60 * 1000;
        const nowShanghai = new Date(now.getTime() + shanghaiOffset + now.getTimezoneOffset() * 60000);
        nextDate = new Date(nowShanghai);
        nextDate.setUTCHours(hour, minute, 0, 0);
        // 如果今天的时间已过，算明天
        if (nextDate.getTime() <= nowShanghai.getTime()) {
          nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        }
      } else {
        // 复杂 cron 表达式，简单加1天作为估算（不精确但比没有好）
        nextDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      const nextStr = getShanghaiISO(nextDate);
      run('UPDATE tasks SET next_execute = ? WHERE id = ?', [nextStr, taskId]);
    } catch (err) {
      // 忽略计算错误
    }
  }

  /**
   * 获取调度器状态
   */
  getStatus() {
    const tasks = all(`
      SELECT id, name, task_type, enabled, execute_time, last_execute, next_execute
      FROM tasks
      ORDER BY enabled DESC, next_execute ASC
    `);

    return {
      scheduledCount: this.cronJobs.size + this.intervalTimers.size,
      cronCount: this.cronJobs.size,
      intervalCount: this.intervalTimers.size,
      tasks: tasks.map(t => ({
        ...t,
        active: this.cronJobs.has(t.id) || this.intervalTimers.has(t.id),
      })),
    };
  }
}

module.exports = TaskScheduler;
