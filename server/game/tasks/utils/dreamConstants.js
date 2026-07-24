/**
 * 梦境相关常量
 * 从参考项目 dreamConstants.js 移植
 */

// 商店配置：3个商人等级
const merchantConfig = [
  { id: 1, name: '初级商人', goodsCount: 4 },
  { id: 2, name: '中级商人', goodsCount: 5 },
  { id: 3, name: '高级商人', goodsCount: 6 },
];

// 金币物品配置（每个商人可买的金币物品索引）
const goldItemsConfig = {
  1: [0, 1, 2, 3],       // 初级商人
  2: [0, 1, 2, 3, 4],    // 中级商人
  3: [0, 1, 2, 3, 4, 5], // 高级商人
};

/**
 * 梦境是否开放
 * 周日(0)、周一(1)、周三(3)、周四(4)开放
 */
function isDungeonOpen(date = new Date()) {
  const day = date.getDay();
  return [0, 1, 3, 4].includes(day);
}

module.exports = {
  merchantConfig,
  goldItemsConfig,
  isDungeonOpen,
};
