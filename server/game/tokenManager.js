/**
 * Token 管理模块
 * 从参考项目 token.ts 移植，适配 Node.js
 * 去除浏览器依赖：crypto-js → crypto, axios 保留
 */

const axios = require('axios');
const crypto = require('crypto');
const { g_utils } = require('./bonProtocol');

/**
 * 获取 token 的 MD5 哈希作为 ID
 */
function getTokenId(token) {
  if (typeof token === 'string') {
    token = Buffer.from(token);
  }
  return crypto.createHash('md5').update(token).digest('hex');
}

/**
 * 简单限流器（复用参考项目逻辑）
 */
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
    this.queueSize = 0;
  }

  async waitForSlot() {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter(t => t > cutoff);

    if (this.requests.length < this.maxRequests) {
      this.requests.push(Date.now());
      return;
    }

    const oldest = this.requests[0];
    const waitTime = oldest + this.windowMs - Date.now();
    if (waitTime > 0) {
      await new Promise(r => setTimeout(r, waitTime + 100));
    }
    return this.waitForSlot();
  }

  async schedule(fn) {
    this.queueSize++;
    try {
      await this.waitForSlot();
      return fn();
    } finally {
      this.queueSize--;
    }
  }
}

const authUserRateLimiter = new RateLimiter(25, 60000);

/**
 * bin 数据 → authuser → 获取 token JSON 字符串
 * 保持参考项目 transformToken 逻辑不变
 */
async function transformToken(arrayBuffer) {
  return authUserRateLimiter.schedule(async () => {
    const res = await axios.post(
      'https://xxz-xyzw.hortorgames.com/login/authuser',
      arrayBuffer,
      {
        params: { _seq: 1 },
        headers: {
          'Content-Type': 'application/octet-stream',
          'referrerPolicy': 'no-referrer',
        },
        responseType: 'arraybuffer',
      }
    );

    const msg = g_utils.parse(res.data);
    const data = msg.getData();
    const currentTime = Date.now();
    const sessId = currentTime * 100 + Math.floor(Math.random() * 100);
    const connId = currentTime + Math.floor(Math.random() * 10);

    return JSON.stringify({
      ...data,
      sessId,
      connId,
      isRestore: 0,
    });
  });
}

/**
 * bin 数据 → serverlist → 获取服务器角色列表
 */
async function getServerList(arrayBuffer) {
  const res = await axios.post(
    'https://xxz-xyzw.hortorgames.com/login/serverlist',
    arrayBuffer,
    {
      params: { _seq: 3 },
      headers: {
        'Content-Type': 'application/octet-stream',
        'referrerPolicy': 'no-referrer',
      },
      responseType: 'arraybuffer',
    }
  );

  const msg = g_utils.parse(res.data);
  const data = msg.getData();
  return JSON.stringify({ ...data.roles });
}

/**
 * 解析 base64 token，返回完整 JSON 字符串
 * 保持参考项目 parseBase64Token 逻辑：优先返回 decoded（完整 JSON）
 */
function parseBase64Token(base64String) {
  try {
    if (!base64String || typeof base64String !== 'string') {
      throw new Error('Token字符串无效');
    }

    const cleanBase64 = base64String.replace(/^data:.*base64,/, '').trim();
    if (cleanBase64.length === 0) {
      throw new Error('Token字符串为空');
    }

    let decoded;
    try {
      decoded = Buffer.from(cleanBase64, 'base64').toString('utf8');
    } catch {
      decoded = base64String.trim();
    }

    let tokenData;
    try {
      tokenData = JSON.parse(decoded);
    } catch {
      tokenData = { token: decoded };
    }

    // 关键：返回完整 JSON 字符串作为 actualToken
    // 参考项目的 parseBase64Token 返回 decoded（完整 JSON），不是单个 roleToken
    const actualToken = tokenData.token || tokenData.gameToken || decoded;

    return {
      success: true,
      data: {
        ...tokenData,
        actualToken,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: '解析失败：' + error.message,
    };
  }
}

module.exports = {
  getTokenId,
  transformToken,
  getServerList,
  parseBase64Token,
  authUserRateLimiter,
};
