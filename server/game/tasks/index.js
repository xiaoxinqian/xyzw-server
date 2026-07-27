/**
 * 任务注册表
 * 将任务类型ID映射到对应的工厂函数
 * 统一入口：createTask(taskType, deps) → async task function
 */

const { DailyTaskRunner, BottleResetTask, DEFAULT_SETTINGS } = require('../taskRunner');
const { getShanghaiISO } = require('../../utils/time');

// 瓶子
const { createResetBottles } = require('./tasksBottle');
// 挂机
const { createClaimHangUpRewards, createBatchAddHangUpTime, createBatchStudy, createBatchClubSign } = require('./tasksHangUp');
// 爬塔
const { createClimbTower, createClimbWeirdTower, createBatchClaimFreeEnergy, createSkinChallenge } = require('./tasksTower');
// 竞技场
const { createBatchArenaFight } = require('./tasksArena');
// 道具
const { createBatchOpenBox, createBatchClaimBoxPointReward, createBatchFish, createBatchRecruit, createBatchHeroUpgrade } = require('./tasksItem');
// 副本
const { createBatchBaoKu13, createBatchBaoKu45, createBatchMengJing, createBatchBuyDreamItems } = require('./tasksDungeon');
// 车辆
const { createBatchSmartSendCar, createBatchClaimCars } = require('./tasksCar');
// 商店
const { createLegionStoreBuyGoods, createLegionStoreBuySkinCoins, createStorePurchase, createCollectionClaimFreeReward } = require('./tasksStore');
// 珍宝阁
const { createBatchLegacyClaim, createBatchLegacyGiftSendEnhanced } = require('./tasksLegacy');

/**
 * 任务类型 → 工厂函数映射表
 */
const TASK_REGISTRY = {
  // 每日完整流程（使用 DailyTaskRunner）
  startBatch: (deps) => {
    const runner = new DailyTaskRunner(deps.worker, { ...DEFAULT_SETTINGS, ...(deps.config || {}) }, deps.onLog);
    return () => runner.run();
  },

  // 瓶子
  resetBottles: createResetBottles,

  // 挂机
  claimHangUpRewards: createClaimHangUpRewards,
  batchAddHangUpTime: createBatchAddHangUpTime,
  batchStudy: createBatchStudy,
  batchclubsign: createBatchClubSign,

  // 爬塔
  climbTower: createClimbTower,
  climbWeirdTower: createClimbWeirdTower,
  batchClaimFreeEnergy: createBatchClaimFreeEnergy,

  // 竞技场
  batcharenafight: createBatchArenaFight,

  // 道具
  batchOpenBox: createBatchOpenBox,
  batchClaimBoxPointReward: createBatchClaimBoxPointReward,
  batchFish: createBatchFish,
  batchRecruit: createBatchRecruit,
  batchHeroUpgrade: createBatchHeroUpgrade,

  // 副本
  batchbaoku13: createBatchBaoKu13,
  batchbaoku45: createBatchBaoKu45,
  batchmengjing: createBatchMengJing,
  batchBuyDreamItems: createBatchBuyDreamItems,

  // 车辆
  batchSmartSendCar: createBatchSmartSendCar,
  batchClaimCars: createBatchClaimCars,

  // 商店
  legion_storebuygoods: createLegionStoreBuyGoods,
  legionStoreBuySkinCoins: createLegionStoreBuySkinCoins,
  store_purchase: createStorePurchase,
  collection_claimfreereward: createCollectionClaimFreeReward,

  // 珍宝阁
  batchLegacyClaim: createBatchLegacyClaim,
  batchLegacyGiftSendEnhanced: createBatchLegacyGiftSendEnhanced,

  // 皮肤
  skinChallenge: createSkinChallenge,
};

/**
 * 创建任务实例
 * @param {string} taskType - 任务类型ID
 * @param {object} deps - 依赖 { worker, onLog, config }
 * @returns {Function|null} async task function, or null if unknown type
 */
function createTask(taskType, deps) {
  const factory = TASK_REGISTRY[taskType];
  if (!factory) {
    // 未知任务类型，回退到每日任务
    if (taskType === 'daily' || !taskType) {
      const runner = new DailyTaskRunner(deps.worker, { ...DEFAULT_SETTINGS, ...(deps.config || {}) }, deps.onLog);
      return () => runner.run();
    }
    return null;
  }
  return factory(deps);
}

/**
 * 获取所有可用任务类型
 */
function getAvailableTaskTypes() {
  return Object.keys(TASK_REGISTRY);
}

/**
 * 检查任务类型是否存在
 */
function hasTaskType(taskType) {
  return taskType in TASK_REGISTRY;
}

module.exports = {
  TASK_REGISTRY,
  createTask,
  getAvailableTaskTypes,
  hasTaskType,
};
