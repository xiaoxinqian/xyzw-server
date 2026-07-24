const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { get, all, run } = require('../database/db');
const { authRequired, adminRequired } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.use(authRequired);

// 列出所有节点
router.get('/', (req, res) => {
  const nodes = all('SELECT * FROM server_nodes ORDER BY created_at DESC', []);
  res.json({ success: true, data: nodes });
});

// 创建节点（仅管理员）
router.post('/', adminRequired, (req, res) => {
  const { name, host, port, max_workers, description } = req.body;
  if (!name || !host) {
    return res.status(400).json({ success: false, message: '节点名称和地址必填' });
  }

  const id = uuidv4();
  run(
    'INSERT INTO server_nodes (id, name, host, port, max_workers, description) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, host, port || 3000, max_workers || 10, description || '']
  );

  logger.info('system', `创建服务器节点: ${name}`, { operator: req.user.username });
  res.json({ success: true, data: { id, name, host, port: port || 3000 } });
});

// 修改节点（仅管理员）
router.put('/:id', adminRequired, (req, res) => {
  const { name, host, port, max_workers, description, status } = req.body;
  const node = get('SELECT * FROM server_nodes WHERE id = ?', [req.params.id]);
  if (!node) {
    return res.status(404).json({ success: false, message: '节点不存在' });
  }

  run(
    `UPDATE server_nodes SET 
      name = ?, host = ?, port = ?, max_workers = ?, description = ?, status = ?
     WHERE id = ?`,
    [
      name || node.name,
      host || node.host,
      port || node.port,
      max_workers || node.max_workers,
      description !== undefined ? description : node.description,
      status || node.status,
      node.id
    ]
  );

  logger.info('system', `修改服务器节点: ${name || node.name}`, { operator: req.user.username });
  res.json({ success: true });
});

// 删除节点（仅管理员）
router.delete('/:id', adminRequired, (req, res) => {
  const node = get('SELECT * FROM server_nodes WHERE id = ?', [req.params.id]);
  if (!node) {
    return res.status(404).json({ success: false, message: '节点不存在' });
  }

  // 检查是否有账号分配到此节点
  const accounts = all('SELECT id FROM game_accounts WHERE server_node_id = ?', [node.id]);
  if (accounts.length > 0) {
    return res.status(400).json({ success: false, message: `该节点上还有 ${accounts.length} 个游戏账号，请先迁移` });
  }

  run('DELETE FROM server_nodes WHERE id = ?', [node.id]);
  logger.info('system', `删除服务器节点: ${node.name}`, { operator: req.user.username });
  res.json({ success: true });
});

module.exports = router;
