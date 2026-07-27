/**
 * 竞技场任务工厂
 * 从参考项目 tasksArena.js 移植
 */

const { getShanghaiISO, getShanghaiHourMin } = require('../../utils/time');

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
      // 时间限制：6:00-22:00
      const hm = getShanghaiHourMin();
      const hour = parseInt(hm.split(':')[0]);
      if (hour < 6 || hour >= 22) {
        log(`当前时间 ${hm} 不在竞技场开放时段(6:00-22:00)，跳过`, 'warning');
        return { success: false, message: '非竞技场时段' };
      }

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

      // 动态调整战斗次数：不超过门票数
      const fights = Math.min(fightCount, tickets);
      log(`将进行 ${fights} 场战斗`);

      // 切换阵容
      log(`切换到阵容 ${formation}...`);
      let originalFormation = null;
      try {
        // 先获取当前阵容，战斗后切回
        const teamInfo = await worker.sendMessageWithPromise('presetteam_getinfo', {}, 8000);
        originalFormation = teamInfo?.rawData?.presetTeamInfo?.useTeamId || teamInfo?.presetTeamInfo?.useTeamId;
        await sleep(300);
        if (originalFormation && originalFormation !== formation) {
          await worker.sendMessageWithPromise('presetteam_saveteam', { teamId: formation }, 8000);
          await sleep(500);
        }
      } catch (e) {
        log(`切换阵容失败: ${e.message}`, 'warning');
      }

      // 开始竞技场
      log('开始竞技场...');
      await worker.sendMessageWithPromise('arena_startarea', {}, 8000);
      await sleep(500);

      let winCount = 0;
      let loseCount = 0;

      for (let i = 1; i <= fights; i++) {
        log(`竞技场战斗 ${i}/${fights}...`);
        try {
          const targets = await worker.sendMessageWithPromise('arena_getareatarget', {}, 8000);
          await sleep(500);

          const targetId = pickArenaTargetId(targets);
          if (!targetId) {
            log(`战斗 ${i}: 未找到对手`, 'warning');
            break;
          }

          const fightResult = await worker.sendMessageWithPromise('fight_startareaarena', { targetId }, 10000);
          await sleep(1000);

          // 检查战斗结果
          const winList = fightResult?.rawData?.winList || fightResult?.winList || [];
          if (winList[0] === true || winList[0] === 1) {
            winCount++;
            log(`竞技场战斗 ${i} 胜利`, 'success');
          } else {
            loseCount++;
            log(`竞技场战斗 ${i} 失败`, 'warning');
          }
        } catch (e) {
          log(`竞技场战斗 ${i} 失败: ${e.message}`, 'error');
          loseCount++;
          break;
        }
      }

      // 切回原阵容
      if (originalFormation && originalFormation !== formation) {
        try {
          await worker.sendMessageWithPromise('presetteam_saveteam', { teamId: originalFormation }, 8000);
          log('已切回原阵容', 'info');
        } catch (e) {
          log(`切回原阵容失败: ${e.message}`, 'warning');
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

module.exports = {
  createBatchArenaFight,
};
