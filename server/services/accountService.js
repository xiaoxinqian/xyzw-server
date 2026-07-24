/**
 * 游戏账号管理服务
 */

const { v4: uuidv4 } = require('uuid');
const { get, all, run } = require('../database/db');
const { encrypt, decrypt, encryptBuffer, decryptBuffer } = require('../utils/crypto');
const { getTokenId, transformToken, getServerList, parseBase64Token } = require('../game/tokenManager');
const { getShanghaiISO } = require('../utils/time');
const logger = require('../utils/logger');
const { applyPresetTasks, removeAccountFromPresets } = require('./presetTasks');

let _scheduler = null;

/**
 * 注入调度器实例（app.js 启动时调用）
 */
function setScheduler(scheduler) {
  _scheduler = scheduler;
}

/**
 * 列出用户的游戏账号（普通用户只看自己的，管理员看全部）
 */
function listAccounts(userId, role) {
  const cols = 'id, user_id, name, role_name, server_id, role_id, import_method, status, token_status, last_login, last_active, last_refresh_at, last_refresh_error, created_at';
  if (role === 'admin') {
    return all(`SELECT ${cols} FROM game_accounts WHERE deleted_at IS NULL ORDER BY created_at DESC`, []);
  }
  return all(
    `SELECT ${cols} FROM game_accounts WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userId]
  );
}

/**
 * 获取单个账号详情
 */
function getAccount(accountId, userId, role) {
  const account = get('SELECT * FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
  if (!account) return null;
  if (role !== 'admin' && account.user_id !== userId) return null;
  return account;
}

/**
 * 通过 bin 文件导入账号
 * 支持单个 bin 包含多个角色/账号的情况
 * @param {string} userId - 用户ID
 * @param {string} name - 账号名称（多账号时作为前缀）
 * @param {Buffer} binBuffer - bin 文件数据
 * @param {string} importMethod - 'bin' | 'wxQrcode'
 * @param {object} options - { serverId?: number, roleId?: number, selectedRoles?: array }
 * @returns {object} 创建结果
 */
async function importByBin(userId, name, binBuffer, importMethod = 'bin', options = {}) {
  // 1. 生成 token ID
  const tokenId = getTokenId(binBuffer);

  // 2. 调用 authuser 获取 token
  let tokenStr;
  try {
    tokenStr = await transformToken(binBuffer);
  } catch (err) {
    logger.error('account', `Token获取失败: ${name}`, { error: err.message }, null);
    return { success: false, message: `Token获取失败: ${err.message}` };
  }

  // 3. 获取服务器列表（可能包含多个角色）
  let roles = [];
  try {
    const serverListStr = await getServerList(binBuffer);
    const serverList = JSON.parse(serverListStr);
    roles = Object.values(serverList);
  } catch (err) {
    logger.warn('account', `获取服务器列表失败: ${name}`, { error: err.message });
  }

  // 如果指定了 serverId/roleId，过滤角色
  if (options.serverId != null) {
    roles = roles.filter(r => r.serverId === options.serverId);
  }
  if (options.roleId != null) {
    roles = roles.filter(r => r.roleId === options.roleId);
  }
  if (options.selectedRoles && Array.isArray(options.selectedRoles) && options.selectedRoles.length > 0) {
    roles = roles.filter(r => options.selectedRoles.includes(r.roleId));
  }

  // 如果没有角色信息，创建单个账号
  if (roles.length === 0) {
    roles = [{ serverId: null, roleId: null }];
  }

  // 4. 加密存储（bin 和 token 对所有账号相同）
  const encryptedBin = encryptBuffer(binBuffer);
  const encryptedToken = encrypt(tokenStr);

  const results = [];

  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    // 默认名称：区服号_角色名，用户可后续修改
    const roleDisplay = role.name || role.roleId || `角色${i + 1}`;
    const serverNum = role.serverId ? Number(role.serverId) - 27 : 0;
    const accountName = name ? (roles.length > 1 ? `${name}_${roleDisplay}` : name) : `${serverNum || '未知'}_${roleDisplay}`;
    const id = uuidv4();

    run(
      `INSERT INTO game_accounts (id, user_id, name, server_id, role_id, bin_data, token, import_method, status, token_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'idle', 'active', ?, ?)`,
      [id, userId, accountName, role.serverId || null, role.roleId || null, encryptedBin, encryptedToken, importMethod, getShanghaiISO(), getShanghaiISO()]
    );

    // 自动套用预设任务
    try {
      const result = applyPresetTasks(id, _scheduler);
      logger.info('account', `新账号 ${accountName} 套用预设任务: 新建${result.created} 追加${result.added}`);
    } catch (e) {
      logger.warn('account', `预设任务创建失败: ${accountName} - ${e.message}`);
    }

    logger.info('account', `账号导入成功: ${accountName}`, { userId, accountId: id, serverId: role.serverId, roleId: role.roleId });
    results.push({ success: true, accountId: id, name: accountName, serverId: role.serverId, roleId: role.roleId });
  }

  // 返回结果
  if (results.length === 1) {
    return results[0];
  }
  return { success: true, count: results.length, accounts: results };
}

/**
 * 刷新账号 Token
 * userId/role 可选，不传则跳过权限检查（内部调用用）
 */
async function refreshToken(accountId, userId, role) {
  const account = userId
    ? getAccount(accountId, userId, role)
    : get('SELECT * FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
  if (!account) {
    return { success: false, message: '账号不存在' };
  }

  try {
    // 解密 bin 数据
    const binBuffer = decryptBuffer(account.bin_data);

    // 调用 authuser 刷新
    const tokenStr = await transformToken(binBuffer);
    const encryptedToken = encrypt(tokenStr);

    run(
      'UPDATE game_accounts SET token = ?, token_status = ?, last_refresh_at = ?, last_refresh_error = NULL, updated_at = ? WHERE id = ?',
      [encryptedToken, 'active', getShanghaiISO(), getShanghaiISO(), accountId]
    );

    logger.info('account', `Token刷新成功: ${account.name}`, { accountId });
    return { success: true };
  } catch (err) {
    run(
      'UPDATE game_accounts SET token_status = ?, last_refresh_error = ?, updated_at = ? WHERE id = ?',
      ['error', err.message, getShanghaiISO(), accountId]
    );
    logger.error('account', `Token刷新失败: ${account.name}`, { error: err.message, accountId });
    return { success: false, message: err.message };
  }
}

/**
 * 获取解密后的 token（供 Worker 使用）
 */
function getDecryptedToken(accountId) {
  const account = get('SELECT token FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
  if (!account || !account.token) return null;
  try {
    return decrypt(account.token);
  } catch {
    return null;
  }
}

/**
 * 获取解密后的 bin 数据
 */
function getDecryptedBin(accountId) {
  const account = get('SELECT bin_data FROM game_accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
  if (!account || !account.bin_data) return null;
  try {
    return decryptBuffer(account.bin_data);
  } catch {
    return null;
  }
}

/**
 * 软删除账号
 */
function deleteAccount(accountId, userId, role) {
  const account = getAccount(accountId, userId, role);
  if (!account) {
    return { success: false, message: '账号不存在' };
  }

  // 软删除：标记 deleted_at，清除敏感数据
  run(
    `UPDATE game_accounts SET deleted_at = ?, bin_data = NULL, token = NULL, status = 'deleted', updated_at = ? WHERE id = ?`,
    [getShanghaiISO(), getShanghaiISO(), accountId]
  );

  // 从预设任务的 account_ids 中移除该账号
  try {
    removeAccountFromPresets(accountId);
  } catch (e) {
    logger.warn('account', `移除预设任务关联失败: ${e.message}`);
  }

  // 删除该账号独占的自定义任务（非预设任务）
  run('DELETE FROM tasks WHERE account_id = ?', [accountId]);

  logger.info('account', `账号已删除: ${account.name}`, { accountId, userId });
  return { success: true };
}

/**
 * 更新账号状态
 */
function updateStatus(accountId, status) {
  run('UPDATE game_accounts SET status = ?, updated_at = ? WHERE id = ?', [status, getShanghaiISO(), accountId]);
}

/**
 * 预览 bin 文件中的角色列表（不导入）
 */
async function previewBinRoles(binBuffer) {
  const roles = [];
  try {
    const serverListStr = await getServerList(binBuffer);
    const serverList = JSON.parse(serverListStr);
    const roleList = Object.values(serverList);
    for (const r of roleList) {
      const serverNum = r.serverId ? Number(r.serverId) - 27 : 0;
      roles.push({
        roleId: r.roleId,
        serverId: r.serverId,
        serverNum, // 显示用：serverId - 27
        serverLabel: serverNum > 0 ? `${serverNum}服` : '未知',
        name: r.name || r.roleName || `角色${r.roleId}`,
        power: r.power || r.fightingCapacity || 0,
      });
    }
  } catch (err) {
    logger.warn('account', `预览角色列表失败: ${err.message}`);
  }
  return roles;
}

module.exports = {
  listAccounts,
  getAccount,
  importByBin,
  previewBinRoles,
  refreshToken,
  getDecryptedToken,
  getDecryptedBin,
  deleteAccount,
  updateStatus,
  setScheduler,
};
