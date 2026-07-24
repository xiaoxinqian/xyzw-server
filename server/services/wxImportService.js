/**
 * 微信扫码导入服务
 * 代理微信二维码获取、扫码状态轮询、Hortor登录、bin生成
 */

const axios = require('axios');
const { g_utils } = require('../game/bonProtocol');
const { encodePayload, decodePayload } = require('../game/hortorCipher');
const logger = require('../utils/logger');

const WECHAT_QR_URL = 'https://open.weixin.qq.com/connect/app/qrconnect';
const WECHAT_STATUS_URL = 'https://open.weixin.qq.com/connect/l/qrconnect';
const HORTOR_LOGIN_URL = 'https://xxz-xyzw.hortorgames.com/api/hortor/comb-login-server/api/v1/login';

const APPID = 'wxfb0d5667e5cb1c44';
const BUNDLEID = 'com.hortor.games.xyzw';

/**
 * 获取微信二维码
 * 返回 { qrcodeUrl, uuid }
 */
async function getQRCode() {
  const params = {
    appid: APPID,
    bundleid: BUNDLEID,
    scope: 'snsapi_base,snsapi_userinfo,snsapi_friend,snsapi_message',
    state: 'weixin',
  };

  const res = await axios.get(WECHAT_QR_URL, {
    params,
    headers: { 'Accept': 'text/html' },
    timeout: 15000,
    responseType: 'text',
  });

  const html = res.data;

  // 提取二维码图片 URL
  let qrcodeUrl = null;
  const imgMatch = html.match(/<img[^>]*class="auth_qrcode"[^>]*src="([^"]+)"/i);
  if (imgMatch) {
    qrcodeUrl = imgMatch[1];
  } else {
    const m = html.match(/https:\/\/[^"']*qrcode[^"']*/i);
    if (m) qrcodeUrl = m[0];
  }

  if (!qrcodeUrl) {
    throw new Error('未找到二维码图片');
  }

  // 提取 uuid
  const uuid = qrcodeUrl.split('/').pop().split('?')[0];

  return { qrcodeUrl, uuid };
}

/**
 * 查询扫码状态
 * 返回 { status: 'waiting'|'scanned'|'success'|'expired', code?, nickname? }
 */
async function checkScanStatus(uuid) {
  const url = `${WECHAT_STATUS_URL}?uuid=${uuid}&f=url&_=${Date.now()}`;

  const res = await axios.get(url, {
    headers: { 'Accept': '*/*' },
    timeout: 5000,
    responseType: 'text',
  });

  const text = res.data;

  // 405 → 扫码确认成功
  if (text.includes('window.wx_errcode=405')) {
    const codeMatch = text.match(/wx_redirecturl='[^']*code=([a-zA-Z0-9]+)/);
    const nicknameMatch = text.match(/window\.wx_nickname\s*=\s*['"]([^'"]+)['"]/);

    return {
      status: 'success',
      code: codeMatch ? codeMatch[1] : null,
      nickname: nicknameMatch ? nicknameMatch[1] : '',
    };
  }

  // 408 → 已过期
  if (text.includes('window.wx_errcode=408')) {
    return { status: 'expired' };
  }

  // 其他 → 等待中
  return { status: 'waiting' };
}

/**
 * 用 code 调用 Hortor 登录，生成 bin 数据
 * 返回 { binBuffer, serverList }
 */
async function loginWithCode(code) {
  const payload = {
    gameId: 'xyzwapp',
    code,
    gameTp: 'app',
    sysInfo: '{"system":"Android","hortorSDKVersion":"4.0.6-cn","model":"22081212C","brand":"Redmi"}',
    channel: 'android',
    appFrom: 'com.tencent.mm',
    noLogin: '2',
    distinctId: 'DID-a38175b7-14ce-4b36-aa89-3e092ea03ea6',
    state: 'hortor',
    packageName: 'com.hortor.games.xyzw',
    tp: 'app-we',
    signPrint: 'E6:F7:FE:A9:EC:8E:24:D0:4F:2A:32:50:28:78:E1:C5:5E:70:81:13',
  };

  const rawJson = JSON.stringify(payload);
  const encoded = encodePayload(rawJson);

  const loginUrl = `${HORTOR_LOGIN_URL}?gameId=xyzwapp&timestamp=${Date.now()}&version=android-4.2.1-cn-release&cryptVersion=1.1.0&gameTp=app&system=android&deviceUniqueId=DID-0e782e88-2f3b-4f5b-9020-47f5e5a5a026&packageName=com.hortorgames.xyzw`;

  const res = await axios.post(loginUrl, encoded, {
    headers: {
      'Accept': '*/*',
      'Content-Type': 'text/plain; charset=utf-8',
    },
    timeout: 15000,
  });

  const json = res.data;
  if (json.meta?.errCode !== 0) {
    throw new Error('Hortor登录失败: ' + (json.meta?.errMsg || '未知错误'));
  }

  const combUser = json.data?.combUser;
  if (!combUser) {
    throw new Error('登录响应结构异常');
  }

  // 生成 bin 数据
  const binData = {
    platform: 'hortor',
    platformExt: 'mix',
    info: combUser,
    serverId: null,
    scene: 0,
    referrerInfo: '',
  };

  const binBuffer = g_utils.encode(binData);

  return { binBuffer, combUser };
}

/**
 * 获取服务器角色列表
 */
async function getServerRoles(binBuffer) {
  const { getServerList } = require('../game/tokenManager');
  const listStr = await getServerList(binBuffer);
  const parsed = JSON.parse(listStr);
  const roles = Object.values(parsed).sort((a, b) => (b.power || 0) - (a.power || 0));
  return roles;
}

module.exports = {
  getQRCode,
  checkScanStatus,
  loginWithCode,
  getServerRoles,
};
