module.exports = {
  apps: [{
    name: 'xyzw-server',
    script: 'server/app.js',
    cwd: '/opt/xyzw-server',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/opt/xyzw-server/logs/error.log',
    out_file: '/opt/xyzw-server/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    kill_timeout: 5000,
    listen_timeout: 10000,
  }]
};
