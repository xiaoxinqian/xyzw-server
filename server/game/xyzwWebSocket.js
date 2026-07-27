/**
 * XyzwWebSocketClient - Node.js 版本
 * 从参考项目 xyzwWebSocket.js 移植
 * 适配：浏览器 WebSocket → ws 包，Blob → Buffer
 */

const WebSocket = require('ws');
const { g_utils, bon, getEnc, encode, parse } = require('./bonProtocol');

/**
 * 命令注册表
 */
class CommandRegistry {
  constructor(encoder, enc) {
    this.encoder = encoder;
    this.enc = enc;
    this.commands = new Map();
  }

  register(cmd, defaultBody = {}) {
    this.commands.set(cmd, (ack = 0, seq = 0, params = {}) => ({
      cmd,
      ack,
      seq,
      time: Date.now(),
      body: this.encoder?.bon?.encode
        ? this.encoder.bon.encode({ ...defaultBody, ...params })
        : { ...defaultBody, ...params },
    }));
    return this;
  }

  registerHeartbeat() {
    this.commands.set('heart_beat', (ack, seq) => ({
      cmd: '_sys/ack',
      ack,
      seq,
      time: Date.now(),
      body: {},
    }));
    return this;
  }

  encodePacket(raw) {
    if (this.encoder?.encode && this.enc) {
      return this.encoder.encode(raw, this.enc);
    }
    return JSON.stringify(raw);
  }

  build(cmd, ack, seq, params) {
    const fn = this.commands.get(cmd);
    if (!fn) throw new Error(`Unknown cmd: ${cmd}`);
    return fn(ack, seq, params);
  }
}

