/**
 * Worker - 每个游戏账号一个 Worker 实例
 * 管理 WebSocket 连接、心跳、重连、token 刷新
 * 提供 sendMessageWithPromise 接口供任务系统调用
 */

const { v4: uuidv4 } = require('uuid');
const { XyzwWebSocketClient } = require('./xyzwWebSocket');
const { getDecryptedToken, getDecryptedBin, refreshToken } = require('../services/accountService');
const { getShanghaiISO, isNoLoginPeriod } = require('../utils/time');
const { get, run } = require('../database/db');
const logger = require('../utils/logger');

const RECONNECT_MAX = 0; // 不自动重连，避免顶号
const RECONNECT_DELAY = 3000;
const TOKEN_REFRESH_RETRY_DELAY = 5000;

class Worker {
  constructor(accountId, options = {}) {
    this.accountId = accountId;
    this.workerId = uuidv4();

    // 状态: stopped | connecting | connected | reconnecting | error | stopped
    this.status = 'stopped';
    this.wsClient = null;
    this.currentTask = null;

    // 重连
    this.reconnectCount = 0;
    this.reconnectTimer = null;

    // 心跳监控
    this.lastHeartbeatAck = Date.now();
    this.heartbeatWatchTimer = null;

    // 回调
    this.onStatusChange = options.onStatusChange || null;
    this.onLog = options.onLog || null;

    // 停止标志
    this._stopped = false;

    // 连接锁，防止并发 _connect
    this._connecting = false;

    // 就绪 Promise：role_getroleinfo 完成后才算就绪
    this._readyPromise = null;
    this._readyResolve = null;
  }

  /**
   * 启动 Worker：建立 WebSocket 连接
   */
  async start() {
    if (this.status === 'connected' || this.status === 'connecting') {
      return;
    }

    this._stopped = false;
    this._updateStatus('connecting');
    this._log('info', 'Worker 启动中...');

    // 检查免登录时段
    if (isNoLoginPeriod()) {
      this._log('warn', '当前为免登录时段，延迟启动');
      await this._waitForNoLoginEnd();
      if (this._stopped) return;
    }

    await this._connect();
  }

