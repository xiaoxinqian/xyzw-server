/**
 * 预设任务模板
 * 参照原项目 BatchDailyTasks.vue 的默认配置
 * 
 * 核心设计：31个预设任务全局只有一份，新账号导入时
 * 自动追加到这些任务的 account_ids 数组中，而非复制任务。
 */

const { v4: uuidv4 } = require('uuid');
const { get, all, run } = require('../database/db');
const { getShanghaiISO } = require('../utils/time');
const logger = require('../utils/logger');

/**
 * 预设任务定义（与原项目默认值一致）
 * 用 task_type 作为唯一标识匹配是否已存在
 */
const PRESET_TASKS = [
  // === 日常核心 ===
  { name: '日常任务(全流程)', task_type: 'startBatch', schedule_type: 'daily', execute_time: '04:00', interval_minutes: null,
    config: { arenaFormation: 1, bossFormation: 1, bossTimes: 2, claimBottle: true, payRecruit: true, openBox: true, arenaEnable: true, claimHangUp: true, claimEmail: true, blackMarketPurchase: true, freeGachaEnable: true } },
  { name: '盐罐管理', task_type: 'resetBottles', schedule_type: 'interval', execute_time: null, interval_minutes: 180, config: { mode: 'claim_and_reset' } },
  { name: '领取挂机奖励', task_type: 'claimHangUpRewards', schedule_type: 'interval', execute_time: null, interval_minutes: 240, config: {} },
  { name: '一键加钟', task_type: 'batchAddHangUpTime', schedule_type: 'daily', execute_time: '12:00', interval_minutes: null, config: { times: 4 } },

  // === 日常补充 ===
  { name: '俱乐部签到', task_type: 'batchclubsign', schedule_type: 'daily', execute_time: '04:10', interval_minutes: null, config: {} },
  { name: '答题', task_type: 'batchStudy', schedule_type: 'daily', execute_time: '04:15', interval_minutes: null, config: {} },


  // === 商店 ===
  { name: '黑市采购', task_type: 'store_purchase', schedule_type: 'daily', execute_time: '04:05', interval_minutes: null,
    config: { purchaseList: [] }, enabled: false },
  { name: '珍宝阁免费领取', task_type: 'collection_claimfreereward', schedule_type: 'daily', execute_time: '04:12', interval_minutes: null, config: {} },
  { name: '购买四圣碎片', task_type: 'legion_storebuygoods', schedule_type: 'daily', execute_time: '05:30', interval_minutes: null, config: {} },
  { name: '购买俱乐部皮肤币', task_type: 'legionStoreBuySkinCoins', schedule_type: 'daily', execute_time: '05:35', interval_minutes: null, config: {} },

  // === 爬塔 ===
  { name: '爬塔', task_type: 'climbTower', schedule_type: 'daily', execute_time: '04:30', interval_minutes: null, config: { formation: 1 } },
  { name: '怪异塔', task_type: 'climbWeirdTower', schedule_type: 'daily', execute_time: '05:40', interval_minutes: null, config: { formation: 1 } },
  { name: '怪异塔免费道具', task_type: 'batchClaimFreeEnergy', schedule_type: 'daily', execute_time: '05:45', interval_minutes: null, config: {} },

  // === 竞技场 ===
  { name: '竞技场战斗', task_type: 'batcharenafight', schedule_type: 'daily', execute_time: '06:00', interval_minutes: null, config: { formation: 1, fightCount: 3 }, enabled: false },

  // === 资源 ===
  { name: '批量开箱', task_type: 'batchOpenBox', schedule_type: 'daily', execute_time: '04:35', interval_minutes: null, config: { boxType: 2001, number: 100 }, enabled: false },
  { name: '领取宝箱积分', task_type: 'batchClaimBoxPointReward', schedule_type: 'daily', execute_time: '04:40', interval_minutes: null, config: {} },
  { name: '批量钓鱼', task_type: 'batchFish', schedule_type: 'daily', execute_time: '04:45', interval_minutes: null, config: { fishType: 1, count: 100 } },
  { name: '批量招募', task_type: 'batchRecruit', schedule_type: 'daily', execute_time: '04:50', interval_minutes: null, config: { payRecruit: true }, enabled: false },
  { name: '英雄升星', task_type: 'batchHeroUpgrade', schedule_type: 'daily', execute_time: '04:55', interval_minutes: null, config: { maxStarPerHero: 10 } },

  // === 副本 ===
  { name: '梦境', task_type: 'batchmengjing', schedule_type: 'daily', execute_time: '05:00', interval_minutes: null, config: {} },
  { name: '购买梦境商品', task_type: 'batchBuyDreamItems', schedule_type: 'daily', execute_time: '05:05', interval_minutes: null,
    config: { purchaseList: ['1-5','1-6','2-6','2-7','3-5','3-6','3-7'] } },
  { name: '宝库前3层', task_type: 'batchbaoku13', schedule_type: 'daily', execute_time: '05:10', interval_minutes: null, config: {} },
  { name: '宝库4-5层', task_type: 'batchbaoku45', schedule_type: 'daily', execute_time: '05:15', interval_minutes: null, config: {} },
  { name: '换皮闯关', task_type: 'skinChallenge', schedule_type: 'daily', execute_time: '05:20', interval_minutes: null, config: {} },

  // === 车辆 ===
  { name: '智能发车', task_type: 'batchSmartSendCar', schedule_type: 'daily', execute_time: '05:25', interval_minutes: null, config: { carMinColor: 4 } },
  { name: '收车', task_type: 'batchClaimCars', schedule_type: 'daily', execute_time: '22:00', interval_minutes: null, config: {} },

  // === 功法 ===
  { name: '功法残卷领取', task_type: 'batchLegacyClaim', schedule_type: 'daily', execute_time: '05:50', interval_minutes: null, config: {} },
  { name: '功法残卷赠送', task_type: 'batchLegacyGiftSendEnhanced', schedule_type: 'daily', execute_time: '05:55', interval_minutes: null, config: {} },
];

