#!/bin/bash
# ============================================
# XYZW Server 一键安装脚本
# 咸鱼之王服务器端自动管理系统
# ============================================
set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║   XYZW Server 一键安装脚本              ║"
echo "║   咸鱼之王自动管理系统                  ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# root 检查
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}请用 root 用户运行：sudo bash install.sh${NC}"
  exit 1
fi

INSTALL_DIR="/opt/xyzw-server"
REPO_URL="https://github.com/xiaoxinqian/xyzw-server.git"
NODE_REQUIRED=18

# ========== 1. 系统检查 ==========
echo -e "${YELLOW}[1/8] 检查系统环境...${NC}"

# Node.js
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  echo -e "  Node.js: $(node -v) ${GREEN}✓${NC}"
else
  echo -e "  ${YELLOW}Node.js 未安装，正在安装 Node.js 20.x...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  echo -e "  Node.js: $(node -v) ${GREEN}✓${NC}"
fi

# npm
if command -v npm &> /dev/null; then
  echo -e "  npm: $(npm -v) ${GREEN}✓${NC}"
else
  echo -e "${RED}npm 未找到，请手动安装 npm${NC}"
  exit 1
fi

# git
if ! command -v git &> /dev/null; then
  echo -e "  ${YELLOW}安装 git...${NC}"
  apt-get update -qq && apt-get install -y git
fi
echo -e "  git: $(git --version) ${GREEN}✓${NC}"

# ========== 2. PM2 ==========
echo -e "${YELLOW}[2/8] 检查 PM2...${NC}"
if command -v pm2 &> /dev/null; then
  echo -e "  PM2 已安装 ${GREEN}✓${NC}"
else
  echo -e "  ${YELLOW}安装 PM2...${NC}"
  npm install -g pm2
  echo -e "  PM2 安装完成 ${GREEN}✓${NC}"
fi

# ========== 3. 克隆代码 ==========
echo -e "${YELLOW}[3/8] 下载代码...${NC}"
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "  目录已存在，拉取最新代码..."
  cd "$INSTALL_DIR"
  git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || true
else
  if [ -d "$INSTALL_DIR" ]; then
    echo -e "  ${YELLOW}$INSTALL_DIR 已存在但非 git 仓库，备份后重新克隆...${NC}"
    mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%Y%m%d%H%M%S)"
  fi
  git clone "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"
echo -e "  代码下载完成 ${GREEN}✓${NC}"

# ========== 4. 配置环境变量 ==========
echo -e "${YELLOW}[4/8] 配置环境变量...${NC}"
if [ ! -f "$INSTALL_DIR/.env" ]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  
  # 生成随机密钥
  JWT_SECRET=$(openssl rand -hex 32)
  AES_KEY=$(openssl rand -hex 16)
  
  sed -i "s/change-me-to-random-64-char-string/$JWT_SECRET/" "$INSTALL_DIR/.env"
  sed -i "s/change-me-32-byte-key-here-1234567890/$AES_KEY/" "$INSTALL_DIR/.env"
  
  echo -e "  已生成随机密钥 ${GREEN}✓${NC}"
  echo -e "  ${YELLOW}  默认管理员: admin / admin123（登录后请修改密码）${NC}"
else
  echo -e "  .env 已存在，跳过 ${GREEN}✓${NC}"
fi

# ========== 5. 创建目录 ==========
echo -e "${YELLOW}[5/8] 创建数据目录...${NC}"
mkdir -p "$INSTALL_DIR/data"
mkdir -p "$INSTALL_DIR/logs"
echo -e "  data/ logs/ 已创建 ${GREEN}✓${NC}"

# ========== 6. 安装依赖 ==========
echo -e "${YELLOW}[6/8] 安装依赖...${NC}"
cd "$INSTALL_DIR"
npm install --production
echo -e "  后端依赖安装完成 ${GREEN}✓${NC}"

# ========== 7. 构建前端 ==========
echo -e "${YELLOW}[7/8] 构建前端...${NC}"
cd "$INSTALL_DIR/client"
npm install
npx vite build
echo -e "  前端构建完成 ${GREEN}✓${NC}"

# ========== 8. 启动服务 ==========
echo -e "${YELLOW}[8/8] 启动服务...${NC}"
cd "$INSTALL_DIR"
pm2 delete xyzw-server 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

sleep 3

# 健康检查
if curl -s http://localhost:3000/api/health | grep -q '"success"'; then
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║        ✅ 安装成功！                     ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  访问地址:  ${CYAN}http://$(curl -s ifconfig.me 2>/dev/null || echo '服务器IP'):3000${NC}"
  echo -e "  管理员:    admin / admin123"
  echo -e "  数据目录:  $INSTALL_DIR/data/"
  echo -e "  日志目录:  $INSTALL_DIR/logs/"
  echo ""
  echo -e "  ${YELLOW}请尽快登录修改管理员密码！${NC}"
  echo ""
  echo -e "  常用命令:"
  echo -e "    查看状态:  pm2 status"
  echo -e "    查看日志:  pm2 logs xyzw-server"
  echo -e "    重启服务:  pm2 restart xyzw-server"
  echo -e "    停止服务:  pm2 stop xyzw-server"
  echo ""
  
  # 提示设置开机自启
  echo -e "  ${YELLOW}设置开机自启（推荐）:${NC}"
  echo -e "    pm2 startup && pm2 save"
  echo ""
else
  echo -e "${RED}❌ 服务启动失败，请检查日志:${NC}"
  echo -e "  pm2 logs xyzw-server --lines 20"
  exit 1
fi
