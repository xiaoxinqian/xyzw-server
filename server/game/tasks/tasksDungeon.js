/**
 * 副本/梦境任务工厂
 * 从参考项目 tasksDungeon.js 移植
 * 宝库：从 bosstower_getinfo 读 towerId，判断当前塔层再打，不传 towerId
 */

const { getShanghaiISO, getShanghaiDayOfWeek } = require('../../utils/time');
const { isDungeonOpen, merchantConfig, goldItemsConfig } = require('./utils/dreamConstants');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 宝库1-3层
 * 原项目：bosstower_getinfo → 读 bossTower.towerId → 仅当 towerId >=1 && <=3 时打
 *   bosstower_startboss {} x2 + bosstower_startbox {} x9
 *   不传 towerId 参数！
 */
function createBatchBaoKu13(deps) {
  return async function batchbaoku13() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始宝库1-3层...');
    try {
      const info = await worker.sendMessageWithPromise('bosstower_getinfo', {}, 8000);
      await sleep(500);

      const bossTower = info?.rawData?.bossTower ?? info?.bossTower ?? {};
      const towerId = bossTower.towerId;

      log(`当前宝库塔层: ${towerId}`);

      if (towerId < 1 || towerId > 3) {
        log(`当前塔层 ${towerId} 不在1-3范围，跳过`, 'warning');
        return { success: true, message: '当前不在1-3层' };
      }

      let totalSuccess = 0;

      // BOSS战 x2（不传 towerId）
      for (let i = 0; i < 2; i++) {
        try {
          log(`BOSS战 ${i + 1}/2...`);
          await worker.sendMessageWithPromise('bosstower_startboss', {}, 12000);
          await sleep(500);
          totalSuccess++;
        } catch (e) {
          log(`BOSS战 ${i + 1} 失败: ${e.message}`, 'warning');
          break;
        }
      }

      // 开宝箱 x9（不传 towerId）
      for (let i = 0; i < 9; i++) {
        try {
          log(`开箱 ${i + 1}/9...`);
          await worker.sendMessageWithPromise('bosstower_startbox', {}, 8000);
          await sleep(500);
          totalSuccess++;
        } catch (e) {
          log(`开箱 ${i + 1} 失败: ${e.message}`, 'warning');
          break;
        }
      }

      log(`宝库1-3完成: 共 ${totalSuccess} 次操作，请上线手动领取奖励`, 'success');
      return { success: true, totalSuccess };
    } catch (error) {
      log(`宝库1-3失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 宝库4-5层
 * 同上，仅当 towerId >=4 && <=5 时打 BOSS，不打宝箱
 */
function createBatchBaoKu45(deps) {
  return async function batchbaoku45() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始宝库4-5层...');
    try {
      const info = await worker.sendMessageWithPromise('bosstower_getinfo', {}, 8000);
      await sleep(500);

      const bossTower = info?.rawData?.bossTower ?? info?.bossTower ?? {};
      const towerId = bossTower.towerId;

      log(`当前宝库塔层: ${towerId}`);

      if (towerId < 4 || towerId > 5) {
        log(`当前塔层 ${towerId} 不在4-5范围，跳过`, 'warning');
        return { success: true, message: '当前不在4-5层' };
      }

      let totalSuccess = 0;

      // BOSS战 x2（不传 towerId）
      for (let i = 0; i < 2; i++) {
        try {
          log(`BOSS战 ${i + 1}/2...`);
          await worker.sendMessageWithPromise('bosstower_startboss', {}, 12000);
          await sleep(500);
          totalSuccess++;
        } catch (e) {
          log(`BOSS战 ${i + 1} 失败: ${e.message}`, 'warning');
          break;
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
 * 原项目：周日/一/三/四开放，dungeon_selecthero { battleTeam: { 0: 107 } }
 */
function createBatchMengJing(deps) {
  return async function batchmengjing() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const heroId = config.heroId || 107;

    // 检查梦境是否开放（周日=0, 周一=1, 周三=3, 周四=4）— 使用上海时间
    const dayOfWeek = getShanghaiDayOfWeek();
    const openDays = [0, 1, 3, 4];
    if (!openDays.includes(dayOfWeek)) {
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
 * config.purchaseList: 购买清单，格式 ["merchantId-itemIndex", ...]
 */
function createBatchBuyDreamItems(deps) {
  return async function batchBuyDreamItems() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    const dayOfWeek = getShanghaiDayOfWeek();
    const openDays = [0, 1, 3, 4];
    if (!openDays.includes(dayOfWeek)) {
      log('今日梦境未开放，跳过', 'warning');
      return { success: false, message: '梦境未开放' };
    }

    log('开始梦境购物...');
    try {
      const roleInfoResp = await worker.sendMessageWithPromise('role_getroleinfo', {}, 15000);
      const roleData = roleInfoResp?.rawData?.role || roleInfoResp?.role;
      const merchantData = roleData?.dungeon?.merchant;
      const levelId = roleData?.levelId || 0;

      if (!merchantData) {
        throw new Error('无法获取梦境商店数据');
      }

      let operations = [];
      const purchaseList = config.purchaseList || [];

      if (purchaseList.length > 0) {
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
        // 默认：按 goldItemsConfig 购买（用 entries 保留 merchantId）
        for (const [merchantIdStr, merchant] of Object.entries(merchantConfig)) {
          const merchantId = Number(merchantIdStr);
          const goldItemIndices = goldItemsConfig[merchantId] || [];
          const merchantItems = merchantData[merchantId];
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
          if (resp?.reward || resp?.rawData?.reward) {
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
