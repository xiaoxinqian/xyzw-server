/**
 * 每日任务执行器
 * 从参考项目 dailyTaskRunner.js 移植，适配 Node.js Worker
 * 核心变更：tokenStore.sendMessageWithPromise(tokenId, cmd, params) → worker.sendMessageWithPromise(cmd, params)
 */

const { getShanghaiISO, isNoLoginPeriod } = require('../utils/time');
const logger = require('../utils/logger');

// 默认任务配置
const DEFAULT_SETTINGS = {
  arenaFormation: 1,
  bossFormation: 1,
  bossTimes: 2,
  claimBottle: true,
  payRecruit: true,
  openBox: true,
  arenaEnable: true,
  claimHangUp: true,
  claimEmail: true,
  blackMarketPurchase: true,
  freeGachaEnable: true,
};

// 每日 BOSS ID 映射（周日~周六）
const DAY_BOSS_MAP = [9904, 9905, 9901, 9902, 9903, 9904, 9905];

function getTodayBossId() {
  // 使用上海时间的星期
  const now = new Date();
  const shanghaiHour = now.getUTCHours() + 8;
  const shanghaiDate = new Date(now);
  if (shanghaiHour >= 24) {
    shanghaiDate.setUTCDate(shanghaiDate.getUTCDate() + 1);
  }
  return DAY_BOSS_MAP[shanghaiDate.getUTCDay()];
}

function isTodayAvailable(statisticsTime) {
  if (!statisticsTime) return true;
  const today = new Date().toDateString();
  // 系统返回的时间戳是秒，转成毫秒
  const recordDate = new Date(statisticsTime * 1000).toDateString();
  return today !== recordDate;
}

function pickArenaTargetId(targets) {
  if (!targets) return null;
  if (Array.isArray(targets)) {
    const candidate = targets[0];
    return candidate?.roleId || candidate?.id || candidate?.targetId;
  }
  const candidate =
    targets?.rankList?.[0] ||
    targets?.roleList?.[0] ||
    targets?.targets?.[0] ||
    targets?.targetList?.[0] ||
    targets?.list?.[0];
  if (candidate) {
    return candidate.roleId || candidate.id || candidate.targetId;
  }
  return targets?.roleId || targets?.id || targets?.targetId;
}

class DailyTaskRunner {
  constructor(worker, settings = {}, onLog = null) {
    this.worker = worker;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.onLog = onLog;
    this.commandDelay = 500;
    this.taskDelay = 500;
  }

