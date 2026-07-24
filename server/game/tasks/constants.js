/**
 * 任务常量定义
 * 从参考项目 constants.js 移植
 */

// 宝箱类型选项
const boxTypeOptions = [
  { label: '木质宝箱', value: 2001 },
  { label: '青铜宝箱', value: 2002 },
  { label: '白银宝箱', value: 2003 },
  { label: '黄金宝箱', value: 2004 },
];

// 钓鱼类型选项
const fishTypeOptions = [
  { label: '普通钓鱼', value: 1 },
  { label: '高级钓鱼', value: 2 },
];

// 阵容选项
const formationOptions = [
  { label: '阵容1', value: 1 },
  { label: '阵容2', value: 2 },
  { label: '阵容3', value: 3 },
  { label: '阵容4', value: 4 },
  { label: '阵容5', value: 5 },
  { label: '阵容6', value: 6 },
];

// BOSS次数选项
const bossTimesOptions = [
  { label: '0次', value: 0 },
  { label: '1次', value: 1 },
  { label: '2次', value: 2 },
  { label: '3次', value: 3 },
  { label: '4次', value: 4 },
];

// 可用任务列表（前端用）
const availableTasks = [
  { id: 'startBatch', name: '每日任务(完整流程)', description: '执行完整的每日任务流程', category: 'daily' },
  { id: 'claimHangUpRewards', name: '领取挂机奖励', description: '领取挂机奖励+加钟4次', category: 'hangup' },
  { id: 'batchAddHangUpTime', name: '挂机加钟', description: '仅执行挂机加钟', category: 'hangup' },
  { id: 'resetBottles', name: '盐罐重置', description: '停止→重启→领取盐罐奖励', category: 'bottle' },
  { id: 'batchlingguanzi', name: '领取灵罐', description: '批量领取灵罐奖励', category: 'bottle' },
  { id: 'climbTower', name: '爬塔', description: '普通塔自动爬层', category: 'tower' },
  { id: 'climbWeirdTower', name: '爬奇峰塔', description: '奇峰塔自动爬层', category: 'tower' },
  { id: 'batchClaimFreeEnergy', name: '领取免费体力', description: '领取每日免费体力', category: 'tower' },
  { id: 'batchStudy', name: '学习技能', description: '批量学习技能', category: 'hangup' },
  { id: 'batchclubsign', name: '俱乐部签到', description: '俱乐部批量签到', category: 'daily' },
  { id: 'batchSmartSendCar', name: '智能派车', description: '根据4小时阈值智能派车', category: 'car' },
  { id: 'batchClaimCars', name: '领取车辆', description: '批量领取车辆奖励', category: 'car' },
  { id: 'batchOpenBox', name: '开箱', description: '批量开启指定类型宝箱', category: 'item' },
  { id: 'batchClaimBoxPointReward', name: '领取箱积奖励', description: '领取宝箱积分奖励', category: 'item' },
  { id: 'batchFish', name: '钓鱼', description: '批量钓鱼', category: 'item' },
  { id: 'batchRecruit', name: '招募', description: '免费+付费招募', category: 'item' },
  { id: 'batchHeroUpgrade', name: '英雄升星', description: '批量英雄升星(遍历英雄列表)', category: 'item' },
  { id: 'batchbaoku13', name: '宝库1-3层', description: '宝库1-3层扫荡', category: 'dungeon' },
  { id: 'batchbaoku45', name: '宝库4-5层', description: '宝库4-5层扫荡', category: 'dungeon' },
  { id: 'batchmengjing', name: '咸王梦境', description: '咸王梦境商店购买', category: 'dungeon' },
  { id: 'batchBuyDreamItems', name: '梦境购物', description: '梦境商店购买物品', category: 'dungeon' },
  { id: 'batcharenafight', name: '竞技场战斗', description: '竞技场自动战斗', category: 'arena' },
  { id: 'batchTopUpFish', name: '补充鱼饵', description: '补充钓鱼鱼饵', category: 'arena' },
  { id: 'batchTopUpArena', name: '补充竞技场', description: '补充竞技场次数', category: 'arena' },
  { id: 'legion_storebuygoods', name: '军团商店购买', description: '军团商店批量购买', category: 'store' },
  { id: 'legionStoreBuySkinCoins', name: '皮肤币商店', description: '皮肤币商店购买', category: 'store' },
  { id: 'store_purchase', name: '黑市购买', description: '黑市购买物品', category: 'store' },
  { id: 'collection_claimfreereward', name: '领取免费奖励', description: '领取收藏免费奖励', category: 'store' },
  { id: 'batchLegacyClaim', name: '珍宝阁领取', description: '珍宝阁批量领取', category: 'legacy' },
  { id: 'batchLegacyGiftSendEnhanced', name: '珍宝阁赠礼', description: '珍宝阁增强赠礼', category: 'legacy' },
  { id: 'skinChallenge', name: '皮肤挑战', description: '皮肤挑战', category: 'daily' },
];

module.exports = {
  boxTypeOptions,
  fishTypeOptions,
  formationOptions,
  bossTimesOptions,
  availableTasks,
};
