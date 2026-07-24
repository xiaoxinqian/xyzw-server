/**
 * 道具任务工厂
 * 从参考项目 tasksItem.js 移植
 */

const { getShanghaiISO } = require('../../utils/time');
const { HERO_DICT } = require('./utils/HeroList');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 批量开箱
 */
function createBatchOpenBox(deps) {
  return async function batchOpenBox() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const boxType = config.boxType || 2001;
    const number = config.number || 100;

    log(`开始开箱: 类型${boxType} ${number}个...`);
    try {
      await worker.sendMessageWithPromise('item_openbox', { itemId: boxType, number }, 8000);
      await sleep(500);
      log(`开箱完成: ${boxType} x${number}`, 'success');
      return { success: true, boxType, number };
    } catch (error) {
      log(`开箱失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 领取箱积奖励
 */
function createBatchClaimBoxPointReward(deps) {
  return async function batchClaimBoxPointReward() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始领取箱积奖励...');
    try {
      await worker.sendMessageWithPromise('item_claimboxpointreward', {}, 8000);
      await sleep(500);
      log('箱积奖励领取成功', 'success');
      return { success: true, message: '箱积奖励领取完成' };
    } catch (error) {
      log(`领取箱积奖励失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 批量钓鱼
 */
function createBatchFish(deps) {
  return async function batchFish() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const fishType = config.fishType || 1;
    const count = config.count || 100;

    log(`开始钓鱼: 类型${fishType} ${count}次...`);
    try {
      for (let i = 0; i < count; i++) {
        log(`钓鱼 ${i + 1}/${count}...`);
        try {
          await worker.sendMessageWithPromise('artifact_lottery', {
            lotteryNumber: 1,
            newFree: true,
            type: fishType,
          }, 8000);
          await sleep(500);
          log(`钓鱼 ${i + 1} 成功`, 'success');
        } catch (e) {
          log(`钓鱼 ${i + 1} 失败: ${e.message}`, 'warning');
          break;
        }
      }
      log('钓鱼完成', 'success');
      return { success: true, count };
    } catch (error) {
      log(`钓鱼失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 批量招募（免费+付费）
 */
function createBatchRecruit(deps) {
  return async function batchRecruit() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const payRecruit = config.payRecruit !== false; // 默认true

    log('开始招募...');
    try {
      // 免费招募
      log('免费招募...');
      try {
        await worker.sendMessageWithPromise('hero_recruit', { recruitType: 3, recruitNumber: 1 }, 8000);
        await sleep(500);
        log('免费招募成功', 'success');
      } catch (e) {
        log(`免费招募失败: ${e.message}`, 'warning');
      }

      // 付费招募
      if (payRecruit) {
        log('付费招募...');
        try {
          await worker.sendMessageWithPromise('hero_recruit', { recruitType: 1, recruitNumber: 1 }, 8000);
          await sleep(500);
          log('付费招募成功', 'success');
        } catch (e) {
          log(`付费招募失败: ${e.message}`, 'warning');
        }
      }

      log('招募完成', 'success');
      return { success: true, message: '招募完成' };
    } catch (error) {
      log(`招募失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 批量英雄升星
 * 遍历 HERO_DICT，每个英雄尝试升星最多10次
 */
function createBatchHeroUpgrade(deps) {
  return async function batchHeroUpgrade() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const maxStarPerHero = config.maxStarPerHero || 10;
    const heroIds = config.heroIds || Object.keys(HERO_DICT).map(Number);

    log(`开始英雄升星: ${heroIds.length} 个英雄, 每个最多 ${maxStarPerHero} 次...`);
    try {
      let totalUpgrades = 0;
      let totalFails = 0;

      for (const heroId of heroIds) {
        const heroInfo = HERO_DICT[heroId];
        const heroName = heroInfo?.name || heroId;
        let upgraded = 0;

        for (let i = 0; i < maxStarPerHero; i++) {
          try {
            const result = await worker.sendMessageWithPromise('hero_heroupgradestar', { heroId }, 8000);
            await sleep(300);

            if (result?.rawData?.result === false || result?.result === false) {
              break;
            }

            upgraded++;
            totalUpgrades++;
          } catch (e) {
            // 升星失败（材料不足/已达上限）
            break;
          }
        }

        if (upgraded > 0) {
          log(`${heroName}: 升星 ${upgraded} 次`, 'success');
        }
        totalFails += (maxStarPerHero - upgraded);
      }

      log(`英雄升星完成: 总成功 ${totalUpgrades} 次`, 'success');
      return { success: true, totalUpgrades, totalFails };
    } catch (error) {
      log(`英雄升星失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = {
  createBatchOpenBox,
  createBatchClaimBoxPointReward,
  createBatchFish,
  createBatchRecruit,
  createBatchHeroUpgrade,
};
