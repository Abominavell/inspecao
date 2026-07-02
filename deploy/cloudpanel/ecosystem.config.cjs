/** PM2 — Inspeção SSMA (produção CloudPanel) */
module.exports = {
  apps: [
    {
      name: "api-inspecao",
      cwd: "/home/iadvh-apiinspecao/htdocs/apiinspecao.iadvh.org.br/backend",
      script: ".venv/bin/gunicorn",
      args: "-c gunicorn.conf.py",
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "inspecao-front",
      cwd: "/home/iadvh-inspecao/htdocs/inspecao.iadvh.org.br/frontend/.next/standalone",
      script: "server.js",
      interpreter: "node",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
        PORT: "3011",
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
};
