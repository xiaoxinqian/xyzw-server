/**
 * 俱乐部任务工厂
 * 包含：俱乐部签到
 */

const { getShanghaiISO } = require('../../utils/time');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 一键俱乐部签到
 * 调用 legion_signin 协议
 * 记录签到结果日志
 */
function createBatchClubSign(deps) {
  return async function batchclubsign() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始俱乐部签到...');
    try {
      await worker.sendMessageWithPromise('legion_signin', {}, 5000);
      await sleep(500);
      log('俱乐部签到成功', 'success');
      return { success: true, message: '签到成功' };
    } catch (error) {
      log(`俱乐部签到失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = {
  createBatchClubSign,
};