  log(message, type = 'info') {
    if (this.onLog) {
      this.onLog({ time: getShanghaiISO(), message, type });
    }
    logger[type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info']('task', message);
  }

  async executeGameCommand(cmd, params = {}, description = '', timeout = 8000) {
    try {
      if (description) this.log(`执行: ${description}`);
      const result = await this.worker.sendMessageWithPromise(cmd, params, timeout);
      await new Promise(r => setTimeout(r, this.commandDelay));
      if (description) this.log(`${description} - 成功`, 'success');
      return result;
    } catch (error) {
      if (description) this.log(`${description} - 失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async switchToFormationIfNeeded(targetFormation, formationName) {
    try {
      this.log(`检查${formationName}配置...`);
      const teamInfo = await this.executeGameCommand('presetteam_getinfo', {}, '获取阵容信息');
      const currentFormation = teamInfo?.presetTeamInfo?.useTeamId;
      this.log(`当前阵容: ${currentFormation}`);

      if (currentFormation === targetFormation) {
        this.log(`当前已是${formationName}${targetFormation}，无需切换`, 'success');
        return false;
      }

      await this.executeGameCommand('presetteam_saveteam', { teamId: targetFormation }, `切换到${formationName}${targetFormation}`);
      this.log(`成功切换到${formationName}${targetFormation}`, 'success');
      return true;
    } catch (error) {
      this.log(`阵容检查失败，尝试强制切换: ${error.message}`, 'warning');
      try {
        await this.executeGameCommand('presetteam_saveteam', { teamId: targetFormation }, `强制切换到${formationName}${targetFormation}`);
        return true;
      } catch (fallbackError) {
        this.log(`强制切换也失败: ${fallbackError.message}`, 'error');
        throw fallbackError;
      }
    }
  }

  async run() {
    // 免登录时段检查
    if (isNoLoginPeriod()) {
      this.log('当前为免登录时段，跳过任务执行', 'warning');
      return { success: false, reason: 'no_login_period' };
    }

    this.log('正在获取角色信息...');
    let roleInfoResp;
    try {
      roleInfoResp = await this.worker.sendMessageWithPromise('role_getroleinfo', {}, 10000);
      this.log('角色信息获取成功', 'success');
    } catch (error) {
      this.log(`获取角色信息失败: ${error.message}`, 'error');
      throw error;
    }

    const roleData = roleInfoResp?.rawData?.role || roleInfoResp?.role;
    if (!roleData) {
      throw new Error('角色数据不存在');
    }

    this.log('开始执行每日任务');

    // 保存当前阵容
    let originalFormation = null;
    try {
      const teamInfo = await this.executeGameCommand('presetteam_getinfo', {}, '获取当前阵容信息');
      originalFormation = teamInfo?.presetTeamInfo?.useTeamId;
    } catch (error) {
      this.log(`读取当前阵容失败: ${error.message}`, 'warning');
    }

    const completedTasks = roleData.dailyTask?.complete ?? {};
    const isTaskCompleted = (taskId) => completedTasks[taskId] === -1;
    const statistics = roleData.statistics ?? {};
    const statisticsTime = roleData.statisticsTime ?? {};

    const taskList = [];

    // 1. 基础任务
    if (!isTaskCompleted(2)) {
      taskList.push({ name: '分享一次游戏', execute: () => this.executeGameCommand('system_mysharecallback', { isSkipShareCard: true, type: 2 }, '分享游戏') });
    }
    if (!isTaskCompleted(3)) {
      taskList.push({ name: '赠送好友金币', execute: () => this.executeGameCommand('friend_batch', {}, '赠送好友金币') });
    }
    if (!isTaskCompleted(4)) {
      taskList.push({ name: '免费招募', execute: () => this.executeGameCommand('hero_recruit', { recruitType: 3, recruitNumber: 1 }, '免费招募') });
      if (this.settings.payRecruit) {
        taskList.push({ name: '付费招募', execute: () => this.executeGameCommand('hero_recruit', { recruitType: 1, recruitNumber: 1 }, '付费招募') });
      }
    }
    if (!isTaskCompleted(6) && isTodayAvailable(statisticsTime['buy:gold'])) {
      for (let i = 0; i < 3; i++) {
        taskList.push({ name: `免费点金 ${i + 1}/3`, execute: () => this.executeGameCommand('system_buygold', { buyNum: 1 }, `免费点金 ${i + 1}`) });
      }
    }
    if (!isTaskCompleted(5) && this.settings.claimHangUp) {
      taskList.push({ name: '领取挂机奖励', execute: () => this.executeGameCommand('system_claimhangupreward', {}, '领取挂机奖励') });
      for (let i = 0; i < 4; i++) {
        taskList.push({ name: `挂机加钟 ${i + 1}/4`, execute: () => this.executeGameCommand('system_mysharecallback', { isSkipShareCard: true, type: 2 }, `挂机加钟 ${i + 1}`) });
      }
    }
    if (!isTaskCompleted(7) && this.settings.openBox) {
      taskList.push({ name: '开启木质宝箱', execute: () => this.executeGameCommand('item_openbox', { itemId: 2001, number: 10 }, '开启木质宝箱10个') });
    }

    // 盐罐
    taskList.push({ name: '停止盐罐计时', execute: () => this.executeGameCommand('bottlehelper_stop', {}, '停止盐罐计时') });
    taskList.push({ name: '开始盐罐计时', execute: () => this.executeGameCommand('bottlehelper_start', {}, '开始盐罐计时') });
    if (!isTaskCompleted(14) && this.settings.claimBottle) {
      taskList.push({ name: '领取盐罐奖励', execute: () => this.executeGameCommand('bottlehelper_claim', {}, '领取盐罐奖励') });
    }

    // 2. 竞技场
    if (!isTaskCompleted(13) && this.settings.arenaEnable) {
      taskList.push({
        name: '竞技场战斗',
        execute: async () => {
          this.log('开始竞技场战斗流程');
          await this.switchToFormationIfNeeded(this.settings.arenaFormation, '竞技场阵容');
          await this.executeGameCommand('arena_startarea', {}, '开始竞技场');
          for (let i = 1; i <= 3; i++) {
            this.log(`竞技场战斗 ${i}/3`);
            try {
              const targets = await this.executeGameCommand('arena_getareatarget', {}, `获取竞技场目标${i}`);
              const targetId = pickArenaTargetId(targets);
              if (targetId) {
                await this.executeGameCommand('fight_startareaarena', { targetId }, `竞技场战斗${i}`, 10000);
              } else {
                this.log(`竞技场战斗${i} - 未找到目标`, 'warning');
              }
            } catch (err) {
              this.log(`竞技场战斗${i} - 获取对手失败: ${err.message}`, 'error');
              break;
            }
            await new Promise(r => setTimeout(r, 1000));
          }
        },
      });
    }

    // 3. BOSS
    if (this.settings.bossTimes > 0) {
      let alreadyLegionBoss = statistics['legion:boss'] ?? 0;
      if (isTodayAvailable(statisticsTime['legion:boss'])) alreadyLegionBoss = 0;
      const remainingLegionBoss = Math.max(this.settings.bossTimes - alreadyLegionBoss, 0);

      if (remainingLegionBoss > 0) {
        taskList.push({ name: '军团BOSS阵容检查', execute: () => this.switchToFormationIfNeeded(this.settings.bossFormation, 'BOSS阵容') });
        for (let i = 0; i < remainingLegionBoss; i++) {
          taskList.push({ name: `军团BOSS ${i + 1}/${remainingLegionBoss}`, execute: () => this.executeGameCommand('fight_startlegionboss', {}, `军团BOSS ${i + 1}`, 12000) });
        }
      }
    }

    const todayBossId = getTodayBossId();
    taskList.push({ name: '每日BOSS阵容检查', execute: () => this.switchToFormationIfNeeded(this.settings.bossFormation, 'BOSS阵容') });
    for (let i = 0; i < 3; i++) {
      taskList.push({ name: `每日BOSS ${i + 1}/3`, execute: () => this.executeGameCommand('fight_startboss', { bossId: todayBossId }, `每日BOSS ${i + 1}`, 12000) });
    }

    // 4. 固定奖励
    const fixedRewards = [
      { name: '福利签到', cmd: 'system_signinreward' },
      { name: '俱乐部', cmd: 'legion_signin' },
      { name: '领取每日礼包', cmd: 'discount_claimreward' },
      { name: '领取每日免费奖励', cmd: 'collection_claimfreereward' },
      { name: '领取免费礼包', cmd: 'card_claimreward' },
      { name: '领取永久卡礼包', cmd: 'card_claimreward', params: { cardId: 4003 } },
    ];
    if (this.settings.claimEmail) {
      fixedRewards.push({ name: '领取邮件奖励', cmd: 'mail_claimallattachment' });
    }
    fixedRewards.forEach(reward => {
      taskList.push({ name: reward.name, execute: () => this.executeGameCommand(reward.cmd, reward.params || {}, reward.name) });
    });

    taskList.push({ name: '领取珍宝阁礼包', execute: () => this.executeGameCommand('collection_goodslist', {}, '领取珍宝阁礼包') });
    taskList.push({ name: '领取珍宝阁免费礼包', execute: () => this.executeGameCommand('collection_claimfreereward', {}, '领取珍宝阁免费礼包') });

    if (this.settings.freeGachaEnable !== false && isTodayAvailable(statisticsTime['gacha:free'])) {
      taskList.push({ name: '免费扭蛋', execute: () => this.executeGameCommand('gacha_drawreward', { num: 1, isGroup: false }, '免费扭蛋') });
    }

    // 5. 免费活动
    if (isTodayAvailable(statistics['artifact:normal:lottery:time'])) {
      for (let i = 0; i < 3; i++) {
        taskList.push({ name: `免费钓鱼 ${i + 1}/3`, execute: () => this.executeGameCommand('artifact_lottery', { lotteryNumber: 1, newFree: true, type: 1 }, `免费钓鱼 ${i + 1}`) });
      }
    }

    const kingdoms = ['魏国', '蜀国', '吴国', '群雄'];
    for (let gid = 1; gid <= 4; gid++) {
      if (isTodayAvailable(statisticsTime[`genie:daily:free:${gid}`])) {
        taskList.push({ name: `${kingdoms[gid - 1]}灯神免费扫荡`, execute: () => this.executeGameCommand('genie_sweep', { genieId: gid }, `${kingdoms[gid - 1]}灯神免费扫荡`) });
      }
    }

    for (let i = 0; i < 3; i++) {
      taskList.push({ name: `领取免费扫荡卷 ${i + 1}/3`, execute: () => this.executeGameCommand('genie_buysweep', {}, `领取免费扫荡卷 ${i + 1}`) });
    }

    // 6. 黑市
    if (!isTaskCompleted(12) && this.settings.blackMarketPurchase) {
      taskList.push({ name: '黑市购买1次物品', execute: () => this.executeGameCommand('store_purchase', { goodsId: 1 }, '黑市购买1次物品') });
    }

    // 咸王梦境（周日、一、三、四）
    const dayOfWeek = new Date().getDay();
    if ([0, 1, 3, 4].includes(dayOfWeek)) {
      taskList.push({ name: '咸王梦境', execute: () => this.executeGameCommand('dungeon_selecthero', { battleTeam: { 0: 107 } }, '咸王梦境') });
    }

    // 深海灯神（周一）
    if (dayOfWeek === 1 && isTodayAvailable(statisticsTime['genie:daily:free:5'])) {
      taskList.push({ name: '深海灯神', execute: () => this.executeGameCommand('genie_sweep', { genieId: 5, sweepCnt: 1 }, '深海灯神') });
    }

    // 阵容还原
    if (originalFormation) {
      taskList.push({ name: '阵容还原', execute: () => this.switchToFormationIfNeeded(originalFormation, '初始阵容') });
    }

    // 7. 任务奖励
    for (let taskId = 1; taskId <= 10; taskId++) {
      taskList.push({ name: `领取任务奖励${taskId}`, execute: () => this.executeGameCommand('task_claimdailypoint', { taskId }, `领取任务奖励${taskId}`, 5000) });
    }
    taskList.push({ name: '领取日常任务奖励', execute: () => this.executeGameCommand('task_claimdailyreward', {}, '领取日常任务奖励') });
    taskList.push({ name: '领取周常任务奖励', execute: () => this.executeGameCommand('task_claimweekreward', {}, '领取周常任务奖励') });
    taskList.push({ name: '领取通行证奖励', execute: () => this.executeGameCommand('activity_recyclewarorderrewardclaim', { actId: 1 }, '领取通行证奖励') });

    // 执行所有任务
    const totalTasks = taskList.length;
    this.log(`共有 ${totalTasks} 个任务待执行`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < taskList.length; i++) {
      const task = taskList[i];
      try {
        await task.execute();
        successCount++;
        await new Promise(r => setTimeout(r, this.taskDelay));
      } catch (error) {
        this.log(`任务执行失败: ${task.name} - ${error.message}`, 'error');
        failCount++;
      }
    }

    this.log(`所有任务执行完成: 成功 ${successCount}, 失败 ${failCount}`, 'success');
    return { success: true, total: totalTasks, successCount, failCount };
  }
}

/**
 * 瓶子（盐罐）重置任务
 * 间隔执行：查询瓶子状态 → 重置 → 领取奖励 → 循环
 * 适配参考项目 tasksBottle.js 的 resetBottles 逻辑
 */
class BottleResetTask {
  constructor(worker, onLog = null) {
    this.worker = worker;
    this.onLog = onLog;
    this.commandDelay = 500;
  }

  log(message, type = 'info') {
    if (this.onLog) {
      this.onLog({ time: getShanghaiISO(), message, type });
    }
    logger[type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info']('task', message);
  }

  async run() {
    this.log('开始执行瓶子重置任务');

    try {
      // 1. 停止盐罐计时
      this.log('停止盐罐计时...');
      await this.worker.sendMessageWithPromise('bottlehelper_stop', {}, 8000);
      await new Promise(r => setTimeout(r, this.commandDelay));

      // 2. 重新开始盐罐计时（重置）
      this.log('重新开始盐罐计时...');
      await this.worker.sendMessageWithPromise('bottlehelper_start', {}, 8000);
      await new Promise(r => setTimeout(r, this.commandDelay));

      // 3. 领取盐罐奖励
      this.log('领取盐罐奖励...');
      try {
        const claimResult = await this.worker.sendMessageWithPromise('bottlehelper_claim', {}, 8000);
        await new Promise(r => setTimeout(r, this.commandDelay));
        this.log('盐罐奖励领取成功', 'success');
        return { success: true, message: '瓶子重置+领取完成', claimResult };
      } catch (claimErr) {
        this.log(`领取盐罐奖励失败（可能无奖励可领）: ${claimErr.message}`, 'warning');
        return { success: true, message: '瓶子重置完成（奖励领取跳过）' };
      }
    } catch (error) {
      this.log(`瓶子重置任务失败: ${error.message}`, 'error');
      throw error;
    }
  }
}

module.exports = { DailyTaskRunner, BottleResetTask, DEFAULT_SETTINGS };
