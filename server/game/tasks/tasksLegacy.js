/**
 * 功法任务工厂
 * 从参考项目 tasksLegacy.js 移植
 * 功能：领取功法残卷 + 赠送功法残卷
 */

const { getShanghaiISO } = require('../../utils/time');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 批量领取功法残卷
 * 原项目：legacy_claimhangup → 返回 reward[0].value 和 role.items[37007].quantity
 */
function createBatchLegacyClaim(deps) {
  return async function batchLegacyClaim() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始领取功法残卷...');
    try {
      const resp = await worker.sendMessageWithPromise('legacy_claimhangup', {}, 8000);
      await sleep(500);

      const rewardValue = resp?.rawData?.reward?.[0]?.value ?? resp?.reward?.[0]?.value ?? 0;
      const totalQuantity = resp?.rawData?.role?.items?.[37007]?.quantity
        ?? resp?.role?.items?.[37007]?.quantity ?? 0;

      log(`成功领取功法残卷 ${rewardValue}，共有 ${totalQuantity} 个`, 'success');
      return { success: true, rewardValue, totalQuantity };
    } catch (error) {
      log(`领取功法残卷失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 增强版批量赠送功法残卷
 * 原项目流程：
 * 1. 获取角色信息检查功法残卷数量 (items[37007])
 * 2. 如有配置，用 rank_getroleinfo 查询接收者信息
 * 3. role_commitpassword 验证安全密码
 * 4. legacy_sendgift 赠送功法残卷
 * config: { recipientId, password, quantity }
 */
function createBatchLegacyGiftSendEnhanced(deps) {
  return async function batchLegacyGiftSendEnhanced() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    const recipientId = Number(config.recipientId || 0);
    const password = config.password || '';
    const itemId = 37007;

    if (!recipientId || recipientId <= 0) {
      log('未配置接收者ID，跳过赠送', 'warning');
      return { success: false, message: '未配置接收者ID' };
    }

    log(`开始赠送功法残卷给 ID:${recipientId}...`);
    try {
      // 1. 获取角色信息，检查功法残卷数量
      const roleInfoResp = await worker.sendMessageWithPromise('role_getroleinfo', {}, 15000);
      const roleData = roleInfoResp?.rawData?.role || roleInfoResp?.role || {};
      const fragmentCount = Math.min(roleData?.items?.[itemId]?.quantity || 0, 9999);

      if (fragmentCount === 0) {
        log('功法残卷不足，当前拥有: 0', 'error');
        return { success: false, message: '功法残卷不足' };
      }

      const quantity = config.quantity ? Math.min(config.quantity, fragmentCount) : fragmentCount;

      // 2. 查询接收者信息
      let recipientName = '';
      let recipientServer = '';
      try {
        const rankResp = await worker.sendMessageWithPromise('rank_getroleinfo', {
          bottleType: 0,
          includeBottleTeam: false,
          isSearch: false,
          roleId: recipientId,
        }, 5000);
        const roleInfo = rankResp?.rawData?.roleInfo || rankResp?.roleInfo || {};
        recipientName = roleInfo.name || '';
        recipientServer = roleInfo.serverName || '';

        if (!roleInfo.roleId) {
          log(`接收者 ${recipientId} 不存在`, 'error');
          return { success: false, message: '接收者不存在' };
        }
      } catch (e) {
        log(`查询接收者信息失败: ${e.message}`, 'warning');
      }

      if (fragmentCount < quantity) {
        log(`功法残卷不足，当前拥有: ${fragmentCount}，需要: ${quantity}`, 'error');
        return { success: false, message: '功法残卷不足' };
      }

      // 3. 验证安全密码
      log('验证安全密码...');
      const pwdResp = await worker.sendMessageWithPromise('role_commitpassword', {
        password,
        passwordType: 1,
      }, 5000);

      const pwdOk = pwdResp?.rawData?.role?.statistics?.['que:wh:tm']
        ?? pwdResp?.role?.statistics?.['que:wh:tm'];
      if (!pwdOk) {
        log('安全密码验证失败，请检查密码配置', 'error');
        return { success: false, message: '安全密码验证失败' };
      }
      log('安全密码验证成功', 'success');

      // 4. 赠送功法残卷
      log(`开始赠送功法残卷 ${quantity} 个给 [${recipientServer}] ID:${recipientId} ${recipientName}...`);
      const sendResp = await worker.sendMessageWithPromise('legacy_sendgift', {
        itemCnt: quantity,
        legacyUIds: [],
        targetId: recipientId,
      }, 5000);

      const errMsg = sendResp?.rawData?.error || sendResp?.error;
      if (!sendResp || errMsg) {
        throw new Error(errMsg || '赠送请求无响应');
      }

      log(`成功赠送功法残卷 ${quantity} 个给 [${recipientServer}] ID:${recipientId} ${recipientName}`, 'success');
      return { success: true, quantity, recipientId, recipientName };
    } catch (error) {
      log(`赠送功法残卷失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = {
  createBatchLegacyClaim,
  createBatchLegacyGiftSendEnhanced,
};
