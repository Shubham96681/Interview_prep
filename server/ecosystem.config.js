/**
 * PM2 Ecosystem Configuration
 * For running the application in production with clustering
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 logs
 *   pm2 monit
 */

module.exports = {
  apps: [{
    name: 'interview-marketplace-api',
    script: './index.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster', // Cluster mode for load balancing
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    // Error handling
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Auto-restart on crash
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G', // Restart if memory exceeds 1GB
    
    // Watch mode (disable in production)
    watch: false,
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // Advanced settings
    instance_var: 'INSTANCE_ID',
    increment_var: 'PORT',
    
    // Health monitoring
    health_check_grace_period: 3000,
    
    // Logging
    log_type: 'json',
    combine_logs: true
  }]
};

