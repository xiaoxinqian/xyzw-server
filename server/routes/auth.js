const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { get } = require('../database/db');
const logger = require('../utils/logger');

const router = express.Router();

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '用户名和密码必填' });
  }

  const user = get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  logger.info('auth', `用户登录成功: ${username}`);
  res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role } });
});

// 获取当前用户信息
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未认证' });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    res.json({ success: true, user: payload });
  } catch {
    res.status(401).json({ success: false, message: '令牌无效' });
  }
});

module.exports = router;
