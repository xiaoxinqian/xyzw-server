/**
 * 爬塔任务工厂
 * 从参考项目 tasksTower.js 移植
 */

const { getShanghaiISO } = require('../../utils/time');
const { getTowerActId } = require('./utils/towerActId');
const { DEFAULT_WEIRD_TOWER_MAX_CLIMB, normalizeWeirdTowerMaxClimb } = require('./utils/towerClimbLimit');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 爬普通塔
 */
function createClimbTower(deps) {
  return async function climbTower() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const formation = config.formation || 1;

    log('开始爬塔...');
    try {
      // 切换阵容
      log(`切换到阵容 ${formation}...`);
      try {
        await worker.sendMessageWithPromise('presetteam_saveteam', { teamId: formation }, 8000);
        await sleep(500);
      } catch (e) {
        log(`切换阵容失败: ${e.message}`, 'warning');
      }

      const actId = getTowerActId();
      log(`塔活动ID: ${actId}`);

      let floor = 1;
      let maxFloor = 0;
      let successCount = 0;
      let failCount = 0;

      while (true) {
        log(`爬塔 第 ${floor} 层...`);
        try {
          const result = await worker.sendMessageWithPromise('tower_climb', {
            actId,
            floor,
          }, 12000);
          await sleep(500);

          if (result?.rawData?.result === false || result?.result === false) {
            log(`第 ${floor} 层失败，停止爬塔`, 'warning');
            failCount++;
            break;
          }

          successCount++;
          maxFloor = floor;
          floor++;

          // 安全上限
          if (floor > 200) {
            log('达到200层安全上限，停止', 'warning');
            break;
          }
        } catch (e) {
          log(`第 ${floor} 层异常: ${e.message}`, 'warning');
          failCount++;
          break;
        }
      }

      log(`爬塔完成: 最高 ${maxFloor} 层, 成功 ${successCount}, 失败 ${failCount}`, 'success');
      return { success: true, maxFloor, successCount, failCount };
    } catch (error) {
      log(`爬塔失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 爬奇峰塔
 */
function createClimbWeirdTower(deps) {
  return async function climbWeirdTower() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const formation = config.formation || 1;
    const maxClimb = normalizeWeirdTowerMaxClimb(config.maxClimb);

    log('开始爬奇峰塔...');
    try {
      // 切换阵容
      log(`切换到阵容 ${formation}...`);
      try {
        await worker.sendMessageWithPromise('presetteam_saveteam', { teamId: formation }, 8000);
        await sleep(500);
      } catch (e) {
        log(`切换阵容失败: ${e.message}`, 'warning');
      }

      let floor = 1;
      let successCount = 0;
      let failCount = 0;

      while (floor <= maxClimb) {
        log(`奇峰塔 第 ${floor} 层...`);
        try {
          const result = await worker.sendMessageWithPromise('weirdtower_climb', {
            floor,
          }, 12000);
          await sleep(500);

          if (result?.rawData?.result === false || result?.result === false) {
            log(`第 ${floor} 层失败，停止`, 'warning');
            failCount++;
            break;
          }

          successCount++;
          floor++;
        } catch (e) {
          log(`第 ${floor} 层异常: ${e.message}`, 'warning');
          failCount++;
          break;
        }
      }

      log(`奇峰塔完成: 最高 ${successCount} 层, 失败 ${failCount}`, 'success');
      return { success: true, maxFloor: successCount, successCount, failCount };
    } catch (error) {
      log(`奇峰塔失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 领取免费体力
 */
function createBatchClaimFreeEnergy(deps) {
  return async function batchClaimFreeEnergy() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始领取免费体力...');
    try {
      // 领取体力（可能多次）
      const attempts = [
        { cmd: 'tower_claimfreeenergy', params: {} },
        { cmd: 'system_claimfreeenergy', params: {} },
        { cmd: 'activity_claimenergy', params: {} },
      ];

      let claimed = 0;
      for (const attempt of attempts) {
        try {
          await worker.sendMessageWithPromise(attempt.cmd, attempt.params, 8000);
          await sleep(500);
          claimed++;
          log(`领取体力成功 (${attempt.cmd})`, 'success');
        } catch (e) {
          // 静默跳过不存在的接口
        }
      }

      log(`免费体力领取完成，共 ${claimed} 次`, 'success');
      return { success: true, claimed };
    } catch (error) {
      log(`领取免费体力失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = {
  createClimbTower,
  createClimbWeirdTower,
  createBatchClaimFreeEnergy,
};
