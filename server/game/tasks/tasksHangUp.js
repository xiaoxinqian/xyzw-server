/**
 * 挂机任务工厂
 * 从参考项目 tasksHangUp.js 移植
 */

const { getShanghaiISO } = require('../../utils/time');
const logger = require('../../utils/logger');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 领取挂机奖励 + 加钟4次
 */
function createClaimHangUpRewards(deps) {
  return async function claimHangUpRewards() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始领取挂机奖励...');
    try {
      // 领取挂机奖励
      log('领取挂机奖励...');
      await worker.sendMessageWithPromise('system_claimhangupreward', {}, 8000);
      await sleep(500);
      log('挂机奖励领取成功', 'success');

      // 加钟4次
      for (let i = 0; i < 4; i++) {
        log(`挂机加钟 ${i + 1}/4...`);
        try {
          await worker.sendMessageWithPromise('system_mysharecallback', { isSkipShareCard: true, type: 2 }, 8000);
          await sleep(500);
          log(`挂机加钟 ${i + 1} 成功`, 'success');
        } catch (e) {
          log(`挂机加钟 ${i + 1} 失败: ${e.message}`, 'warning');
        }
      }

      log('挂机奖励任务完成', 'success');
      return { success: true, message: '挂机奖励+加钟完成' };
    } catch (error) {
      log(`挂机奖励任务失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 仅挂机加钟
 */
function createBatchAddHangUpTime(deps) {
  return async function batchAddHangUpTime() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const times = config.times || 4;

    log(`开始挂机加钟 ${times} 次...`);
    try {
      for (let i = 0; i < times; i++) {
        log(`挂机加钟 ${i + 1}/${times}...`);
        try {
          await worker.sendMessageWithPromise('system_mysharecallback', { isSkipShareCard: true, type: 2 }, 8000);
          await sleep(500);
          log(`挂机加钟 ${i + 1} 成功`, 'success');
        } catch (e) {
          log(`挂机加钟 ${i + 1} 失败: ${e.message}`, 'warning');
        }
      }
      log('挂机加钟完成', 'success');
      return { success: true, message: `挂机加钟 ${times} 次完成` };
    } catch (error) {
      log(`挂机加钟失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 批量学习技能
 */
function createBatchStudy(deps) {
  return async function batchStudy() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始学习技能...');
    try {
      // 获取可学习技能列表
      const result = await worker.sendMessageWithPromise('study_getinfo', {}, 8000);
      await sleep(500);

      const skills = result?.rawData?.skills || result?.skills || [];
      let learned = 0;

      for (const skill of skills) {
        if (skill.canStudy || skill.status === 0) {
          try {
            log(`学习技能: ${skill.name || skill.id}...`);
            await worker.sendMessageWithPromise('study_learn', { skillId: skill.id }, 8000);
            await sleep(500);
            learned++;
            log(`学习技能 ${skill.name || skill.id} 成功`, 'success');
          } catch (e) {
            log(`学习技能 ${skill.name || skill.id} 失败: ${e.message}`, 'warning');
          }
        }
      }

      log(`技能学习完成，共学习 ${learned} 个`, 'success');
      return { success: true, learned };
    } catch (error) {
      log(`技能学习失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 俱乐部签到
 */
function createBatchClubSign(deps) {
  return async function batchclubsign() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始俱乐部签到...');
    try {
      await worker.sendMessageWithPromise('legion_signin', {}, 8000);
      await sleep(500);
      log('俱乐部签到成功', 'success');
      return { success: true, message: '俱乐部签到完成' };
    } catch (error) {
      log(`俱乐部签到失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = {
  createClaimHangUpRewards,
  createBatchAddHangUpTime,
  createBatchStudy,
  createBatchClubSign,
};
