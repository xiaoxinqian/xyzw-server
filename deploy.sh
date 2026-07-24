#!/bin/bash
# XYZW Server 部署脚本
set -e

APP_DIR="/opt/xyzw-server"
LOG_DIR="$APP_DIR/logs"

echo "=== XYZW Server 部署 ==="

# 1. 创建日志目录
mkdir -p "$LOG_DIR"

# 2. 安装后端依赖
echo "[1/4] 安装后端依赖..."
cd "$APP_DIR"
npm install --production

# 3. 构建前端
echo "[2/4] 构建前端..."
cd "$APP_DIR/client"
npm install
npx vite build

# 4. 停止旧进程
echo "[3/4] 重启服务..."
if command -v pm2 &> /dev/null; then
  pm2 reload ecosystem.config.js --env production
  pm2 save
else
  echo "PM2 未安装，使用 nohup 启动..."
  # 停止旧进程
  if [ -f "$APP_DIR/logs/app.pid" ]; then
    kill $(cat "$APP_DIR/logs/app.pid") 2>/dev/null || true
    rm -f "$APP_DIR/logs/app.pid"
  fi
  # 启动新进程
  cd "$APP_DIR"
  nohup node server/app.js > "$LOG_DIR/out.log" 2>&1 &
  echo $! > "$APP_DIR/logs/app.pid"
  echo "服务已启动 (PID: $(cat $APP_DIR/logs/app.pid))"
fi

# 5. 检查状态
echo "[4/4] 检查状态..."
sleep 2
if curl -s http://localhost:3000/api/health | grep -q '"success":true'; then
  echo ""
  echo "✅ 部署成功！"
  echo "   服务地址: http://localhost:3000"
  echo "   API 健康: http://localhost:3000/api/health"
else
  echo "❌ 服务可能未正常启动，请检查日志:"
  echo "   tail -50 $LOG_DIR/out.log"
  exit 1
fi
