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
      // 分批开箱，每批10个，避免"操作过快"
      const batchSize = config.batchSize || 10;
      let opened = 0;
      while (opened < number) {
        const batch = Math.min(batchSize, number - opened);
        await worker.sendMessageWithPromise('item_openbox', { itemId: boxType, number: batch }, 8000);
        await sleep(1500);
        opened += batch;
        if (opened < number) log(`已开 ${opened}/${number}...`);
      }
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
      await worker.sendMessageWithPromise('item_batchclaimboxpointreward', {}, 8000);
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
      // 先检查鱼竿库存
      const roleResp = await worker.sendMessageWithPromise('role_getroleinfo', {}, 10000);
      const items = roleResp?.rawData?.role?.items || roleResp?.role?.items || {};
      const rodCount = (items[1011]?.quantity || 0) + (items[1012]?.quantity || 0);
      const availableCount = Math.min(count, rodCount);
      log(`鱼竿库存: ${rodCount}, 将钓鱼 ${availableCount} 次`);

      if (availableCount <= 0) {
        log('鱼竿不足，跳过', 'warning');
        return { success: false, message: '鱼竿不足' };
      }

      // 批量钓鱼，每批10条
      const batchSize = 10;
      const batches = Math.floor(availableCount / batchSize);
      const remainder = availableCount % batchSize;
      let done = 0;

      for (let i = 0; i < batches; i++) {
        try {
          await worker.sendMessageWithPromise('artifact_lottery', {
            lotteryNumber: batchSize,
            newFree: true,
            type: fishType,
          }, 8000);
          done += batchSize;
          log(`钓鱼 ${done}/${availableCount}...`);
          await sleep(500);
          // 每5批重新校验库存
          if ((i + 1) % 5 === 0) {
            try {
              const r = await worker.sendMessageWithPromise('role_getroleinfo', {}, 5000);
              const it = r?.rawData?.role?.items || r?.role?.items || {};
              const left = (it[1011]?.quantity || 0) + (it[1012]?.quantity || 0);
              if (left <= 0) { log('鱼竿已用完，停止', 'warning'); break; }
            } catch (_) {}
          }
        } catch (e) {
          log(`钓鱼批次 ${i + 1} 失败: ${e.message}`, 'warning');
          break;
        }
      }
      if (remainder > 0 && done < availableCount) {
        try {
          await worker.sendMessageWithPromise('artifact_lottery', {
            lotteryNumber: remainder,
            newFree: true,
            type: fishType,
          }, 8000);
          done += remainder;
        } catch (e) {
          log(`钓鱼尾批失败: ${e.message}`, 'warning');
        }
      }
      log(`钓鱼完成: ${done}/${availableCount}`, 'success');
      return { success: true, count: done };
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

      // 付费招募（批量10个）
      if (payRecruit) {
        const recruitCount = config.recruitCount || 10;
        const recruitBatch = 10;
        const rBatches = Math.floor(recruitCount / recruitBatch);
        const rRemainder = recruitCount % recruitBatch;
        log(`付费招募 ${recruitCount} 个...`);
        for (let i = 0; i < rBatches; i++) {
          try {
            await worker.sendMessageWithPromise('hero_recruit', { recruitType: 1, recruitNumber: recruitBatch }, 8000);
            await sleep(500);
            log(`付费招募 ${(i + 1) * recruitBatch}/${recruitCount}`, 'success');
          } catch (e) {
            log(`付费招募批次 ${i + 1} 失败: ${e.message}`, 'warning');
            break;
          }
        }
        if (rRemainder > 0) {
          try {
            await worker.sendMessageWithPromise('hero_recruit', { recruitType: 1, recruitNumber: rRemainder }, 8000);
            await sleep(500);
          } catch (e) {
            log(`付费招募尾批失败: ${e.message}`, 'warning');
          }
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

            const ok = result && (
              result?.rawData?.code === 0 || result?.code === 0 ||
              result?.rawData?.success === true || result?.success === true ||
              result?.rawData?.result === 0 || result?.result === 0
            );
            if (!ok) break;

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
