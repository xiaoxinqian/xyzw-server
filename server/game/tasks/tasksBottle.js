/**
 * 瓶子/盐罐任务工厂
 * 合并版：一个任务完成 领取+重置，通过 config.mode 控制
 * mode: "claim_and_reset" (默认) | "claim_only" | "reset_only"
 */

const { getShanghaiISO } = require('../../utils/time');
const logger = require('../../utils/logger');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 统一罐子管理任务
 * 流程：
 *   claim_and_reset: 停止 → 领取盐罐奖励 → 领取灵罐 → 重新开始计时
 *   claim_only: 领取盐罐奖励 → 领取灵罐
 *   reset_only: 停止 → 重新开始计时
 */
function createResetBottles(deps) {
  return async function resetBottles() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const mode = config.mode || 'claim_and_reset';

    log(`开始罐子管理 (模式: ${mode === 'claim_and_reset' ? '领取+重置' : mode === 'claim_only' ? '仅领取' : '仅重置'})...`);

    try {
      // === 重置部分 ===
      if (mode === 'claim_and_reset' || mode === 'reset_only') {
        // 停止盐罐计时
        log('停止盐罐计时...');
        try {
          await worker.sendMessageWithPromise('bottlehelper_stop', {}, 8000);
          await sleep(500);
          log('盐罐已停止', 'success');
        } catch (e) {
          log(`停止盐罐失败: ${e.message}`, 'warning');
        }
      }

      // === 领取部分 ===
      if (mode === 'claim_and_reset' || mode === 'claim_only') {
        // 领取盐罐奖励
        log('领取盐罐奖励...');
        try {
          const claimResp = await worker.sendMessageWithPromise('bottlehelper_claim', {}, 8000);
          await sleep(500);
          const reward = claimResp?.rawData || claimResp;
          log(`盐罐奖励领取成功: ${JSON.stringify(reward)}`, 'success');
        } catch (e) {
          log(`领取盐罐奖励失败（可能无奖励可领）: ${e.message}`, 'warning');
        }

        // 灵罐领取已移除（bottle_getinfo/bottle_claim 指令已失效）
      }

      // === 重置后半段 ===
      if (mode === 'claim_and_reset' || mode === 'reset_only') {
        // 重新开始盐罐计时
        log('重新开始盐罐计时...');
        try {
          const startResp = await worker.sendMessageWithPromise('bottlehelper_start', {}, 8000);
          await sleep(500);
          log('盐罐计时已重新开始', 'success');
        } catch (e) {
          log(`重新开始盐罐失败: ${e.message}`, 'error');
          throw e;
        }
      }

      log('罐子管理完成', 'success');
      return { success: true, message: `罐子管理完成 (${mode})` };
    } catch (error) {
      log(`罐子管理失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = { createResetBottles };
