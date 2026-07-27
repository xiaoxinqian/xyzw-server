/**
 * 爬塔任务工厂
 * 从参考项目 tasksTower.js 移植
 * 功能：爬普通塔(fight_starttower) / 爬奇峰塔(evotower) / 领取合成免费道具(mergebox) / 换皮闯关(towers)
 */

const { getShanghaiISO } = require('../../utils/time');
const { getTowerActId } = require('./utils/towerActId');
const { DEFAULT_WEIRD_TOWER_MAX_CLIMB, normalizeWeirdTowerMaxClimb } = require('./utils/towerClimbLimit');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 爬普通塔
 * 原项目：presetteam_getinfo → 检查阵容 → presetteam_saveteam → tower_getinfo → role_getroleinfo(体力) → fight_starttower 循环
 */
function createClimbTower(deps) {
  return async function climbTower() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const formation = config.formation || 1;

    log('开始爬塔...');
    try {
      // 检查当前阵容
      let needSwitchBack = false;
      let originalFormation = null;
      try {
        const teamInfo = await worker.sendMessageWithPromise('presetteam_getinfo', {}, 5000);
        originalFormation = teamInfo?.rawData?.presetTeamInfo?.useTeamId
          ?? teamInfo?.presetTeamInfo?.useTeamId;
        if (originalFormation === formation) {
          log(`当前已是阵容${formation}，无需切换`);
        } else {
          log(`切换到阵容 ${formation}...`);
          await worker.sendMessageWithPromise('presetteam_saveteam', { teamId: formation }, 8000);
          needSwitchBack = true;
          await sleep(500);
        }
      } catch (e) {
        log(`获取阵容信息失败: ${e.message}，直接尝试切换`, 'warning');
        try {
          await worker.sendMessageWithPromise('presetteam_saveteam', { teamId: formation }, 8000);
          needSwitchBack = true;
          await sleep(500);
        } catch (e2) {
          log(`切换阵容失败: ${e2.message}`, 'warning');
        }
      }

      // 获取初始体力
      try {
        await worker.sendMessageWithPromise('tower_getinfo', {}, 5000);
      } catch (e) { /* 忽略 */ }

      const roleResp = await worker.sendMessageWithPromise('role_getroleinfo', {}, 10000);
      const roleData = roleResp?.rawData?.role || roleResp?.role || {};
      let energy = roleData?.tower?.energy || 0;
      log(`初始体力: ${energy}`);

      let count = 0;
      const MAX_CLIMB = 100;
      let consecutiveFailures = 0;
      let roleInfo = roleResp;

      while (energy > 0 && count < MAX_CLIMB) {
        try {
          await worker.sendMessageWithPromise('fight_starttower', {}, 5000);
          count++;
          consecutiveFailures = 0;
          log(`爬塔第 ${count} 次`);
          await sleep(1000);

          // 本地递减体力，每5次刷新一次服务器值
          if (count % 5 === 0) {
            try {
              const r = await worker.sendMessageWithPromise('role_getroleinfo', {}, 10000);
              roleInfo = r;
              const serverEnergy = r?.rawData?.role?.tower?.energy ?? r?.role?.tower?.energy;
              if (serverEnergy !== undefined && serverEnergy !== null) {
                energy = serverEnergy;
                log(`体力刷新: ${energy} (服务器)`);
              } else {
                energy--;
              }
            } catch (e) {
              energy--;
            }
          } else {
            energy--;
          }
        } catch (err) {
          const msg = err.message || '';

          // 操作过快
          if (msg.includes('200400')) {
            log('操作过快，等待5秒...', 'warning');
            await sleep(5000);
            continue;
          }

          // 上座塔奖励未领取
          if (msg.includes('1500040')) {
            log('上座塔奖励未领取，尝试领取...', 'warning');
            try {
              const towerId = roleData?.tower?.id || 0;
              const rewardFloor = Math.floor(towerId / 10);
              if (rewardFloor > 0) {
                await worker.sendMessageWithPromise('tower_claimreward', { rewardId: rewardFloor }, 5000);
                log(`领取第 ${rewardFloor} 层奖励`);
              }
            } catch (e) { /* 忽略 */ }
            await sleep(3000);
            try {
              const r = await worker.sendMessageWithPromise('role_getroleinfo', {}, 10000);
              roleData = r?.rawData?.role || r?.role || {};
              energy = roleData?.tower?.energy || 0;
            } catch (e) { /* 忽略 */ }
            consecutiveFailures = 0;
            continue;
          }

          consecutiveFailures++;
          log(`战斗出错: ${msg} (重试 ${consecutiveFailures}/3)`, 'warning');
          if (consecutiveFailures >= 3) {
            log('连续失败3次，停止爬塔', 'error');
            break;
          }
          await sleep(2000);
          try {
            const r = await worker.sendMessageWithPromise('role_getroleinfo', {}, 10000);
            energy = r?.rawData?.role?.tower?.energy ?? r?.role?.tower?.energy ?? 0;
          } catch (e) { /* 忽略 */ }
        }
      }

      // 切回原阵容
      if (needSwitchBack && originalFormation != null) {
        try {
          await worker.sendMessageWithPromise('presetteam_saveteam', { teamId: originalFormation }, 5000);
          log(`已切回阵容${originalFormation}`);
        } catch (e) { /* 忽略 */ }
      }

      log(`爬塔完成: 共 ${count} 次`, 'success');
      return { success: true, count };
    } catch (error) {
      log(`爬塔失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 爬奇峰塔（怪异塔）
 * 原项目：presetteam_getinfo → evotower_getinfo(能量) → evotower_readyfight + evotower_fight 循环
 */
function createClimbWeirdTower(deps) {
  return async function climbWeirdTower() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const formation = config.formation || 1;
    const maxClimb = normalizeWeirdTowerMaxClimb(config.maxClimb);

    log('开始爬奇峰塔...');
    try {
      // 检查阵容
      let needSwitchBack = false;
      let originalFormation = null;
      try {
        const teamInfo = await worker.sendMessageWithPromise('presetteam_getinfo', {}, 5000);
        originalFormation = teamInfo?.rawData?.presetTeamInfo?.useTeamId
          ?? teamInfo?.presetTeamInfo?.useTeamId;
        if (originalFormation === formation) {
          log(`当前已是阵容${formation}，无需切换`);
        } else {
          log(`切换到阵容 ${formation}...`);
          await worker.sendMessageWithPromise('presetteam_saveteam', { teamId: formation }, 8000);
          needSwitchBack = true;
          await sleep(500);
        }
      } catch (e) {
        log(`获取阵容信息失败: ${e.message}`, 'warning');
      }

      // 获取奇峰塔信息
      const evoInfo1 = await worker.sendMessageWithPromise('evotower_getinfo', {}, 5000);
      let currentEnergy = evoInfo1?.rawData?.evoTower?.energy ?? evoInfo1?.evoTower?.energy ?? 0;
      log(`初始能量: ${currentEnergy}，本次最多爬 ${maxClimb} 次`);

      let count = 0;
      let consecutiveFailures = 0;

      while (currentEnergy > 0 && count < maxClimb) {
        try {
          // 准备战斗
          await worker.sendMessageWithPromise('evotower_readyfight', {}, 5000);
          // 执行战斗
          const fightResult = await worker.sendMessageWithPromise('evotower_fight', {
            battleNum: 1,
            winNum: 1,
          }, 10000);
          count++;
          consecutiveFailures = 0;
          log(`奇峰塔第 ${count} 次`);
          await sleep(500);

          // 刷新信息 + 检查每日任务奖励
          const evoInfo2 = await worker.sendMessageWithPromise('evotower_getinfo', {}, 5000);
          const evoTower = evoInfo2?.rawData?.evoTower ?? evoInfo2?.evoTower ?? {};

          // 领取每日任务奖励
          if (evoTower.taskClaimMap) {
            const now = new Date();
            const year = now.getFullYear().toString().slice(2);
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const dateKey = `${year}${month}${day}`;
            const dailyTasks = evoTower.taskClaimMap[dateKey] || {};
            for (const taskId of [1, 2, 3]) {
              if (!dailyTasks[taskId]) {
                try {
                  await worker.sendMessageWithPromise('evotower_claimtask', { taskId }, 2000);
                  log(`领取每日任务奖励 ${taskId}`, 'success');
                } catch (e) { /* 忽略 */ }
                await sleep(200);
              }
            }
          }

          // 检查通关奖励（每10层一次）
          const towerId = evoTower.towerId || 0;
          const floor = (towerId % 10) + 1;
          if (fightResult?.rawData?.winList?.[0] === true || fightResult?.winList?.[0] === true) {
            if (floor === 1) {
              try {
                await worker.sendMessageWithPromise('evotower_claimreward', {}, 5000);
                log(`领取第${Math.floor(towerId / 10)}章通关奖励`, 'success');
              } catch (e) { /* 忽略 */ }
              await sleep(1000);
            }
          }

          // 刷新能量
          currentEnergy = evoTower.energy || 0;
        } catch (err) {
          consecutiveFailures++;
          log(`战斗出错: ${err.message} (重试 ${consecutiveFailures}/3)`, 'warning');
          if (consecutiveFailures >= 3) {
            log('连续失败3次，停止', 'error');
            break;
          }
          await sleep(1000);
          try {
            const r = await worker.sendMessageWithPromise('evotower_getinfo', {}, 5000);
            currentEnergy = r?.rawData?.evoTower?.energy ?? r?.evoTower?.energy ?? 0;
          } catch (e) { /* 忽略 */ }
        }
      }

      // 切回原阵容
      if (needSwitchBack && originalFormation != null) {
        try {
          await worker.sendMessageWithPromise('presetteam_saveteam', { teamId: originalFormation }, 5000);
          log(`已切回阵容${originalFormation}`);
        } catch (e) { /* 忽略 */ }
      }

      log(`奇峰塔完成: 共 ${count} 次`, 'success');
      return { success: true, count };
    } catch (error) {
      log(`奇峰塔失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 领取合成免费道具（原项目：mergebox_getinfo → mergebox_claimfreeenergy）
 * 注意：不是领取体力，是领取合成盒子的免费道具
 */
function createBatchClaimFreeEnergy(deps) {
  return async function batchClaimFreeEnergy() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始领取合成免费道具...');
    try {
      const info = await worker.sendMessageWithPromise('mergebox_getinfo', { actType: 1 }, 5000);
      const mergeBox = info?.rawData?.mergeBox ?? info?.mergeBox ?? {};
      const freeEnergy = mergeBox.freeEnergy || 0;

      if (freeEnergy > 0) {
        await worker.sendMessageWithPromise('mergebox_claimfreeenergy', { actType: 1 }, 5000);
        log(`成功领取免费道具 ${freeEnergy} 个`, 'success');
      } else {
        log('暂无免费道具可领取');
      }

      return { success: true, freeEnergy };
    } catch (error) {
      log(`领取合成免费道具失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 换皮闯关
 * 原项目：towers_getinfo → 根据星期判断开放BOSS → towers_start + towers_fight 循环
 */
function createSkinChallenge(deps) {
  return async function skinChallenge() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始换皮闯关...');
    try {
      const actId = getTowerActId();
      log(`活动ID: ${actId}`);

      // 获取活动信息
      let res = await worker.sendMessageWithPromise('towers_getinfo', { actId }, 5000);
      let towerData = res?.rawData?.actId ? res.rawData : (res?.actId ? res : (res?.rawData?.towerData || res?.towerData || {}));

      if (!towerData.actId) {
        log('换皮闯关活动信息获取失败', 'warning');
        return { success: false, message: '活动信息获取失败' };
      }

      // 检查活动是否在有效期内
      const actIdStr = String(towerData.actId);
      if (actIdStr.length >= 6) {
        const year = '20' + actIdStr.substring(0, 2);
        const month = actIdStr.substring(2, 4);
        const day = actIdStr.substring(4, 6);
        const startDate = new Date(`${year}-${month}-${day}T00:00:00`);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);
        const now = new Date();
        if (now < startDate || now >= endDate) {
          log('换皮闯关活动已结束', 'warning');
          return { success: false, message: '活动已结束' };
        }
      }

      let levelRewardMap = towerData.levelRewardMap || {};

      // 根据星期判断开放BOSS
      const todayWeekDay = new Date().getDay();
      const openTowerMap = {
        5: [1], 6: [2], 0: [3], 1: [4], 2: [5], 3: [6], 4: [1, 2, 3, 4, 5, 6]
      };
      const todayOpenTowers = openTowerMap[todayWeekDay] || [];

      // 辅助函数
      const isTowerCleared = (type, map) => {
        const key1 = `${type}008`;
        const key2 = Number(key1);
        return !!(map[key1] || map[key2]);
      };
      const getTowerLevel = (type, map) => {
        for (let i = 8; i >= 1; i--) {
          const key1 = `${type}00${i}`;
          const key2 = Number(key1);
          if (map[key1] || map[key2]) {
            return i === 8 ? 8 : i + 1;
          }
        }
        return 1;
      };

      // 筛选未通关的BOSS
      const targetTowers = todayOpenTowers.filter(type => !isTowerCleared(type, levelRewardMap));

      if (targetTowers.length === 0) {
        log('今日BOSS已全部通关，无需挑战');
        return { success: true, message: '已通关' };
      }

      log(`需要挑战的BOSS: ${targetTowers.join(', ')}`);

      for (const type of targetTowers) {
        log(`开始挑战 BOSS ${type}`);
        let needStart = true;
        let loop = true;
        let failCount = 0;

        while (loop) {
          try {
            if (needStart) {
              await worker.sendMessageWithPromise('towers_start', { actId, towerType: type }, 5000);
              await sleep(500);
            }

            const fightRes = await worker.sendMessageWithPromise('towers_fight', { actId, towerType: type }, 5000);
            const battleData = fightRes?.rawData?.battleData ?? fightRes?.battleData ?? {};
            const curHP = battleData?.result?.accept?.ext?.curHP;
            const currentLevel = getTowerLevel(type, levelRewardMap);

            if (curHP === 0) {
              log(`BOSS ${type} 第 ${currentLevel} 层挑战成功`, 'success');
              needStart = false;
              failCount = 0;

              // 刷新数据
              res = await worker.sendMessageWithPromise('towers_getinfo', { actId }, 5000);
              towerData = res?.rawData?.actId ? res.rawData : (res?.actId ? res : (res?.rawData?.towerData || res?.towerData || {}));
              levelRewardMap = towerData.levelRewardMap || {};

              if (isTowerCleared(type, levelRewardMap)) {
                log(`BOSS ${type} 全部通关`, 'success');
                loop = false;
              } else {
                await sleep(1000);
              }
            } else {
              log(`BOSS ${type} 第 ${currentLevel} 层挑战失败`, 'warning');
              needStart = true;
              failCount++;
              if (failCount >= 3) {
                log(`BOSS ${type} 连续失败3次，跳过`, 'error');
                loop = false;
              } else {
                await sleep(1000);
              }
            }
          } catch (err) {
            log(`BOSS ${type} 战斗异常: ${err.message}`, 'warning');
            needStart = true;
            failCount++;
            if (failCount >= 3) {
              loop = false;
            } else {
              await sleep(1000);
            }
          }
        }
      }

      log('换皮闯关完成', 'success');
      return { success: true };
    } catch (error) {
      log(`换皮闯关失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = {
  createClimbTower,
  createClimbWeirdTower,
  createBatchClaimFreeEnergy,
  createSkinChallenge,
};
