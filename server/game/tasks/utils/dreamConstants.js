/**
 * 梦境相关常量
 * 从参考项目 dreamConstants.js 移植
 */

// 商人配置（含商品名称）
const merchantConfig = {
  1: {
    name: '初级商人',
    items: ['进阶石', '精铁', '木质宝箱', '青铜宝箱', '普通鱼竿', '咸神门票', '咸神火把'],
  },
  2: {
    name: '中级商人',
    items: ['梦魇晶石', '进阶石', '精铁', '黄金宝箱', '黄金鱼竿', '招募令', '橙将碎片', '紫将碎片'],
  },
  3: {
    name: '高级商人',
    items: ['梦魇晶石', '铂金宝箱', '黄金鱼竿', '招募令', '红将碎片', '橙将碎片', '红将碎片', '普通鱼竿'],
  },
};

// 金币购买的商品配置 [商人ID][商品索引]
const goldItemsConfig = {
  1: [5, 6],       // 初级商人: 咸神门票, 咸神火把
  2: [6, 7],       // 中级商人: 橙将碎片, 紫将碎片
  3: [5, 6, 7],    // 高级商人: 橙将碎片, 红将碎片, 普通鱼竿
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
