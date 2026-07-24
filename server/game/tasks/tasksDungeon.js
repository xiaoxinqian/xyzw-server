/**
 * 副本/梦境任务工厂
 * 从参考项目 tasksDungeon.js 移植
 */

const { getShanghaiISO } = require('../../utils/time');
const { isDungeonOpen, merchantConfig, goldItemsConfig } = require('./utils/dreamConstants');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 宝库1-3层
 */
function createBatchBaoKu13(deps) {
  return async function batchbaoku13() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始宝库1-3层...');
    try {
      // 获取宝库信息
      const info = await worker.sendMessageWithPromise('bosstower_getinfo', {}, 8000);
      await sleep(500);

      let totalSuccess = 0;

      // 遍历塔 1-3
      for (let towerId = 1; towerId <= 3; towerId++) {
        log(`宝库塔 ${towerId}...`);

        // 检查是否可挑战
        const towerInfo = info?.rawData?.towers?.[towerId] || info?.towers?.[towerId];
        if (towerInfo && towerInfo.remainTimes <= 0) {
          log(`塔 ${towerId} 无剩余次数，跳过`, 'warning');
          continue;
        }

        // 开始BOSS战 x2
        for (let i = 0; i < 2; i++) {
          try {
            log(`塔 ${towerId} BOSS战 ${i + 1}/2...`);
            await worker.sendMessageWithPromise('bosstower_startboss', { towerId }, 12000);
            await sleep(500);
            totalSuccess++;
          } catch (e) {
            log(`塔 ${towerId} BOSS战 ${i + 1} 失败: ${e.message}`, 'warning');
            break;
          }
        }

        // 开宝箱 x9
        for (let i = 0; i < 9; i++) {
          try {
            log(`塔 ${towerId} 开箱 ${i + 1}/9...`);
            await worker.sendMessageWithPromise('bosstower_startbox', { towerId }, 8000);
            await sleep(500);
            totalSuccess++;
          } catch (e) {
            log(`塔 ${towerId} 开箱 ${i + 1} 失败: ${e.message}`, 'warning');
            break;
          }
        }
      }

      log(`宝库1-3完成: 共 ${totalSuccess} 次操作`, 'success');
      return { success: true, totalSuccess };
    } catch (error) {
      log(`宝库1-3失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 宝库4-5层
 */
function createBatchBaoKu45(deps) {
  return async function batchbaoku45() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始宝库4-5层...');
    try {
      const info = await worker.sendMessageWithPromise('bosstower_getinfo', {}, 8000);
      await sleep(500);

      let totalSuccess = 0;

      for (let towerId = 4; towerId <= 5; towerId++) {
        log(`宝库塔 ${towerId}...`);

        const towerInfo = info?.rawData?.towers?.[towerId] || info?.towers?.[towerId];
        if (towerInfo && towerInfo.remainTimes <= 0) {
          log(`塔 ${towerId} 无剩余次数，跳过`, 'warning');
          continue;
        }

        for (let i = 0; i < 2; i++) {
          try {
            log(`塔 ${towerId} BOSS战 ${i + 1}/2...`);
            await worker.sendMessageWithPromise('bosstower_startboss', { towerId }, 12000);
            await sleep(500);
            totalSuccess++;
          } catch (e) {
            log(`塔 ${towerId} BOSS战 ${i + 1} 失败: ${e.message}`, 'warning');
            break;
          }
        }

        for (let i = 0; i < 9; i++) {
          try {
            log(`塔 ${towerId} 开箱 ${i + 1}/9...`);
            await worker.sendMessageWithPromise('bosstower_startbox', { towerId }, 8000);
            await sleep(500);
            totalSuccess++;
          } catch (e) {
            break;
          }
        }
      }

      log(`宝库4-5完成: 共 ${totalSuccess} 次操作`, 'success');
      return { success: true, totalSuccess };
    } catch (error) {
      log(`宝库4-5失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 咸王梦境
 */
function createBatchMengJing(deps) {
  return async function batchmengjing() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const heroId = config.heroId || 107;

    // 检查梦境是否开放
    if (!isDungeonOpen()) {
      log('今日梦境未开放，跳过', 'warning');
      return { success: false, message: '梦境未开放' };
    }

    log('开始咸王梦境...');
    try {
      await worker.sendMessageWithPromise('dungeon_selecthero', { battleTeam: { 0: heroId } }, 10000);
      await sleep(500);
      log('咸王梦境完成', 'success');
      return { success: true, message: '咸王梦境完成' };
    } catch (error) {
      log(`咸王梦境失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 梦境购物
 * config.purchaseList: 购买清单，格式 ["merchantId-itemIndex", ...]，如 ["1-5","1-6","2-6","2-7","3-5","3-6","3-7"]
 *   对应 dreamConstants.js 中 goldItemsConfig 的默认金币商品
 * 为空则使用默认 goldItemsConfig 全部购买
 */
function createBatchBuyDreamItems(deps) {
  return async function batchBuyDreamItems() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    if (!isDungeonOpen()) {
      log('今日梦境未开放，跳过', 'warning');
      return { success: false, message: '梦境未开放' };
    }

    log('开始梦境购物...');
    try {
      // 获取角色信息以获得梦境商店数据（和原项目一致）
      const roleInfoResp = await worker.sendMessageWithPromise('role_getroleinfo', {}, 15000);
      const roleData = roleInfoResp?.rawData?.role || roleInfoResp?.role;
      const merchantData = roleData?.dungeon?.merchant;
      const levelId = roleData?.levelId || 0;

      if (!merchantData) {
        throw new Error('无法获取梦境商店数据');
      }

      // 确定购买清单
      let operations = [];
      const purchaseList = config.purchaseList || [];

      if (purchaseList.length > 0) {
        // 用户配置的清单
        for (const itemKey of purchaseList) {
          const [targetMerchantId, targetItemIndex] = String(itemKey).split('-').map(Number);
          const merchantItems = merchantData[targetMerchantId];
          if (merchantItems) {
            for (let pos = 0; pos < merchantItems.length; pos++) {
              if (merchantItems[pos] === targetItemIndex) {
                operations.push({ merchantId: targetMerchantId, index: targetItemIndex, pos });
              }
            }
          }
        }
      } else {
        // 默认：按 goldItemsConfig 购买
        for (const merchant of Object.values(merchantConfig)) {
          const goldItemIndices = goldItemsConfig[merchant.id] || [];
          const merchantItems = merchantData[merchant.id];
          if (merchantItems) {
            for (const idx of goldItemIndices) {
              for (let pos = 0; pos < merchantItems.length; pos++) {
                if (merchantItems[pos] === idx) {
                  operations.push({ merchantId: merchant.id, index: idx, pos });
                }
              }
            }
          }
        }
      }

      // 按商人ID排序，同商人内按pos倒序（和原项目一致，避免位置偏移）
      operations.sort((a, b) => {
        if (a.merchantId !== b.merchantId) return a.merchantId - b.merchantId;
        return b.pos - a.pos;
      });

      if (levelId < 4000) {
        log('关卡数小于4000，无法购买梦境商品', 'warning');
        return { success: false, message: '关卡数不足' };
      }

      let bought = 0;
      let failed = 0;

      for (const op of operations) {
        try {
          const merchantName = merchantConfig[op.merchantId]?.name || `商人${op.merchantId}`;
          const itemName = merchantConfig[op.merchantId]?.items?.[op.index] || `商品${op.index}`;
          log(`购买: ${merchantName} - ${itemName}...`);
          const resp = await worker.sendMessageWithPromise('dungeon_buymerchant', {
            id: op.merchantId,
            index: op.index,
            pos: op.pos,
          }, 5000);
          await sleep(500);
          if (resp?.reward) {
            bought++;
            log(`购买成功: ${merchantName} - ${itemName}`, 'success');
          } else {
            failed++;
            log(`购买未获得奖励: ${merchantName} - ${itemName}`, 'warning');
          }
        } catch (e) {
          failed++;
          log(`购买失败: ${e.message}`, 'warning');
        }
      }

      log(`梦境购物完成: 成功${bought}, 失败${failed}`, 'success');
      return { success: true, bought, failed };
    } catch (error) {
      log(`梦境购物失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = {
  createBatchBaoKu13,
  createBatchBaoKu45,
  createBatchMengJing,
  createBatchBuyDreamItems,
};
