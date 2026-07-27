/**
 * 车辆任务工厂
 * 从参考项目 tasksCar.js 移植
 */

const { getShanghaiISO } = require('../../utils/time');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

// 车辆研究消耗表（从原项目 constants.js CarresearchItem 移植）
const CarresearchItem = [
  20, 21, 22, 23, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 47, 50, 53, 56,
  59, 62, 65, 68, 71, 74, 78, 82, 86, 90, 94, 99, 104, 109, 114, 119, 126, 133,
  140, 147, 154, 163, 172, 181, 190, 199, 210, 221, 232, 243, 369, 393, 422,
  457, 498, 548, 607, 678, 763, 865, 1011,
];

/**
 * 标准化车辆数据
 * 从原项目 carUtils.js 移植
 */
function normalizeCars(raw) {
  const r = raw || {};
  const body = r.body || r;
  const roleCar = body.roleCar || body.rolecar || {};
  const carMap = roleCar.carDataMap || roleCar.cardatamap;
  if (carMap && typeof carMap === 'object') {
    return Object.entries(carMap).map(([id, info], idx) => ({
      key: idx,
      id,
      ...(info || {}),
    }));
  }
  let arr = body.cars || body.list || body.data || body.carList || body.vehicles || [];
  if (!Array.isArray(arr) && typeof arr === 'object' && arr !== null) arr = Object.values(arr);
  if (Array.isArray(body) && arr.length === 0) arr = body;
  return (Array.isArray(arr) ? arr : []).map((it, idx) => ({ key: idx, ...it }));
}

/**
 * 获取品质标签
 */
function gradeLabel(color) {
  const map = { 1: '绿·普通', 2: '蓝·稀有', 3: '紫·史诗', 4: '橙·传说', 5: '红·神话', 6: '金·传奇' };
  return map[color] || '未知';
}

/**
 * 判断是否可以收取
 * 从原项目 carUtils.js 移植
 */
function canClaim(car) {
  const t = Number(car?.sendAt || 0);
  if (!t) return false;
  const tsMs = t < 1e12 ? t * 1000 : t;
  return Date.now() - tsMs >= FOUR_HOURS_MS;
}

/**
 * 智能派车：根据4小时阈值判断是否需要派车
 */
function createBatchSmartSendCar(deps) {
  return async function batchSmartSendCar() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const carMinColor = config.carMinColor || 4;

    log(`开始智能派车 (最低品质: ${carMinColor})...`);
    try {
      const carInfo = await worker.sendMessageWithPromise('car_getrolecar', {}, 8000);
      await sleep(500);

      const cars = normalizeCars(carInfo?.rawData || carInfo);
      if (!cars.length) {
        log('无车辆信息', 'warning');
        return { success: false, message: '无车辆' };
      }

      const now = Date.now();
      let sentCount = 0;
      let skippedCount = 0;

      for (const car of cars) {
        const color = Number(car.color || 0);
        if (color < carMinColor) {
          skippedCount++;
          continue;
        }

        const lastTime = car.lastSendTime ? new Date(car.lastSendTime).getTime() : 0;
        const elapsed = now - lastTime;

        if (elapsed >= FOUR_HOURS_MS || !lastTime) {
          log(`派车 ${car.id || car.carId} (品质${color})...`);
          try {
            await worker.sendMessageWithPromise('car_send', {
            carId: String(car.id || car.carId),
            helperId: 0,
            text: "",
            isUpgrade: false,
          }, 8000);
            await sleep(500);
            sentCount++;
            log(`派车成功`, 'success');
          } catch (e) {
            log(`派车失败: ${e.message}`, 'warning');
          }
        } else {
          const remainMin = Math.ceil((FOUR_HOURS_MS - elapsed) / 60000);
          log(`车辆 ${car.id || car.carId} 还需 ${remainMin} 分钟`, 'info');
        }
      }

      log(`智能派车完成: 派出 ${sentCount} 辆, 跳过 ${skippedCount} 辆(品质不足)`, 'success');
      return { success: true, sentCount, skippedCount };
    } catch (error) {
      log(`智能派车失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 批量收车——领取已完成的车辆奖励
 * 参考原项目 tasksCar.js 中的收车逻辑：
 * - 调用 car_getrolecar 获取车辆列表
 * - 遍历所有车辆，判断 canClaim（车辆状态为已完成但未领取）
 * - 对可领取的车辆调用 car_claim 领取奖励
 * - 自动进行车辆改装研究升级
 * - 记录日志
 */
function createBatchClaimCars(deps) {
  return async function batchClaimCars() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始一键收车...');
    try {
      // 1. 调用 car_getrolecar 获取车辆列表
      log('获取车辆信息...');
      const res = await worker.sendMessageWithPromise('car_getrolecar', {}, 10000);
      await sleep(500);

      const rawData = res?.rawData || res;
      const cars = normalizeCars(rawData);
      let researchLevel = rawData?.roleCar?.research?.[1] || rawData?.rolecar?.research?.[1] || 0;

      if (!cars.length) {
        log('无车辆信息', 'warning');
        return { success: true, claimed: 0, message: '无车辆' };
      }

      // 2. 遍历所有车辆，判断 canClaim，领取可领取的车辆
      let claimed = 0;
      for (const car of cars) {
        // 判断车辆是否已完成但未领取
        if (!canClaim(car)) continue;

        try {
          // 调用 car_claim 领取奖励
          await worker.sendMessageWithPromise('car_claim', {
            carId: String(car.id),
          }, 10000);
          claimed++;
          log(`收车成功: ${gradeLabel(car.color)}`, 'success');
          await sleep(300);

          // 自动进行车辆改装研究升级
          try {
            const roleRes = await worker.sendMessageWithPromise('role_getroleinfo', {}, 5000);
            let refreshPieces = Number(
              roleRes?.rawData?.role?.items?.[35009]?.quantity ||
              roleRes?.role?.items?.[35009]?.quantity || 0
            );

            while (
              researchLevel < CarresearchItem.length &&
              refreshPieces >= CarresearchItem[researchLevel]
            ) {
              try {
                await worker.sendMessageWithPromise('car_research', { researchId: 1 }, 5000);
                researchLevel++;

                const updatedRoleRes = await worker.sendMessageWithPromise('role_getroleinfo', {}, 5000);
                refreshPieces = Number(
                  updatedRoleRes?.rawData?.role?.items?.[35009]?.quantity ||
                  updatedRoleRes?.role?.items?.[35009]?.quantity || 0
                );

                log(`车辆改装升级成功，当前等级: ${researchLevel}`, 'success');
                await sleep(300);
              } catch (e) {
                log(`车辆改装升级失败: ${e.message}`, 'warning');
                break;
              }
            }

            // 尝试领取改装升级累计奖励
            try {
              const rewardRes = await worker.sendMessageWithPromise('car_claimpartconsumereward', {}, 5000);
              if (rewardRes?.rawData?.reward || rewardRes?.reward) {
                log('领取改装升级累计奖励成功', 'success');
              }
            } catch (_) {
              // 可能无奖励可领，忽略
            }
          } catch (_) {
            // 获取角色信息失败不影响收车
          }
        } catch (e) {
          log(`收车失败 (${gradeLabel(car.color)}): ${e.message}`, 'warning');
        }
        await sleep(300);
      }

      if (claimed === 0) {
        log('没有可收取的车辆', 'info');
      } else {
        log(`收车完成: 共收取 ${claimed} 辆`, 'success');
      }

      return { success: true, claimed };
    } catch (error) {
      log(`收车失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = {
  createBatchSmartSendCar,
  createBatchClaimCars,
};
