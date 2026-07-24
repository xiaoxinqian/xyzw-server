/**
 * 瓶子/盐罐任务工厂
 * 从参考项目 tasksBottle.js 移植
 * 适配：tokenStore.sendMessageWithPromise(tokenId, cmd, params) → worker.sendMessageWithPromise(cmd, params)
 */

const { getShanghaiISO } = require('../../utils/time');
const logger = require('../../utils/logger');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 重置盐罐：停止 → 重启 → 领取
 */
function createResetBottles(deps) {
  return async function resetBottles() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始重置盐罐...');
    try {
      // 停止盐罐
      log('停止盐罐计时...');
      const stopResp = await worker.sendMessageWithPromise('bottlehelper_stop', {}, 8000);
      log(`停止响应: ${JSON.stringify(stopResp?.rawData || stopResp || {})}`);
      await sleep(500);

      // 重新开始
      log('重新开始盐罐计时...');
      const startResp = await worker.sendMessageWithPromise('bottlehelper_start', {}, 8000);
      log(`开始响应: ${JSON.stringify(startResp?.rawData || startResp || {})}`);
      await sleep(500);

      // 领取奖励
      log('领取盐罐奖励...');
      try {
        const claimResp = await worker.sendMessageWithPromise('bottlehelper_claim', {}, 8000);
        log(`领取响应: ${JSON.stringify(claimResp?.rawData || claimResp || {})}`, 'success');
      } catch (e) {
        log(`领取盐罐奖励失败（可能无奖励）: ${e.message}`, 'warning');
      }

      log('盐罐重置完成', 'success');
      return { success: true, message: '盐罐重置完成' };
    } catch (error) {
      log(`盐罐重置失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 批量领取灵罐
 */
function createBatchLingGuanZi(deps) {
  return async function batchlingguanzi() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始领取灵罐...');
    try {
      const result = await worker.sendMessageWithPromise('bottle_getinfo', {}, 8000);
      await sleep(500);

      const bottles = result?.rawData?.bottles || result?.bottles || [];
      let claimed = 0;

      for (const bottle of bottles) {
        try {
          await worker.sendMessageWithPromise('bottle_claim', { bottleId: bottle.id }, 8000);
          await sleep(500);
          claimed++;
          log(`领取灵罐 ${bottle.id} 成功`, 'success');
        } catch (e) {
          log(`领取灵罐 ${bottle.id} 失败: ${e.message}`, 'warning');
        }
      }

      log(`灵罐领取完成，共领取 ${claimed} 个`, 'success');
      return { success: true, claimed };
    } catch (error) {
      log(`灵罐领取失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = { createResetBottles, createBatchLingGuanZi };
