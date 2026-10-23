// PM2 process for the production backend on the VPS.
// Start:   pm2 start deploy/ecosystem.config.cjs && pm2 save
// Reload:  pm2 reload campus-harmony-erp
// Port 8726 runs beside the old `campus-backend` (8725) so the switch-over has no gap.
module.exports = {
  apps: [
    {
      name: 'campus-harmony-erp',
      cwd: __dirname + '/../backend',
      script: 'node_modules/.bin/tsx',
      args: 'src/server.ts',
      env: {
        NODE_ENV: 'production',
        PORT: 8726
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '600M',
      time: true
    }
  ]
};