// task_type 集合，用于判断哪些任务是预设的
const PRESET_TASK_TYPES = new Set(PRESET_TASKS.map(t => t.task_type));

/**
 * 为账号套用预设任务
 * 
 * 逻辑：
 * - 遍历31个预设任务定义
 * - 按 task_type 查找 DB 中是否已有该预设任务
 *   - 已存在 → 把新 accountId 追加到 account_ids 数组
 *   - 不存在 → 创建任务，account_ids = [accountId]
 * - 如果 scheduler 传入，新增的任务会注册调度
 * 
 * @param {string} accountId - 游戏账号ID
 * @param {object} scheduler - 调度器实例（可选）
 * @returns {{ created: number, added: number }} 创建数 + 追加数
 */
function applyPresetTasks(accountId, scheduler = null) {
  const now = getShanghaiISO();
  let created = 0;
  let added = 0;

  for (const preset of PRESET_TASKS) {
    // 按 task_type 查找已有的预设任务
    const existing = get(
      'SELECT id, account_ids FROM tasks WHERE task_type = ?',
      [preset.task_type]
    );

    if (existing) {
      // 已存在 → 追加 accountId 到 account_ids
      let ids = [];
      try {
        ids = JSON.parse(existing.account_ids || '[]');
      } catch { ids = []; }

      if (ids.includes(accountId)) continue; // 已绑定，跳过

      ids.push(accountId);
      run(
        'UPDATE tasks SET account_ids = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(ids), now, existing.id]
      );
      added++;

      // 如果调度器有这个任务，需要刷新（先移除再加回来）
      if (scheduler) {
        scheduler.removeTask(existing.id);
        const task = get('SELECT * FROM tasks WHERE id = ?', [existing.id]);
        if (task) scheduler.addTask(task);
      }
    } else {
      // 不存在 → 创建新任务
      const id = uuidv4();
      const accountIds = JSON.stringify([accountId]);
      run(
        `INSERT INTO tasks (id, account_id, account_ids, name, task_type, schedule_type, execute_time, enabled, config, created_at, interval_minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, accountId, accountIds, preset.name, preset.task_type, preset.schedule_type,
         preset.execute_time, preset.enabled === false ? 0 : 1, JSON.stringify(preset.config), now, preset.interval_minutes]
      );
      created++;

      // 注册调度
      if (scheduler) {
        const task = {
          id, account_id: accountId, account_ids: accountIds,
          name: preset.name, task_type: preset.task_type,
          schedule_type: preset.schedule_type, execute_time: preset.execute_time,
          enabled: preset.enabled === false ? 0 : 1, config: JSON.stringify(preset.config),
          interval_minutes: preset.interval_minutes,
        };
        scheduler.addTask(task);
      }
    }
  }

  logger.info('preset', `账号 ${accountId} 套用预设任务: 新建 ${created} 个, 追加 ${added} 个`);
  return { created, added };
}

/**
 * 从预设任务中移除账号（删账号时调用）
 * @param {string} accountId
 */
function removeAccountFromPresets(accountId) {
  const placeholders = Array(PRESET_TASK_TYPES.size).fill('?').join(',');
  const tasks = all(
    `SELECT id, account_ids FROM tasks WHERE task_type IN (${placeholders})`,
    [...PRESET_TASK_TYPES]
  );

  const now = getShanghaiISO();
  for (const task of tasks) {
    let ids = [];
    try { ids = JSON.parse(task.account_ids || '[]'); } catch { ids = []; }
    
    const filtered = ids.filter(id => id !== accountId);
    if (filtered.length !== ids.length) {
      run('UPDATE tasks SET account_ids = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(filtered), now, task.id]);
    }
  }
}

/**
 * 获取预设任务列表（供前端展示）
 */
function getPresetList() {
  return PRESET_TASKS.map((t, i) => ({ index: i, ...t }));
}

module.exports = {
  PRESET_TASKS,
  PRESET_TASK_TYPES,
  applyPresetTasks,
  removeAccountFromPresets,
  getPresetList,
};
