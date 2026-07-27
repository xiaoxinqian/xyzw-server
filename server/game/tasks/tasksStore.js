/**
 * 商店任务工厂
 * 从参考项目 tasksStore.js 移植
 */

const { getShanghaiISO } = require('../../utils/time');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 黑市物品ID → 名称映射（来源：原项目 ClubCarKing.vue / CarTaskCard.vue itemMapping）
const BLACK_MARKET_ITEM_NAMES = {
  1001: '招募令', 1003: '进阶石', 1006: '精铁', 1007: '竞技场门票',
  1008: '木柴火把', 1009: '青铜火把', 1010: '咸神火把',
  1011: '普通鱼竿', 1012: '黄金鱼竿', 1013: '珍珠', 1014: '军团币',
  1016: '晶石', 1017: '复活丹', 1019: '盐靛', 1020: '皮肤币',
  1021: '扫荡魔毯', 1022: '白玉', 1023: '彩玉', 1026: '扳手',
  1033: '贝壳', 1035: '金盐靛',
  10002: '蓝玉', 10003: '红玉', 10101: '四圣碎片',
  2001: '木制宝箱', 2002: '青铜宝箱', 2003: '黄金宝箱',
  2004: '铂金宝箱', 2005: '钻石宝箱', 2101: '助威币',
  3001: '金币袋子', 3002: '金砖袋子',
  3005: '紫色随机碎片', 3006: '橙色随机碎片', 3007: '红色随机碎片',
  3008: '精铁袋子', 3009: '进阶袋子', 3010: '梦魇袋子',
  3011: '白玉袋子', 3012: '扳手袋子',
  3020: '聚宝盆', 3021: '豪华聚宝盆',
  3201: '红色万能碎片', 3302: '橙色万能碎片',
  35002: '刷新券', 35009: '零件',
};

function getItemName(itemId) {
  return BLACK_MARKET_ITEM_NAMES[itemId] || `未知物品(${itemId})`;
}

/**
 * 军团商店购买（四圣碎片）
 * 参考项目直接调用 legion_storebuygoods { id: 6 }
 */
function createLegionStoreBuyGoods(deps) {
  return async function legion_storebuygoods() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const goodsId = config.goodsId || 6; // 默认买四圣碎片

    log('开始军团商店购买...');
    try {
      const result = await worker.sendMessageWithPromise('legion_storebuygoods', { id: goodsId }, 8000);
      await sleep(500);
      log('军团商店购买成功', 'success');
      return { success: true, result };
    } catch (error) {
      if (error.message?.includes('超出上限')) {
        log('本周已购买过，跳过', 'info');
        return { success: true, message: '已购买过' };
      }
      if (error.message?.includes('物品不存在')) {
        log('盐锭不足或未加入军团', 'error');
        throw error;
      }
      log(`军团商店购买失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 皮肤币商店购买
 * 参考项目：买 id:1 循环5次（不是 id:5 一次）
 */
function createLegionStoreBuySkinCoins(deps) {
  return async function legionStoreBuySkinCoins() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const goodsId = config.goodsId || 1; // 皮肤币商品ID=1
    const buyCount = config.buyCount || 5;

    log(`开始皮肤币商店购买: id=${goodsId} x${buyCount}...`);
    try {
      let bought = 0;
      for (let i = 0; i < buyCount; i++) {
        try {
          await worker.sendMessageWithPromise('legion_storebuygoods', { id: goodsId }, 8000);
          await sleep(500);
          bought++;
          log(`购买第 ${i + 1}/${buyCount} 次成功`, 'success');
        } catch (e) {
          log(`购买第 ${i + 1} 次失败: ${e.message}`, 'warning');
          break;
        }
      }
      log(`皮肤币商店购买完成: 成功 ${bought}/${buyCount}`, 'success');
      return { success: true, bought, total: buyCount };
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
        const itemName = getItemName(goodsId);
        try {
          log(`购买 ${itemName}(ID:${goodsId})...`);
          await worker.sendMessageWithPromise('store_purchase', { goodsId, num: 1 }, 8000);
          await sleep(500);
          bought++;
          log(`${itemName} 购买成功`, 'success');
        } catch (e) {
          log(`${itemName} 购买失败: ${e.message}`, 'warning');
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
      const result = await worker.sendMessageWithPromise('collection_claimfreereward', {}, 8000);
      await sleep(500);
      const errMsg = result?.rawData?.error || result?.error;
      if (errMsg) {
        log(`领取收藏免费奖励失败: ${errMsg}`, 'error');
        return { success: false, message: errMsg };
      }
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