function registerDefaultCommands(reg) {
  reg
    .registerHeartbeat()
    .register('role_getroleinfo', {
      clientVersion: '2.21.2-fa918e1997301834-wx',
      inviteUid: 0,
      platform: 'hortor',
      platformExt: 'mix',
      scene: '',
    })
    .register('system_getdatabundlever', { isAudit: false })
    .register('system_buygold', { buyNum: 1 })
    .register('system_claimhangupreward')
    .register('system_signinreward')
    .register('system_mysharecallback', { isSkipShareCard: true, type: 2 })
    .register('system_custom', { key: '', value: 0 })
    .register('task_claimdailypoint', { taskId: 1 })
    .register('task_claimdailyreward', { rewardId: 0 })
    .register('task_claimweekreward', { rewardId: 0 })
    .register('friend_batch', { friendId: 0 })
    .register('hero_recruit', { byClub: false, recruitNumber: 1, recruitType: 3 })
    .register('item_openbox', { itemId: 2001, number: 10 })
    .register('item_batchclaimboxpointreward')
    .register('item_openpack')
    .register('rank_getserverrank')
    .register('arena_startarea')
    .register('fight_startlevel')
    .register('arena_getareatarget', { refresh: false })
    .register('arena_getarearank')
    .register('store_goodslist', { storeId: 1 })
    .register('store_buy', { goodsId: 1 })
    .register('store_refresh', { storeId: 1 })
    .register('legion_getinfo')
    .register('legion_signin')
    .register('legion_getwarrank')
    .register('legionwar_getdetails')
    .register('legion_storebuygoods')
    .register('legion_kickout')
    .register('legion_applylist')
    .register('legion_approveapply')
    .register('legion_refuseapply')
    .register('legion_agree')
    .register('legion_ignore')
    .register('legion_research')
    .register('legion_resetresearch')
    .register('legion_getinfobyid')
    .register('legion_getarearank')
    .register('saltroad_getsaltroadwartotalrank')
    .register('legionwar_getgoldmonthwarrank')
    .register('legion_getopponent')
    .register('legion_getbattlefield')
    .register('legion_claimpayloadtask')
    .register('legion_claimpayloadtaskprogress')
    .register('saltroad_getwartype')
    .register('saltroad_getsaltroadwargrouprank')
    .register('league_getbattlefield')
    .register('league_getgroupopponent')
    .register('legion_signup')
    .register('mail_getlist', { category: [0, 4, 5], lastId: 0, size: 60 })
    .register('mail_claimallattachment', { category: 0 })
    .register('mail_getmtlinfo')
    .register('mail_getmtlshortinfo')
    .register('study_startgame')
    .register('study_answer')
    .register('study_claimreward', { rewardId: 1 })
    .register('fight_starttower')
    .register('fight_startboss')
    .register('fight_startlegionboss')
    .register('fight_startdungeon')
    .register('fight_startpvp')
    .register('evotower_getinfo')
    .register('evotower_fight')
    .register('evotower_getlegionjoinmembers')
    .register('evotower_readyfight')
    .register('evotower_claimreward')
    .register('mergebox_getinfo')
    .register('mergebox_claimfreeenergy')
    .register('mergebox_openbox')
    .register('mergebox_automergeitem', { actType: 1 })
    .register('mergebox_mergeitem', { actType: 1 })
    .register('mergebox_claimcostprogress', { actType: 1 })
    .register('mergebox_claimmergeprogress', { actType: 1 })
    .register('evotower_claimtask', { taskId: 1 })
    .register('bottlehelper_claim')
    .register('bottlehelper_start', { bottleType: -1 })
    .register('bottlehelper_stop', { bottleType: -1 })
    .register('legionmatch_rolesignup')
    .register('artifact_lottery', { lotteryNumber: 1, newFree: true, type: 1 })
    .register('artifact_exchange')
    .register('genie_sweep', { genieId: 1 })
    .register('genie_buysweep')
    .register('discount_claimreward', { discountId: 1 })
    .register('collection_claimfreereward')
    .register('collection_goodslist')
    .register('card_claimreward', { cardId: 1 })
    .register('tower_getinfo')
    .register('tower_claimreward')
    .register('presetteam_getinfo')
    .register('presetteam_setteam')
    .register('presetteam_saveteam', { teamId: 1 })
    .register('role_gettargetteam')
    .register('hero_exchange')
    .register('hero_gointobattle')
    .register('hero_gobackbattle')
    .register('artifact_load')
    .register('artifact_unload')
    .register('lordweapon_changedefaultweapon')
    .register('pearl_replaceskill')
    .register('pearl_exchangeskill')
    .register('pearl_unloadskill')
    .register('hero_heroupgradelevel')
    .register('hero_heroupgradeorder')
    .register('hero_rebirth')
    .register('hero_heroupgradestar')
    .register('book_upgrade')
    .register('book_claimpointreward')
    .register('rank_getroleinfo')
    .register('nightmare_getroleinfo')
    .register('dungeon_selecthero')
    .register('bosstower_gethelprank')
    .register('dungeon_buymerchant')
    .register('activity_get')
    .register('activity_recyclewarorderrewardclaim')
    .register('legion_getpayloadtask')
    .register('legion_getpayloadkillrecord')
    .register('legion_getpayloadbf')
    .register('legion_getpayloadrecord')
    .register('warguess_getrank')
    .register('warguess_startguess')
    .register('warguess_getguesscoinreward')
    .register('legion_payloadsignup')
    .register('collection_claimfreereward')
    .register('collection_goodslist')
    .register('gacha_drawreward', { num: 1, isGroup: false })
    .register('car_getrolecar')
    .register('car_refresh', { carId: 0 })
    .register('car_claim', { carId: 0 })
    .register('car_send', { carId: 0, helperId: 0, text: '' })
    .register('car_getmemberhelpingcnt')
    .register('car_getmemberrank')
    .register('car_research')
    .register('car_claimpartconsumereward')
    .register('legacy_getinfo')
    .register('legacy_claimhangup')
    .register('legacy_gift_getlist')
    .register('legacy_gift_send', { recipientId: 0, itemId: 0, quantity: 0 })
    .register('legacy_gift_received')
    .register('role_commitpassword', { password: '', passwordType: 1 })
    .register('legacy_sendgift', { itemCnt: 0, legacyUIds: [], targetId: 0 })
    .register('equipment_confirm', { heroId: 0, part: 0, quenchId: 0, quenches: {} })
    .register('equipment_quench', { heroId: 0, part: 0, quenchId: 0, quenches: {}, seed: 0, skipOrange: false })
    .register('equipment_updatequenchlock', { heroId: 0, part: 0, slot: 0, isLocked: false })
    .register('matchteam_getroleteaminfo')
    .register('bosstower_getinfo')
    .register('bosstower_startboss')
    .register('bosstower_startbox')
    .register('discount_getdiscountinfo')
    .register('towers_getinfo')
    .register('towers_start')
    .register('towers_fight')
    .register('system_sendchatmessage')
    .register('fight_startareaarena', { battleVersion: 240476 })
    .register('fight_startdungeon')
    .register('system_buygold')
    .register('store_purchase')
    .register('presetteam_getinfo')
    .register('presetteam_setteam');

  return reg;
}

/**
 * Node.js 版 XyzwWebSocketClient
 */
class XyzwWebSocketClient {
  constructor({ url, utils, heartbeatMs = 5000 }) {
    this.url = url;
    this.utils = utils || g_utils;
    this.enc = this.utils?.getEnc ? this.utils.getEnc('auto') : undefined;

    this.socket = null;
    this.ack = 0;
    this.seq = 0;
    this.sendQueue = [];
    this.sendQueueTimer = null;
    this.heartbeatTimer = null;
    this.heartbeatInterval = heartbeatMs;

    this.connected = false;
    this.isReconnecting = false;

    this.promises = Object.create(null);
    this.registry = registerDefaultCommands(
      new CommandRegistry(this.utils, this.enc)
    );

    this.onConnect = null;
    this.onDisconnect = null;
    this.onError = null;
    this.messageListener = null;
  }

