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
  { id: 'resetBottles', name: '盐罐管理', description: '领取盐罐+灵罐奖励，然后重置计时', category: 'bottle', configFields: [
    { key: 'mode', type: 'select', label: '执行模式', options: [
      { value: 'claim_and_reset', label: '领取+重置（推荐）' },
      { value: 'claim_only', label: '仅领取（不重置计时）' },
      { value: 'reset_only', label: '仅重置（不领取奖励）' }
    ], default: 'claim_and_reset' }
  ]},
  { id: 'climbTower', name: '爬塔', description: '普通塔自动爬层(体力)', category: 'tower', configFields: [
    { key: 'formation', type: 'select', label: '阵容', options: formationOptions, default: 1 }
  ]},
  { id: 'climbWeirdTower', name: '爬奇峰塔', description: '奇峰塔自动爬层(能量)', category: 'tower', configFields: [
    { key: 'formation', type: 'select', label: '阵容', options: formationOptions, default: 1 }
  ]},
  { id: 'batchClaimFreeEnergy', name: '领取合成免费道具', description: '领取合成盒子免费道具', category: 'tower' },
  { id: 'batchStudy', name: '学习技能', description: '批量学习技能', category: 'hangup' },
  { id: 'batchclubsign', name: '俱乐部签到', description: '俱乐部批量签到', category: 'daily' },
  { id: 'batchSmartSendCar', name: '智能派车', description: '根据4小时阈值智能派车', category: 'car' },
  { id: 'batchClaimCars', name: '领取车辆', description: '批量领取车辆奖励', category: 'car' },
  { id: 'batchOpenBox', name: '开箱', description: '批量开启指定类型宝箱', category: 'item', configFields: [{ key: 'boxType', type: 'select', label: '宝箱类型', options: boxTypeOptions }, { key: 'number', type: 'number', label: '数量', default: 100 }] },
  { id: 'batchClaimBoxPointReward', name: '领取箱积奖励', description: '领取宝箱积分奖励', category: 'item' },
  { id: 'batchFish', name: '钓鱼', description: '批量钓鱼', category: 'item', configFields: [{ key: 'fishType', type: 'select', label: '钓鱼类型', options: fishTypeOptions }, { key: 'count', type: 'number', label: '数量', default: 100 }] },
  { id: 'batchRecruit', name: '招募', description: '免费+付费招募', category: 'item' },
  { id: 'batchHeroUpgrade', name: '英雄升星', description: '批量英雄升星(遍历英雄列表)', category: 'item' },
  { id: 'batchbaoku13', name: '宝库1-3层', description: '宝库1-3层扫荡', category: 'dungeon' },
  { id: 'batchbaoku45', name: '宝库4-5层', description: '宝库4-5层扫荡', category: 'dungeon' },
  { id: 'batchmengjing', name: '咸王梦境', description: '咸王梦境商店购买', category: 'dungeon' },
  { id: 'batchBuyDreamItems', name: '梦境购物', description: '梦境商店购买物品', category: 'dungeon', configFields: [{ key: 'purchaseList', type: 'dreamItems', label: '购买商品' }] },
  { id: 'batcharenafight', name: '竞技场战斗', description: '竞技场自动战斗', category: 'arena' },
  { id: 'legion_storebuygoods', name: '军团商店购买', description: '军团商店批量购买', category: 'store' },
  { id: 'legionStoreBuySkinCoins', name: '皮肤币商店', description: '皮肤币商店购买', category: 'store' },
  { id: 'store_purchase', name: '黑市购买', description: '黑市购买物品', category: 'store', configFields: [{ key: 'purchaseList', type: 'blackMarket', label: '购买商品' }] },
  { id: 'collection_claimfreereward', name: '领取免费奖励', description: '领取收藏免费奖励', category: 'store' },
  { id: 'batchLegacyClaim', name: '功法残卷领取', description: '领取功法残卷挂机奖励', category: 'legacy' },
  { id: 'batchLegacyGiftSendEnhanced', name: '功法残卷赠送', description: '赠送功法残卷给指定玩家', category: 'legacy', configFields: [
    { key: 'recipientId', type: 'text', label: '接收者游戏ID', placeholder: '输入对方游戏角色ID' },
    { key: 'password', type: 'text', label: '安全密码', placeholder: '游戏安全密码' },
    { key: 'quantity', type: 'number', label: '赠送数量', default: 1 }
  ]},
  { id: 'skinChallenge', name: '换皮闯关', description: '换皮闯关BOSS挑战', category: 'daily' },
];

module.exports = {
  boxTypeOptions,
  fishTypeOptions,
  formationOptions,
  bossTimesOptions,
  availableTasks,
};
