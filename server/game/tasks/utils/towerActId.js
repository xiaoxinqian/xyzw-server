/**
 * 爬塔活动ID计算
 * 从参考项目 towerActId.js 移植
 */

const FRIDAY_DAY = 5;
const DAYS_PER_WEEK = 7;

/**
 * 根据当前日期计算爬塔活动ID
 * 以最近的周五为基准，生成 YYYYMMDD1 格式的ID
 */
function getTowerActId(date = new Date()) {
  const day = date.getDay();
  let diff = (day - FRIDAY_DAY + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const friday = new Date(date);
  friday.setDate(date.getDate() - diff);

  const year = String(friday.getFullYear()).slice(-2); // 2位年份，如 25
  const month = String(friday.getMonth() + 1).padStart(2, '0');
  const day2 = String(friday.getDate()).padStart(2, '0');

  return Number(`${year}${month}${day2}1`);
}

module.exports = { getTowerActId };
