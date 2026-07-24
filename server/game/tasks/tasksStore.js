/**
 * 商店任务工厂
 * 从参考项目 tasksStore.js 移植
 */

const { getShanghaiISO } = require('../../utils/time');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 军团商店购买
 */
function createLegionStoreBuyGoods(deps) {
  return async function legion_storebuygoods() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const goodsList = config.goodsList || [];

    log('开始军团商店购买...');
    try {
      // 获取商店信息
      const shopInfo = await worker.sendMessageWithPromise('legion_getshopinfo', {}, 8000);
      await sleep(500);

      let bought = 0;

      // 如果有指定商品列表，按列表买
      if (goodsList.length > 0) {
        for (const goods of goodsList) {
          try {
            log(`购买商品 ${goods.id || goods.goodsId}...`);
            await worker.sendMessageWithPromise('legion_buygoods', {
              goodsId: goods.id || goods.goodsId,
              num: goods.num || 1,
            }, 8000);
            await sleep(500);
            bought++;
            log(`购买成功`, 'success');
          } catch (e) {
            log(`购买失败: ${e.message}`, 'warning');
          }
        }
      } else {
        // 无指定列表，尝试购买可买的
        const items = shopInfo?.rawData?.goods || shopInfo?.goods || [];
        for (const item of items) {
          if (item.canBuy) {
            try {
              log(`购买商品 ${item.id || item.goodsId}...`);
              await worker.sendMessageWithPromise('legion_buygoods', {
                goodsId: item.id || item.goodsId,
                num: 1,
              }, 8000);
              await sleep(500);
              bought++;
              log(`购买成功`, 'success');
            } catch (e) {
              log(`购买失败: ${e.message}`, 'warning');
            }
          }
        }
      }

      log(`军团商店购买完成: 共 ${bought} 件`, 'success');
      return { success: true, bought };
    } catch (error) {
      log(`军团商店购买失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 皮肤币商店购买
 */
function createLegionStoreBuySkinCoins(deps) {
  return async function legionStoreBuySkinCoins() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const goodsList = config.goodsList || [];

    log('开始皮肤币商店购买...');
    try {
      let bought = 0;

      for (const goods of goodsList) {
        try {
          log(`购买皮肤币商品 ${goods.id || goods.goodsId}...`);
          await worker.sendMessageWithPromise('skincointore_buygoods', {
            goodsId: goods.id || goods.goodsId,
            num: goods.num || 1,
          }, 8000);
          await sleep(500);
          bought++;
          log(`购买成功`, 'success');
        } catch (e) {
          log(`购买失败: ${e.message}`, 'warning');
        }
      }

      log(`皮肤币商店购买完成: 共 ${bought} 件`, 'success');
      return { success: true, bought };
    } catch (error) {
      log(`皮肤币商店购买失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 黑市购买
 * config.purchaseList: 商品ID数组，如 [1,2,3]；为空则一键全买（发空params，和原项目一致）
 */
function createStorePurchase(deps) {
  return async function store_purchase() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const purchaseList = config.purchaseList || [];

    if (purchaseList.length > 0) {
      // 按清单逐个购买
      log(`开始黑市购买: ${purchaseList.length} 个商品...`);
      let bought = 0;
      for (const goodsId of purchaseList) {
        try {
          log(`购买商品 ${goodsId}...`);
          await worker.sendMessageWithPromise('store_purchase', { goodsId, num: 1 }, 8000);
          await sleep(500);
          bought++;
          log(`商品 ${goodsId} 购买成功`, 'success');
        } catch (e) {
          log(`商品 ${goodsId} 购买失败: ${e.message}`, 'warning');
        }
      }
      log(`黑市购买完成: 成功 ${bought}/${purchaseList.length}`, 'success');
      return { success: true, bought, total: purchaseList.length };
    } else {
      // 一键全买（原项目行为：发空params）
      log('开始黑市一键采购...');
      try {
        await worker.sendMessageWithPromise('store_purchase', {}, 8000);
        await sleep(500);
        log('黑市一键采购成功', 'success');
        return { success: true, message: '一键采购完成' };
      } catch (error) {
        log(`黑市采购失败: ${error.message}`, 'error');
        throw error;
      }
    }
  };
}

/**
 * 领取收藏免费奖励
 */
function createCollectionClaimFreeReward(deps) {
  return async function collection_claimfreereward() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始领取收藏免费奖励...');
    try {
      await worker.sendMessageWithPromise('collection_claimfreereward', {}, 8000);
      await sleep(500);
      log('收藏免费奖励领取成功', 'success');
      return { success: true, message: '收藏免费奖励领取完成' };
    } catch (error) {
      log(`领取收藏免费奖励失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = {
  createLegionStoreBuyGoods,
  createLegionStoreBuySkinCoins,
  createStorePurchase,
  createCollectionClaimFreeReward,
};
