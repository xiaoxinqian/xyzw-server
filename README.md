# XYZW Server — 咸鱼之王自动管理系统

服务器端自动化管理《咸鱼之王》游戏账号的工具。支持多账号导入、31种定时任务自动执行、盐罐/梦境/竞技场/宝库等全流程自动化。

## ✨ 功能特性

- **多账号管理** — 支持 Bin 文件导入、微信扫码导入，一个 bin 可含多个角色
- **31种定时任务** — 日常任务全流程、盐罐重置、竞技场、爬塔、梦境、宝库、黑市采购等
- **按账号绑定任务** — 每个账号独立选择执行哪些任务，互不干扰
- **防顶号设计** — 任务执行时连上、执行完断开，不保持在线，不会被顶下线
- **间隔任务** — 盐罐重置每3小时、挂机奖励每4小时，自动循环
- **定时任务** — 精确到分钟的 cron 调度，支持每日/自定义时间
- **手动批量执行** — 选中任务一键跑全部绑定账号，异步排队执行
- **实时日志** — WebSocket 推送执行日志，随时查看任务状态
- **响应式 UI** — PC 侧边栏 / 手机底部导航，电脑手机都能用
- **多用户** — 支持多管理员账号，JWT 鉴权

## 📋 系统要求

- **OS:** Linux（推荐 Ubuntu 20.04+ / Debian 12+）
- **Node.js:** 18+（推荐 20.x）
- **内存:** 512MB 以上
- **磁盘:** 500MB 以上

## 🚀 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/xiaoxinqian/xyzw-server/main/install.sh | bash
```

或者手动下载：

```bash
git clone https://github.com/xiaoxinqian/xyzw-server.git /opt/xyzw-server
cd /opt/xyzw-server
bash install.sh
```

安装完成后访问 `http://你的服务器IP:3000`，默认账号 `admin` / `admin123`。

## 📖 手动安装教程

如果一键脚本不成功，按以下步骤操作：

### 1. 安装 Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

验证：

```bash
node -v   # 应输出 v20.x.x
npm -v    # 应输出 10.x.x
```

### 2. 安装 PM2

```bash
npm install -g pm2
```

### 3. 克隆代码

```bash
git clone https://github.com/xiaoxinqian/xyzw-server.git /opt/xyzw-server
cd /opt/xyzw-server
```

### 4. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，把 `JWT_SECRET` 和 `AES_KEY` 改成随机值：

```bash
# 生成随机密钥
JWT_SECRET=$(openssl rand -hex 32)
AES_KEY=$(openssl rand -hex 16)

sed -i "s/change-me-to-random-64-char-string/$JWT_SECRET/" .env
sed -i "s/change-me-32-byte-key-here-1234567890/$AES_KEY/" .env
```

> 也可以用 `nano .env` 手动编辑

### 5. 创建数据目录

```bash
mkdir -p data logs
```

### 6. 安装后端依赖

```bash
npm install --production
```

### 7. 构建前端

```bash
cd client
npm install
npx vite build
cd ..
```

### 8. 启动服务

```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

### 9. 验证

```bash
curl http://localhost:3000/api/health
```

返回 `{"success":true,...}` 就是成功了。

### 10. 设置开机自启（推荐）

```bash
pm2 startup
pm2 save
```

## 🔧 配置 Nginx 反向代理（可选）

如果要用域名 + HTTPS，参考 `nginx-xyzw.conf.example`：

```bash
cp nginx-xyzw.conf.example /etc/nginx/sites-available/xyzw
# 编辑配置，把 your-domain.com 改成你的域名
nano /etc/nginx/sites-available/xyzw
ln -s /etc/nginx/sites-available/xyzw /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

配合 certbot 申请 HTTPS 证书：

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

## 📱 使用说明

### 导入账号

1. 登录管理后台
2. 点击「账号」→「导入」
3. 选择 Bin 文件上传 → 预览角色 → 勾选要导入的角色 → 导入
4. 新账号自动绑定全部31个任务

### 管理任务绑定

1. 在账号列表点击「任务」按钮
2. 勾选/取消该账号要执行的任务
3. 保存即可，立即生效

### 创建自定义定时任务

1. 进入「任务」页面
2. 点击「新建任务」
3. 选择任务类型、执行时间、绑定的账号
4. 保存即可自动调度

### 手动执行任务

1. 在任务列表点击「执行」
2. 多账号会排队依次执行
3. 在「日志」页面查看实时执行情况

## 📂 项目结构

```
xyzw-server/
├── server/                    # 后端
│   ├── app.js                 # 入口
│   ├── routes/                # API 路由
│   ├── services/              # 业务逻辑
│   │   ├── scheduler.js       # 定时调度器
│   │   ├── taskExecutor.js    # 任务执行器
│   │   ├── workerManager.js   # Worker 管理
│   │   ├── accountService.js  # 账号管理
│   │   ├── presetTasks.js     # 预设31个任务
│   │   └── wxImportService.js # 微信扫码导入
│   ├── game/                  # 游戏协议
│   │   ├── worker.js          # 游戏连接 Worker
│   │   ├── taskRunner.js      # 任务运行器
│   │   ├── tasks/             # 各类任务实现
│   │   └── tokenManager.js    # Token 管理
│   ├── database/              # SQLite 数据库
│   ├── middleware/            # 中间件
│   └── utils/                 # 工具
├── client/                    # 前端 (Vue 3 + Element Plus)
│   ├── src/
│   │   ├── views/             # 页面
│   │   ├── layout/            # 布局
│   │   ├── utils/             # 工具
│   │   └── stores/            # Pinia 状态
│   └── vite.config.js
├── data/                      # 数据库 (gitignore)
├── logs/                      # 日志 (gitignore)
├── .env.example               # 环境变量模板
├── ecosystem.config.js        # PM2 配置
├── install.sh                 # 一键安装脚本
└── deploy.sh                  # 部署/更新脚本
```

## 🔄 更新升级

```bash
cd /opt/xyzw-server
git pull
bash deploy.sh
```

## 🛠️ 常用命令

| 命令 | 说明 |
|------|------|
| `pm2 status` | 查看服务状态 |
| `pm2 logs xyzw-server` | 实时日志 |
| `pm2 logs xyzw-server --lines 50` | 最近50行日志 |
| `pm2 restart xyzw-server` | 重启服务 |
| `pm2 stop xyzw-server` | 停止服务 |
| `pm2 monit` | 监控面板 |

## ⚠️ 注意事项

- **防顶号：** 系统设计为任务执行时才连游戏服务器，执行完立刻断开，不会顶掉你手动玩游戏
- **免登录时段：** 周六 20:00-21:00、周日 08:00-08:30 为游戏维护时段，任务自动跳过
- **数据安全：** `.env` 文件含密钥，已在 `.gitignore` 中排除，不会上传
- **首次登录：** 请尽快修改默认密码 admin123

## 📜 License

MIT
