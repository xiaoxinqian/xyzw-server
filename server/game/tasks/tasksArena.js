/**
 * 竞技场任务工厂
 * 从参考项目 tasksArena.js 移植
 */

const { getShanghaiISO } = require('../../utils/time');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function pickArenaTargetId(targets) {
  if (!targets) return null;
  if (Array.isArray(targets)) {
    const candidate = targets[0];
    return candidate?.roleId || candidate?.id || candidate?.targetId;
  }
  const candidate =
    targets?.rankList?.[0] ||
    targets?.roleList?.[0] ||
    targets?.targets?.[0] ||
    targets?.targetList?.[0] ||
    targets?.list?.[0];
  if (candidate) {
    return candidate.roleId || candidate.id || candidate.targetId;
  }
  return targets?.roleId || targets?.id || targets?.targetId;
}

/**
 * 竞技场战斗
 */
function createBatchArenaFight(deps) {
  return async function batcharenafight() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const formation = config.formation || 1;
    const fightCount = config.fightCount || 3;

    log('开始竞技场战斗...');
    try {
      // 检查入场券
      const roleInfo = await worker.sendMessageWithPromise('role_getroleinfo', {}, 10000);
      await sleep(500);

      const items = roleInfo?.rawData?.role?.items || roleInfo?.role?.items || {};
      const tickets = items[1007] || 0;
      log(`当前竞技场门票: ${tickets}`);

      if (tickets <= 0) {
        log('竞技场门票不足，跳过', 'warning');
        return { success: false, message: '门票不足' };
      }

      // 切换阵容
      log(`切换到阵容 ${formation}...`);
      try {
        await worker.sendMessageWithPromise('presetteam_saveteam', { teamId: formation }, 8000);
        await sleep(500);
      } catch (e) {
        log(`切换阵容失败: ${e.message}`, 'warning');
      }

      // 开始竞技场
      log('开始竞技场...');
      await worker.sendMessageWithPromise('arena_startarea', {}, 8000);
      await sleep(500);

      let winCount = 0;
      let loseCount = 0;

      for (let i = 1; i <= fightCount; i++) {
        log(`竞技场战斗 ${i}/${fightCount}...`);
        try {
          const targets = await worker.sendMessageWithPromise('arena_getareatarget', {}, 8000);
          await sleep(500);

          const targetId = pickArenaTargetId(targets);
          if (!targetId) {
            log(`战斗 ${i}: 未找到对手`, 'warning');
            break;
          }

          await worker.sendMessageWithPromise('fight_startareaarena', { targetId }, 10000);
          await sleep(1000);

          winCount++;
          log(`竞技场战斗 ${i} 完成`, 'success');
        } catch (e) {
          log(`竞技场战斗 ${i} 失败: ${e.message}`, 'error');
          loseCount++;
          break;
        }
      }

      log(`竞技场完成: 胜利 ${winCount}, 失败 ${loseCount}`, 'success');
      return { success: true, winCount, loseCount };
    } catch (error) {
      log(`竞技场战斗失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 补充鱼饵
 */
function createBatchTopUpFish(deps) {
  return async function batchTopUpFish() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const count = config.count || 100;

    log('开始补充鱼饵...');
    try {
      for (let i = 0; i < count; i++) {
        try {
          await worker.sendMessageWithPromise('artifact_buybait', { num: 1 }, 8000);
          await sleep(500);
        } catch (e) {
          log(`补充鱼饵 ${i + 1} 失败: ${e.message}`, 'warning');
          break;
        }
      }
      log('鱼饵补充完成', 'success');
      return { success: true, count };
    } catch (error) {
      log(`补充鱼饵失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 补充竞技场次数
 */
function createBatchTopUpArena(deps) {
  return async function batchTopUpArena() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const count = config.count || 1;

    log('开始补充竞技场次数...');
    try {
      for (let i = 0; i < count; i++) {
        try {
          await worker.sendMessageWithPromise('arena_buycount', { num: 1 }, 8000);
          await sleep(500);
          log(`补充竞技场次数 ${i + 1} 成功`, 'success');
        } catch (e) {
          log(`补充竞技场次数 ${i + 1} 失败: ${e.message}`, 'warning');
          break;
        }
      }
      log('竞技场次数补充完成', 'success');
      return { success: true, count };
    } catch (error) {
      log(`补充竞技场次数失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = {
  createBatchArenaFight,
  createBatchTopUpFish,
  createBatchTopUpArena,
};