  /**
   * 停止 Worker
   */
  async stop() {
    this._stopped = true;
    this._log('info', 'Worker 停止中...');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatWatchTimer) {
      clearInterval(this.heartbeatWatchTimer);
      this.heartbeatWatchTimer = null;
    }

    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
    }

    this._updateStatus('stopped');
    this._updateDbStatus('stopped');
    this._log('info', 'Worker 已停止');
  }

  /**
   * 建立 WebSocket 连接
   */
  async _connect() {
    if (this._connecting || this._stopped) return;
    this._connecting = true;
    try {
      // 先清理旧连接，移除回调避免触发重连死循环
      if (this.wsClient) {
        const old = this.wsClient;
        old.onDisconnect = null;
        old.onConnect = null;
        old.onError = null;
        try { old.disconnect(); } catch(e) {}
        this.wsClient = null;
      }

      // 每次连接都刷新 token，避免使用过期 token
      this._log('info', '刷新 Token...');
      const refreshResult = await refreshToken(this.accountId);
      if (!refreshResult.success) {
        throw new Error('Token 刷新失败: ' + refreshResult.message);
      }
      let token = getDecryptedToken(this.accountId);

      if (!token) {
        throw new Error('Token 获取失败');
      }

      // 解析 token，构造 WebSocket URL
      const tokenData = JSON.parse(token);
      const fullJsonToken = JSON.stringify({
        roleToken: tokenData.roleToken || tokenData.token,
        roleId: tokenData.roleId,
        sessId: tokenData.sessId,
        connId: tokenData.connId,
        isRestore: 0,
      });

      const wsUrl = `wss://xxz-xyzw.hortorgames.com/agent?p=${encodeURIComponent(fullJsonToken)}&e=x&lang=chinese`;

      // 创建 WebSocket 客户端
      this.wsClient = new XyzwWebSocketClient({
        url: wsUrl,
        heartbeatMs: 5000,
      });

      this.wsClient.onConnect = () => {
        this.reconnectCount = 0;
        this.lastHeartbeatAck = Date.now();
        this._updateStatus('connected');
        this._updateDbStatus('connected');
        this._startHeartbeatWatch();
        this._log('info', 'WebSocket 连接成功');

        // 连接成功后拉取角色信息，拉取完成后才算就绪
        this._readyPromise = new Promise((resolve) => {
          this._readyResolve = resolve;
        });
        this._fetchRoleInfo().finally(() => {
          if (this._readyResolve) this._readyResolve();
        });
      };

      this.wsClient.onDisconnect = (evt) => {
        this._stopHeartbeatWatch();
        this._updateStatus('disconnected');
        this._updateDbStatus('disconnected');

        if (!this._stopped) {
          this._log('warn', `连接断开，准备重连 (code: ${evt?.code})`);
          this._scheduleReconnect();
        }
      };

      this.wsClient.onError = (error) => {
        this._log('error', `WebSocket 错误: ${error.message || '未知错误'}`);
      };

      // 连接
      this.wsClient.init();

    } catch (err) {
      this._log('error', `连接失败: ${err.message}`);
      this._updateStatus('error');

      // token 过期类错误，尝试刷新
      if (err.message.includes('token') || err.message.includes('Token') || err.message.includes('401')) {
        this._log('info', '尝试刷新 Token 后重连...');
        const refreshResult = await refreshToken(this.accountId);
        if (refreshResult.success && !this._stopped) {
          await new Promise(r => setTimeout(r, TOKEN_REFRESH_RETRY_DELAY));
          this._connecting = false;
          return this._connect();
        }
      }

      if (!this._stopped) {
        this._scheduleReconnect();
      }
    } finally {
      this._connecting = false;
    }
  }

  /**
   * 拉取角色信息并存库
   */
  async _fetchRoleInfo() {
    try {
      // 等待 1s 让连接稳定
      await new Promise(r => setTimeout(r, 1000));
      if (this._stopped || this.status !== 'connected') return;

      this._log('info', '拉取角色信息...');
      const resp = await this.sendMessageWithPromise('role_getroleinfo', {}, 10000);
      const role = resp?.rawData?.role || resp?.role;
      if (!role) {
        this._log('warn', '角色信息为空');
        return;
      }

      // 提取关键字段
      const roleName = role.name || role.nickName || role.nickname || '';
      const level = role.level || 0;
      const vipLevel = role.vipLevel || role.vip || 0;

      // 更新 game_accounts：用真实角色名更新 name，同时保存 role_name
      const account = get('SELECT name, server_id FROM game_accounts WHERE id = ?', [this.accountId]);
      const serverId = account?.server_id || '';
      const newName = serverId ? `${serverId}_${roleName}` : roleName;
      run(
        'UPDATE game_accounts SET name = ?, role_name = ?, level = ?, vip_level = ?, last_active = ? WHERE id = ?',
        [newName, roleName, level, vipLevel, getShanghaiISO(), this.accountId]
      );

      // 存入 game_data_history
      const { v4: uid } = require('uuid');
      run(
        'INSERT INTO game_data_history (account_id, data_type, data_value, record_time) VALUES (?, ?, ?, ?)',
        [this.accountId, 'role_info', JSON.stringify({ roleName, level, vipLevel, roleId: role.id }), getShanghaiISO()]
      );

      this._log('info', `角色信息已保存: ${roleName} Lv.${level}`);
    } catch (err) {
      this._log('warn', `拉取角色信息失败: ${err.message}`);
    }
  }

  /**
   * 重连调度
   */
  _scheduleReconnect() {
    if (this._stopped) return;
    if (RECONNECT_MAX <= 0) {
      this._log('info', '自动重连已禁用，不保持连接');
      this._updateStatus('disconnected');
      this._updateDbStatus('disconnected');
      return;
    }
    if (this.reconnectCount >= RECONNECT_MAX) {
      this._log('error', `已达最大重连次数 (${RECONNECT_MAX})，停止重连`);
      this._updateStatus('error');
      this._updateDbStatus('error', '已达最大重连次数');
      return;
    }

    // 免登录时段不重连
    if (isNoLoginPeriod()) {
      this._log('warn', '免登录时段，暂停重连');
      this._waitForNoLoginEnd().then(() => {
        if (!this._stopped) this._connect();
      });
      return;
    }

    this.reconnectCount++;
    this._updateStatus('reconnecting');
    const delay = RECONNECT_DELAY * this.reconnectCount;
    this._log('info', `第 ${this.reconnectCount} 次重连，${delay}ms 后执行`);

    this.reconnectTimer = setTimeout(() => {
      if (!this._stopped) this._connect();
    }, delay);
  }

  /**
   * 心跳监控：如果超过 30 秒没收到任何消息，认为连接已断开
   */
  _startHeartbeatWatch() {
    this._stopHeartbeatWatch();
    if (RECONNECT_MAX <= 0) return; // 不自动重连模式，不监控心跳
    this.heartbeatWatchTimer = setInterval(() => {
      const elapsed = Date.now() - this.lastHeartbeatAck;
      if (elapsed > 30000) {
        this._log('warn', `心跳超时 (${elapsed}ms)，触发重连`);
        if (this.wsClient) {
          this.wsClient.reconnect();
        }
      }
    }, 10000);
  }

  _stopHeartbeatWatch() {
    if (this.heartbeatWatchTimer) {
      clearInterval(this.heartbeatWatchTimer);
      this.heartbeatWatchTimer = null;
    }
  }

  /**
   * 等待免登录时段结束
   */
  async _waitForNoLoginEnd() {
    while (isNoLoginPeriod() && !this._stopped) {
      await new Promise(r => setTimeout(r, 60000)); // 每分钟检查一次
    }
  }

  /**
   * 等待 Worker 就绪（角色信息拉取完成）
   */
  async waitForReady(timeoutMs = 15000) {
    if (!this._readyPromise) return true;
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('等待就绪超时')), timeoutMs)
    );
    await Promise.race([this._readyPromise, timeout]);
    // 额外等待 500ms 让服务器稳定
    await new Promise(r => setTimeout(r, 500));
  }

  /**
   * 发送命令并等待 Promise 响应（供任务系统调用）
   */
  async sendMessageWithPromise(cmd, params = {}, timeoutMs = 8000) {
    if (this.status !== 'connected' || !this.wsClient) {
      throw new Error(`Worker 未连接，无法发送命令: ${cmd}`);
    }

    const result = await this.wsClient.sendWithPromise(cmd, params, timeoutMs);
    this.lastHeartbeatAck = Date.now();
    return result;
  }

  /**
   * 获取 WebSocket 连接状态
   */
  getWebSocketStatus() {
    if (!this.wsClient) return 'disconnected';
    return this.wsClient.connected ? 'connected' : 'disconnected';
  }

  /**
   * 设置当前任务
   */
  setCurrentTask(taskName) {
    this.currentTask = taskName;
    run('UPDATE workers SET current_task = ? WHERE account_id = ?', [taskName, this.accountId]);
  }

  // ============ 内部工具 ============

  _updateStatus(status) {
    this.status = status;
    if (this.onStatusChange) {
      this.onStatusChange(this.accountId, status);
    }
  }

  _updateDbStatus(status, errorMessage = null) {
    run(
      `UPDATE workers SET status = ?, error_message = ?, last_heartbeat = ?, started_at = CASE WHEN started_at IS NULL AND ? = 'connected' THEN ? ELSE started_at END WHERE account_id = ?`,
      [status, errorMessage, getShanghaiISO(), status, getShanghaiISO(), this.accountId]
    );
  }

  _log(level, message) {
    if (this.onLog) {
      this.onLog({ level, message, time: getShanghaiISO(), accountId: this.accountId });
    }
    logger[level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'info']('worker', `[${this.accountId}] ${message}`);
  }
}

module.exports = Worker;
