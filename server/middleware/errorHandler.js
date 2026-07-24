const logger = require('../utils/logger');

/**
 * 统一错误处理中间件
 */
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || '服务器内部错误';

  logger.error('system', `${req.method} ${req.path} → ${status}: ${message}`, {
    stack: err.stack,
  });

  res.status(status).json({
    success: false,
    message,
  });
}

module.exports = errorHandler;