  init() {
    this.socket = new WebSocket(this.url, {
      headers: {
        Origin: 'https://xyzw.hortor.net',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; 22081212C) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      perMessageDeflate: false,
    });

    this.socket.onopen = () => {
      this.connected = true;
      this._setupHeartbeat();
      this._processQueueLoop();
      if (this.onConnect) this.onConnect();
    };

    this.socket.onmessage = (evt) => {
      try {
        let packet;
        const data = evt.data;

        if (typeof data === 'string') {
          packet = JSON.parse(data);
        } else if (Buffer.isBuffer(data)) {
          // Node.js ws: 二进制数据是 Buffer
          packet = this.utils?.parse
            ? this.utils.parse(data, 'auto')
            : data;
        } else if (data instanceof ArrayBuffer) {
          packet = this.utils?.parse
            ? this.utils.parse(data, 'auto')
            : data;
        }

        // 处理 Promise 响应
        if (packet && packet.resp !== undefined && this.promises[packet.resp]) {
          const p = this.promises[packet.resp];
          delete this.promises[packet.resp];
          clearTimeout(p.timer);

          if (packet.error) {
            p.reject(new Error(packet.error));
          } else {
            p.resolve(packet);
          }
        }

        // 更新 ack
        if (packet && packet.seq) {
          this.ack = packet.seq;
        }

        // 消息监听器
        if (this.messageListener && packet) {
          this.messageListener(packet);
        }
      } catch (err) {
        console.error('WebSocket 消息处理错误:', err.message);
      }
    };

    this.socket.onclose = (evt) => {
      this.connected = false;
      this._clearTimers();

      // 清理所有 pending promises
      for (const seq in this.promises) {
        this.promises[seq].reject(new Error('连接已关闭'));
        clearTimeout(this.promises[seq].timer);
        delete this.promises[seq];
      }

      if (this.onDisconnect) this.onDisconnect(evt);
    };

    this.socket.onerror = (error) => {
      if (this.onError) this.onError(error);
    };
  }

  reconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    this.disconnect();

    setTimeout(() => {
      try { this.init(); } finally {
        setTimeout(() => { this.isReconnecting = false; }, 2000);
      }
    }, 1000);
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
    this._clearTimers();
  }

  send(cmd, params = {}, options = {}) {
    if (!this.connected) {
      // 入队等待重连
    }

    const assignedSeq =
      options.seq !== undefined
        ? options.seq
        : cmd === 'heart_beat'
          ? 0
          : ++this.seq;

    const task = {
      cmd,
      params,
      seq: assignedSeq,
      respKey: options.respKey || cmd,
      sleep: options.sleep || 0,
      onSent: options.onSent,
    };

    this.sendQueue.push(task);
    return task;
  }

  sendWithPromise(cmd, params = {}, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const requestSeq = ++this.seq;

      this.promises[requestSeq] = {
        resolve,
        reject,
        originalCmd: cmd,
        timer: setTimeout(() => {
          delete this.promises[requestSeq];
          reject(new Error(`请求超时: ${cmd} (${timeoutMs}ms)`));
        }, timeoutMs),
      };

      this.send(cmd, params, { seq: requestSeq });
    });
  }

  sendHeartbeat() {
    this.send('heart_beat', {}, { respKey: '_sys/ack' });
  }

  setMessageListener(fn) {
    this.messageListener = fn;
  }

  _setupHeartbeat() {
    setTimeout(() => {
      if (this.connected && this.socket?.readyState === WebSocket.OPEN) {
        this.sendHeartbeat();
      }
    }, 3000);

    this.heartbeatTimer = setInterval(() => {
      if (this.connected && this.socket?.readyState === WebSocket.OPEN) {
        this.sendHeartbeat();
      }
    }, this.heartbeatInterval);
  }

  _processQueueLoop() {
    if (this.sendQueueTimer) clearInterval(this.sendQueueTimer);

    this.sendQueueTimer = setInterval(async () => {
      if (!this.sendQueue.length) return;
      if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) return;

      const task = this.sendQueue.shift();
      if (!task) return;

      try {
        const raw = this.registry.build(task.cmd, this.ack, task.seq, task.params);
        const bin = this.registry.encodePacket(raw);

        // ws 包支持发送 Buffer 或 ArrayBuffer
        if (bin instanceof ArrayBuffer) {
          this.socket?.send(Buffer.from(bin));
        } else if (bin instanceof Uint8Array) {
          this.socket?.send(Buffer.from(bin));
        } else {
          this.socket?.send(bin);
        }

        if (task.onSent) task.onSent({ respKey: task.respKey, cmd: task.cmd, seq: raw?.seq ?? task.seq });
        if (task.sleep) await new Promise(r => setTimeout(r, task.sleep));
      } catch (error) {
        console.error(`发送消息失败: ${task.cmd}`, error.message);
      }
    }, 50);
  }

  _clearTimers() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.sendQueueTimer) { clearInterval(this.sendQueueTimer); this.sendQueueTimer = null; }
  }
}

module.exports = { XyzwWebSocketClient, CommandRegistry, registerDefaultCommands };
