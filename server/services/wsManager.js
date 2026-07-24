/**
 * WebSocket 实时通信管理器
 * Server → Client 推送：任务进度、Worker状态变化、日志更新
 */

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class WsManager {
  constructor() {
    this.wss = null;
    /** @type {Map<string, Set<WebSocket>>} userId → connections */
    this.clients = new Map();
  }

  /**
   * 初始化 WebSocket 服务器，挂载到已有的 HTTP server
   */
  init(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      // 从 URL query 提取 token
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');

      let userId = null;
      let role = 'user';

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'xyzw-secret-key');
          userId = decoded.userId;
          role = decoded.role;
        } catch (e) {
          ws.close(4001, '认证失败');
          return;
        }
      } else {
        ws.close(4001, '缺少token');
        return;
      }

      ws.userId = userId;
      ws.role = role;

      // 加入到客户端映射
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId).add(ws);

      logger.info('ws', `客户端已连接 (user: ${userId})，当前在线: ${this._totalClients()}`);

      ws.on('close', () => {
        const conns = this.clients.get(userId);
        if (conns) {
          conns.delete(ws);
          if (conns.size === 0) {
            this.clients.delete(userId);
          }
        }
        logger.info('ws', `客户端已断开 (user: ${userId})，当前在线: ${this._totalClients()}`);
      });

      ws.on('error', () => {
        // 静默处理
      });

      // 发送连接成功消息
      this._send(ws, { type: 'connected', data: { userId, role } });
    });

    logger.info('ws', 'WebSocket 服务已启动 (/ws)');
  }

  /**
   * 推送消息给指定用户
   */
  pushToUser(userId, type, data) {
    const conns = this.clients.get(userId);
    if (!conns) return;
    const msg = JSON.stringify({ type, data, time: new Date().toISOString() });
    for (const ws of conns) {
      if (ws.readyState === 1) { // OPEN
        ws.send(msg);
      }
    }
  }

  /**
   * 推送给管理员
   */
  pushToAdmins(type, data) {
    for (const [userId, conns] of this.clients) {
      for (const ws of conns) {
        if (ws.role === 'admin' && ws.readyState === 1) {
          ws.send(JSON.stringify({ type, data, time: new Date().toISOString() }));
        }
      }
    }
  }

  /**
   * 广播给所有在线用户
   */
  broadcast(type, data) {
    const msg = JSON.stringify({ type, data, time: new Date().toISOString() });
    for (const [, conns] of this.clients) {
      for (const ws of conns) {
        if (ws.readyState === 1) {
          ws.send(msg);
        }
      }
    }
  }

  _send(ws, obj) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(obj));
    }
  }

  _totalClients() {
    let count = 0;
    for (const conns of this.clients.values()) count += conns.size;
    return count;
  }

  getStatus() {
    return {
      totalConnections: this._totalClients(),
      onlineUsers: this.clients.size,
    };
  }
}

// 单例
const instance = new WsManager();

module.exports = instance;
