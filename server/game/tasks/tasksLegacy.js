/**
 * 珍宝阁任务工厂
 * 从参考项目 tasksLegacy.js 移植
 */

const { getShanghaiISO } = require('../../utils/time');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 珍宝阁批量领取
 */
function createBatchLegacyClaim(deps) {
  return async function batchLegacyClaim() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始珍宝阁领取...');
    try {
      // 获取珍宝阁商品列表
      const goodsList = await worker.sendMessageWithPromise('collection_goodslist', {}, 8000);
      await sleep(500);

      const goods = goodsList?.rawData?.goods || goodsList?.goods || goodsList?.rawData?.list || [];
      let claimed = 0;

      for (const item of goods) {
        if (item.canClaim || item.freeClaim || item.isFree) {
          try {
            log(`领取珍宝阁 ${item.id || item.goodsId}...`);
            await worker.sendMessageWithPromise('collection_claimgoods', {
              goodsId: item.id || item.goodsId,
            }, 8000);
            await sleep(500);
            claimed++;
            log(`领取成功`, 'success');
          } catch (e) {
            log(`领取失败: ${e.message}`, 'warning');
          }
        }
      }

      // 额外尝试领取免费奖励
      try {
        await worker.sendMessageWithPromise('collection_claimfreereward', {}, 8000);
        await sleep(500);
        log('珍宝阁免费奖励领取成功', 'success');
      } catch (e) {
        // 静默跳过
      }

      log(`珍宝阁领取完成: 共 ${claimed} 件`, 'success');
      return { success: true, claimed };
    } catch (error) {
      log(`珍宝阁领取失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 珍宝阁增强赠礼
 */
function createBatchLegacyGiftSendEnhanced(deps) {
  return async function batchLegacyGiftSendEnhanced() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始珍宝阁赠礼...');
    try {
      // 获取好友列表
      const friendList = await worker.sendMessageWithPromise('friend_getlist', {}, 8000);
      await sleep(500);

      const friends = friendList?.rawData?.friends || friendList?.friends || [];
      let sent = 0;

      for (const friend of friends) {
        try {
          log(`向 ${friend.name || friend.id} 赠礼...`);
          await worker.sendMessageWithPromise('collection_giftsend', {
            targetId: friend.id || friend.roleId,
          }, 8000);
          await sleep(500);
          sent++;
          log(`赠礼成功`, 'success');
        } catch (e) {
          log(`赠礼失败: ${e.message}`, 'warning');
        }
      }

      log(`珍宝阁赠礼完成: 共 ${sent} 次`, 'success');
      return { success: true, sent };
    } catch (error) {
      log(`珍宝阁赠礼失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = {
  createBatchLegacyClaim,
  createBatchLegacyGiftSendEnhanced,
};
