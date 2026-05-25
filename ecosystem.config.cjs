module.exports = {
  apps: [
    {
      name: "cdwtech-cloudflare-dns",
      cwd: __dirname,
      script: "./node_modules/.bin/next",
      args: "start -p 3015",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3015",
      },
    },
  ],
};
