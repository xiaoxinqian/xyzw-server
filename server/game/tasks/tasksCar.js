/**
 * 车辆任务工厂
 * 从参考项目 tasksCar.js 移植
 */

const { getShanghaiISO } = require('../../utils/time');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

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

      const cars = carInfo?.rawData?.cars || carInfo?.cars || [];
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
            await worker.sendMessageWithPromise('car_send', { carId: car.id || car.carId }, 8000);
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
 * 批量领取车辆奖励
 */
function createBatchClaimCars(deps) {
  return async function batchClaimCars() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始领取车辆奖励...');
    try {
      const carInfo = await worker.sendMessageWithPromise('car_getrolecar', {}, 8000);
      await sleep(500);

      const cars = carInfo?.rawData?.cars || carInfo?.cars || [];
      let claimed = 0;

      for (const car of cars) {
        if (car.canClaim || car.rewardReady) {
          try {
            log(`领取车辆 ${car.id || car.carId} 奖励...`);
            await worker.sendMessageWithPromise('car_claimreward', { carId: car.id || car.carId }, 8000);
            await sleep(500);
            claimed++;
            log(`领取成功`, 'success');
          } catch (e) {
            log(`领取车辆 ${car.id || car.carId} 失败: ${e.message}`, 'warning');
          }
        }
      }

      log(`车辆奖励领取完成: 共 ${claimed} 辆`, 'success');
      return { success: true, claimed };
    } catch (error) {
      log(`领取车辆奖励失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = {
  createBatchSmartSendCar,
  createBatchClaimCars,
};
