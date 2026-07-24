/**
 * 上海时区 (UTC+8) 时间工具
 */

const SHANGHAI_OFFSET = 8 * 60; // 分钟

function getShanghaiNow() {
  const now = new Date();
  return new Date(now.getTime() + (SHANGHAI_OFFSET * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
}

function getShanghaiDateStr() {
  return getShanghaiNow().toISOString().slice(0, 10);
}

function getShanghaiTimeStr() {
  const now = getShanghaiNow();
  return now.toTimeString().slice(0, 8);
}

function getShanghaiISO() {
  return getShanghaiNow().toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * 获取上海时间当天的 HH:MM
 */
function getShanghaiHourMin() {
  const now = getShanghaiNow();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * 获取上海时间星期几 (0=周日, 1=周一, ..., 6=周六)
 */
function getShanghaiDayOfWeek() {
  return getShanghaiNow().getDay();
}

/**
 * 检查当前是否在免登录时段
 * 周六 20:00~21:00, 周日 08:00~08:30
 */
function isNoLoginPeriod() {
  const now = getShanghaiNow();
  const day = now.getDay();
  const h = now.getHours();
  const m = now.getMinutes();
  const minutes = h * 60 + m;

  // 周六 20:00~21:00
  if (day === 6 && minutes >= 20 * 60 && minutes < 21 * 60) {
    return true;
  }
  // 周日 08:00~08:30
  if (day === 0 && minutes >= 8 * 60 && minutes < 8 * 60 + 30) {
    return true;
  }
  return false;
}

module.exports = {
  getShanghaiNow,
  getShanghaiDateStr,
  getShanghaiTimeStr,
  getShanghaiISO,
  getShanghaiHourMin,
  getShanghaiDayOfWeek,
  isNoLoginPeriod,
};
