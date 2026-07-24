require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const { initDatabase } = require('./database/db');
const { initSchema, runMigrations } = require('./database/init');
const { initKey } = require('./utils/crypto');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { authRequired } = require('./middleware/auth');
const workerManager = require('./services/workerManager');
const TaskScheduler = require('./services/scheduler');
const wsManager = require('./services/wsManager');

async function startServer() {
  // 1. 初始化加密密钥
  initKey(process.env.AES_KEY || 'default-key-change-me-32bytes!!!!!');

  // 2. 初始化数据库
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'xyzw.db');
  await initDatabase(dbPath);
  initSchema();
  runMigrations();
  logger.info('system', '数据库初始化完成');

  // 3. 初始化管理员账号
  const { get, run } = require('./database/db');
  const adminExists = get('SELECT id FROM users WHERE username = ?', [process.env.ADMIN_USERNAME || 'admin']);
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
    run(
      'INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), process.env.ADMIN_USERNAME || 'admin', hashedPassword, 'admin']
    );
    logger.info('system', '管理员账号已创建');
  }

  // 4. 创建 Express 应用
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 5. 静态文件（前端构建产物）
  // 静态文件（前端构建产物）— index.html 不缓存，带 hash 的 assets 长缓存
  const staticRoot = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(staticRoot, {
    maxAge: '1y',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));

  // 6. 初始化调度器
  const scheduler = new TaskScheduler(workerManager);
  scheduler.init();
  logger.info('system', '任务调度器已初始化');

  // 注入到 tasks 路由
  const tasksRoute = require('./routes/tasks');
  tasksRoute.setDependencies(scheduler, workerManager);

  // 注入调度器到 accountService（新账号导入时自动套用预设任务）
  const accountService = require('./services/accountService');
  accountService.setScheduler(scheduler);

  // 7. API 路由
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/accounts', require('./routes/accounts'));
  app.use('/api/tasks', tasksRoute.router);
  app.use('/api/workers', require('./routes/workers'));
  app.use('/api/data', require('./routes/data'));
  app.use('/api/logs', require('./routes/logs'));
  app.use('/api/settings', require('./routes/settings'));
  app.use('/api/users', require('./routes/users'));

  // 8. 健康检查
  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'ok', time: new Date().toISOString() });
  });

  // 9. 前端路由 fallback
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });

  // 10. 错误处理
  app.use(errorHandler);

  // 11. 启动服务（HTTP + WebSocket 共用同一端口）
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info('system', `服务器启动成功，端口 ${PORT}`);
  });

  // 初始化 WebSocket
  wsManager.init(server);

  // 12. 优雅关闭
  process.on('SIGTERM', async () => {
    logger.info('system', '收到 SIGTERM，正在关闭...');
    scheduler.stopAll();
    await workerManager.stopAll();
    process.exit(0);
  });

  // 13. 暴露 wsManager 给其他模块
  app.locals.wsManager = wsManager;
}

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
