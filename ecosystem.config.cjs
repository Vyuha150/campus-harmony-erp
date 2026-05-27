module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'npm',
      args: 'run start',
      cwd: './backend',
      env: {
        PORT: 8725,
        NODE_ENV: 'development'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      ignore_watch: ['node_modules', 'uploads'],
      max_memory_restart: '500M'
    }
  ]
};
