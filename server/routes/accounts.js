const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authRequired, adminRequired } = require('../middleware/auth');
const { get, all, run } = require('../database/db');
const accountService = require('../services/accountService');
const wxImport = require('../services/wxImportService');
const { transformToken, getServerList } = require('../game/tokenManager');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

router.use(authRequired);

// 列出账号
router.get('/', (req, res) => {
  const accounts = accountService.listAccounts(req.user.userId, req.user.role);
  res.json({ success: true, data: accounts });
});

// 获取单个账号详情
router.get('/:id', (req, res) => {
  const account = accountService.getAccount(req.params.id, req.user.userId, req.user.role);
  if (!account) {
    return res.status(404).json({ success: false, message: '账号不存在' });
  }
  // 不返回敏感字段
  delete account.bin_data;
  delete account.token;
  res.json({ success: true, data: account });
});

// 预览 bin 文件中的角色列表（不导入）
router.post('/preview-bin-roles', upload.single('binFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: '请上传 bin 文件' });
    const roles = await accountService.previewBinRoles(req.file.buffer);
    res.json({ success: true, data: roles });
  } catch (err) {
    logger.error('account', `预览角色列表失败: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 通过 bin 文件上传导入账号（支持多账号）
router.post('/import-bin-file', upload.single('binFile'), async (req, res) => {
  try {
    const name = req.body.name || '';  // 选填，留空自动生成 区服_角色名
    if (!req.file) return res.status(400).json({ success: false, message: '请上传 bin 文件' });

    const binBuffer = req.file.buffer;
    const options = {};
    if (req.body.serverId) options.serverId = parseInt(req.body.serverId);
    if (req.body.selectedRoles) {
      try { options.selectedRoles = JSON.parse(req.body.selectedRoles); } catch (e) {}
    }
    const result = await accountService.importByBin(req.user.userId, name, binBuffer, 'bin', options);
    res.json(result);
  } catch (err) {
    logger.error('account', `bin文件导入异常: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 通过 bin 数据导入账号（JSON base64 方式，支持多账号）
router.post('/import-bin', (req, res) => {
  const { name, binData, options = {} } = req.body;
  if (!name || !binData) {
    return res.status(400).json({ success: false, message: '名称和 bin 数据必填' });
  }

  // base64 → Buffer
  const binBuffer = Buffer.from(binData, 'base64');

  accountService.importByBin(req.user.userId, name, binBuffer, 'bin', options)
    .then(result => {
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    })
    .catch(err => {
      logger.error('account', `bin导入异常: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    });
});

// 获取账号绑定的任务列表
router.get('/:id/tasks', (req, res) => {
  const account = accountService.getAccount(req.params.id, req.user.userId, req.user.role);
  if (!account) return res.status(404).json({ success: false, message: '账号不存在' });

  const tasks = all('SELECT id, name, task_type, schedule_type, execute_time, enabled, account_ids FROM tasks ORDER BY created_at');
  const data = tasks.map(t => {
    let ids = [];
    try { ids = JSON.parse(t.account_ids || '[]'); } catch {}
    return { id: t.id, name: t.name, task_type: t.task_type, schedule_type: t.schedule_type, execute_time: t.execute_time, enabled: t.enabled, bound: ids.includes(req.params.id) };
  });
  res.json({ success: true, data });
});

// 修改账号绑定的任务列表
router.put('/:id/tasks', (req, res) => {
  const account = accountService.getAccount(req.params.id, req.user.userId, req.user.role);
  if (!account) return res.status(404).json({ success: false, message: '账号不存在' });

  const { taskIds } = req.body; // array of task IDs to bind
  if (!Array.isArray(taskIds)) return res.status(400).json({ success: false, message: 'taskIds 必须是数组' });

  const accountId = req.params.id;
  const now = new Date().toISOString();
  const tasks = all('SELECT id, account_ids FROM tasks');
  const taskIdSet = new Set(taskIds);

  for (const t of tasks) {
    let ids = [];
    try { ids = JSON.parse(t.account_ids || '[]'); } catch {}
    const wasBound = ids.includes(accountId);
    const shouldBound = taskIdSet.has(t.id);

    if (wasBound && !shouldBound) {
      // 移除
      const filtered = ids.filter(id => id !== accountId);
      run('UPDATE tasks SET account_ids = ?, updated_at = ? WHERE id = ?', [JSON.stringify(filtered), now, t.id]);
    } else if (!wasBound && shouldBound) {
      // 添加
      ids.push(accountId);
      run('UPDATE tasks SET account_ids = ?, updated_at = ? WHERE id = ?', [JSON.stringify(ids), now, t.id]);
    }
  }

  res.json({ success: true, message: `已更新账号任务绑定 (${taskIds.length}个任务)` });
});

// 刷新 token
router.post('/:id/refresh-token', (req, res) => {
  accountService.refreshToken(req.params.id, req.user.userId, req.user.role)
    .then(result => {
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    })
    .catch(err => {
      res.status(500).json({ success: false, message: err.message });
    });
});

// 更新账号
router.put('/:id', (req, res) => {
  const { name } = req.body;
  const account = accountService.getAccount(req.params.id, req.user.userId, req.user.role);
  if (!account) {
    return res.status(404).json({ success: false, message: '账号不存在' });
  }

  if (name) {
    run('UPDATE game_accounts SET name = ?, updated_at = datetime("now") WHERE id = ?', [name, account.id]);
  }

  res.json({ success: true });
});

// 软删除账号
router.delete('/:id', (req, res) => {
  const result = accountService.deleteAccount(req.params.id, req.user.userId, req.user.role);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

// === 微信扫码导入 ===

// 获取微信二维码
router.get('/wx-qrcode', async (req, res) => {
  try {
    const result = await wxImport.getQRCode();
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('account', `获取微信二维码失败: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 轮询扫码状态
router.get('/wx-scan-status', async (req, res) => {
  try {
    const { uuid } = req.query;
    if (!uuid) return res.status(400).json({ success: false, message: 'uuid必填' });
    const result = await wxImport.checkScanStatus(uuid);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 扫码成功后登录并获取角色列表
router.post('/wx-login', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'code必填' });

    const { binBuffer, combUser } = await wxImport.loginWithCode(code);
    const roles = await wxImport.getServerRoles(binBuffer);

    // 临时存储 binBuffer 在内存中（用 key 关联）
    const tempId = require('uuid').v4();
    if (!global._tempBins) global._tempBins = new Map();
    global._tempBins.set(tempId, binBuffer);

    res.json({ success: true, data: { tempId, roles, nickname: combUser?.nickname || '' } });
  } catch (err) {
    logger.error('account', `微信登录失败: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 从扫码结果导入指定角色
router.post('/wx-import-role', async (req, res) => {
  try {
    const { tempId, name, serverId } = req.body;
    if (!tempId || !name) return res.status(400).json({ success: false, message: '参数缺失' });

    const binBuffer = global._tempBins?.get(tempId);
    if (!binBuffer) return res.status(400).json({ success: false, message: '数据已过期，请重新扫码' });

    // 如果指定了 serverId，修改 bin 数据中的 serverId
    let finalBin = binBuffer;
    if (serverId != null) {
      const { g_utils } = require('../game/bonProtocol');
      const parsed = g_utils.parse(binBuffer);
      const data = parsed.getData();
      data.serverId = serverId;
      finalBin = g_utils.encode(data);
    }

    const result = await accountService.importByBin(req.user.userId, name, finalBin, 'wxQrcode');

    // 导入成功后清理临时数据（保留 5 分钟供多角色导入）
    setTimeout(() => global._tempBins?.delete(tempId), 300000);

    res.json(result);
  } catch (err) {
    logger.error('account', `角色导入失败: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
