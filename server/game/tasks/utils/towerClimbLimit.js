/**
 * 奇峰塔爬塔上限
 * 从参考项目 towerClimbLimit.js 移植
 */

const DEFAULT_WEIRD_TOWER_MAX_CLIMB = 100;

function normalizeWeirdTowerMaxClimb(input) {
  if (input === null || input === undefined || input === '') {
    return DEFAULT_WEIRD_TOWER_MAX_CLIMB;
  }
  const num = typeof input === 'number' ? input : parseInt(input, 10);
  if (isNaN(num) || num < 1) {
    return DEFAULT_WEIRD_TOWER_MAX_CLIMB;
  }
  return Math.min(num, DEFAULT_WEIRD_TOWER_MAX_CLIMB);
}

module.exports = {
  DEFAULT_WEIRD_TOWER_MAX_CLIMB,
  normalizeWeirdTowerMaxClimb,
};
