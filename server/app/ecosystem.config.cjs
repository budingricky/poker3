module.exports = {
  apps: [{
    name: 'poker3-server',
    cwd: '/www/wwwroot/poker3/server/app',
    script: 'npm',
    args: 'run dev',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      PORT: 3001,
      SSL_CERT_PATH: '/www/wwwroot/poker3/certs/fullchain.pem',
      SSL_KEY_PATH: '/www/wwwroot/poker3/certs/privkey.pem',
      NODE_ENV: 'production'
    },
    error_file: '/www/wwwroot/poker3/logs/pm2-error.log',
    out_file: '/www/wwwroot/poker3/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '60s',
    max_restarts: 10,
    restart_delay: 4000
  }]
}
