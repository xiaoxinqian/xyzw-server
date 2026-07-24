const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { get, all, run } = require('../database/db');
const { authRequired, adminRequired } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// 所有操作需要登录
router.use(authRequired);

// 列出所有用户（仅管理员）
router.get('/', adminRequired, (req, res) => {
  const users = all('SELECT id, username, role, active, created_at FROM users ORDER BY created_at DESC', []);
  res.json({ success: true, data: users });
});

// 创建用户（仅管理员，无公开注册）
router.post('/', adminRequired, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '用户名和密码必填' });
  }
  if (role && !['admin', 'user'].includes(role)) {
    return res.status(400).json({ success: false, message: '角色只能是 admin 或 user' });
  }

  const exists = get('SELECT id FROM users WHERE username = ?', [username]);
  if (exists) {
    return res.status(409).json({ success: false, message: '用户名已存在' });
  }

  const id = uuidv4();
  const hashed = bcrypt.hashSync(password, 10);
  run(
    'INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)',
    [id, username, hashed, role || 'user']
  );

  logger.info('auth', `管理员创建用户: ${username}`, { operator: req.user.username });
  res.json({ success: true, data: { id, username, role: role || 'user' } });
});

// 修改用户（仅管理员）
router.put('/:id', adminRequired, (req, res) => {
  const { password, role } = req.body;
  const user = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }

  if (password) {
    const hashed = bcrypt.hashSync(password, 10);
    run('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
  }
  if (role && ['admin', 'user'].includes(role)) {
    run('UPDATE users SET role = ? WHERE id = ?', [role, user.id]);
  }
  if (req.body.active !== undefined) {
    run('UPDATE users SET active = ? WHERE id = ?', [req.body.active ? 1 : 0, user.id]);
  }

  logger.info('auth', `管理员修改用户: ${user.username}`, { operator: req.user.username });
  res.json({ success: true });
});

// 删除用户（仅管理员，不能删自己）
router.delete('/:id', adminRequired, (req, res) => {
  if (req.params.id === req.user.userId) {
    return res.status(400).json({ success: false, message: '不能删除自己' });
  }

  const user = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }

  // 删除用户的游戏账号和关联数据
  const accounts = all('SELECT id FROM game_accounts WHERE user_id = ?', [user.id]);
  for (const acc of accounts) {
    run('DELETE FROM task_logs WHERE account_id = ?', [acc.id]);
    run('DELETE FROM tasks WHERE account_id = ?', [acc.id]);
    run('DELETE FROM workers WHERE account_id = ?', [acc.id]);
    run('DELETE FROM game_data_history WHERE account_id = ?', [acc.id]);
  }
  run('DELETE FROM game_accounts WHERE user_id = ?', [user.id]);
  run('DELETE FROM users WHERE id = ?', [user.id]);

  logger.info('auth', `管理员删除用户: ${user.username}`, { operator: req.user.username });
  res.json({ success: true });
});

module.exports = router;
