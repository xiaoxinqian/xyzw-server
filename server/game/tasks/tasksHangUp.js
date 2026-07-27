/**
 * 挂机任务工厂
 * 从参考项目 tasksHangUp.js 移植
 */

const { getShanghaiISO } = require('../../utils/time');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 领取挂机奖励 + 加钟4次
 */
function createClaimHangUpRewards(deps) {
  return async function claimHangUpRewards() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始领取挂机奖励...');
    try {
      // 领取挂机奖励
      log('领取挂机奖励...');
      await worker.sendMessageWithPromise('system_claimhangupreward', {}, 8000);
      await sleep(500);
      log('挂机奖励领取成功', 'success');

      // 加钟4次
      for (let i = 0; i < 4; i++) {
        log(`挂机加钟 ${i + 1}/4...`);
        try {
          await worker.sendMessageWithPromise('system_mysharecallback', { isSkipShareCard: true, type: 2 }, 8000);
          await sleep(500);
          log(`挂机加钟 ${i + 1} 成功`, 'success');
        } catch (e) {
          log(`挂机加钟 ${i + 1} 失败: ${e.message}`, 'warning');
        }
      }

      log('挂机奖励任务完成', 'success');
      return { success: true, message: '挂机奖励+加钟完成' };
    } catch (error) {
      log(`挂机奖励任务失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 仅挂机加钟
 */
function createBatchAddHangUpTime(deps) {
  return async function batchAddHangUpTime() {
    const { worker, onLog, config = {} } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });
    const times = config.times || 4;

    log(`开始挂机加钟 ${times} 次...`);
    try {
      for (let i = 0; i < times; i++) {
        log(`挂机加钟 ${i + 1}/${times}...`);
        try {
          await worker.sendMessageWithPromise('system_mysharecallback', { isSkipShareCard: true, type: 2 }, 8000);
          await sleep(500);
          log(`挂机加钟 ${i + 1} 成功`, 'success');
        } catch (e) {
          log(`挂机加钟 ${i + 1} 失败: ${e.message}`, 'warning');
        }
      }
      log('挂机加钟完成', 'success');
      return { success: true, message: `挂机加钟 ${times} 次完成` };
    } catch (error) {
      log(`挂机加钟失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 批量学习技能
 */
let _answerCache = null;
function loadAnswerBank() {
  if (_answerCache) return _answerCache;
  try {
    _answerCache = require('./utils/answer.json');
  } catch {
    _answerCache = [];
  }
  return _answerCache;
}

function findAnswer(questionText) {
  const bank = loadAnswerBank();
  if (!bank || !bank.length || !questionText) return null;
  const cleanQ = questionText.replace(/\s+/g, '').toLowerCase();
  // 精确匹配优先
  for (const item of bank) {
    if (!item.name || item.name.trim() === '' || !item.value) continue;
    const cleanDB = item.name.replace(/\s+/g, '').toLowerCase();
    if (cleanQ === cleanDB) return item.value;
  }
  // 模糊匹配 fallback（至少5字才模糊匹配，避免空串匹配所有）
  for (const item of bank) {
    if (!item.name || item.name.trim() === '' || !item.value) continue;
    const cleanDB = item.name.replace(/\s+/g, '').toLowerCase();
    if (cleanDB.length >= 5 && (cleanQ.includes(cleanDB) || cleanDB.includes(cleanQ))) {
      return item.value;
    }
  }
  return null;
}

function createBatchStudy(deps) {
  return async function batchStudy() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始答题...');
    try {
      // 发送开始答题命令
      const startResp = await worker.sendMessageWithPromise('study_startgame', {}, 10000);
      await sleep(500);

      const rawData = startResp?.rawData || startResp;
      const questionList = rawData?.questionList || rawData?.body?.questionList || [];
      const studyId = rawData?.role?.study?.id || rawData?.body?.role?.study?.id || rawData?.studyId;

      if (!questionList || !questionList.length) {
        log('未获取到题目列表，可能今日已答题', 'warning');
        return { success: true, message: '无题目可答' };
      }

      log(`获取到 ${questionList.length} 道题目，studyId: ${studyId}`);

      let answered = 0;
      for (let i = 0; i < questionList.length; i++) {
        const q = questionList[i];
        const questionText = q.question || q.title || '';
        const questionId = q.id || q.questionId;

        let answer = findAnswer(questionText);
        if (answer === null) {
          answer = 1; // 默认选1
          log(`题目 ${i + 1}: 未找到答案，使用默认选项 ${answer}`, 'warning');
        } else {
          log(`题目 ${i + 1}: 找到答案 ${answer}`);
        }

        try {
          await worker.sendMessageWithPromise('study_answer', {
            id: studyId,
            option: [answer],
            questionId: [questionId],
          }, 8000);
          answered++;
          if (i < questionList.length - 1) await sleep(300);
        } catch (e) {
          log(`题目 ${i + 1} 提交答案失败: ${e.message}`, 'warning');
        }
      }

      log(`答题完成: ${answered}/${questionList.length}，开始领取奖励...`);

      // 领取奖励 (1-10)
      await sleep(1500);
      for (let rewardId = 1; rewardId <= 10; rewardId++) {
        try {
          await worker.sendMessageWithPromise('study_claimreward', { rewardId }, 5000);
          await sleep(200);
        } catch (e) {
          // 部分奖励可能不可领，忽略
        }
      }

      log('答题及奖励领取完成', 'success');
      return { success: true, answered, total: questionList.length };
    } catch (error) {
      log(`答题失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

/**
 * 俱乐部签到
 */
function createBatchClubSign(deps) {
  return async function batchclubsign() {
    const { worker, onLog } = deps;
    const log = (msg, type = 'info') => onLog?.({ time: getShanghaiISO(), message: msg, type });

    log('开始俱乐部签到...');
    try {
      await worker.sendMessageWithPromise('legion_signin', {}, 8000);
      await sleep(500);
      log('俱乐部签到成功', 'success');
      return { success: true, message: '俱乐部签到完成' };
    } catch (error) {
      log(`俱乐部签到失败: ${error.message}`, 'error');
      throw error;
    }
  };
}

module.exports = {
  createClaimHangUpRewards,
  createBatchAddHangUpTime,
  createBatchStudy,
  createBatchClubSign,
};
