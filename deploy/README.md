# Deploying Campus Harmony ERP on the VPS

The VPS (Ubuntu 24.04, Node 22, nginx + certbot, PM2) hosts many other projects.
Everything here stays inside **`/var/www/campus-harmony-erp`**, the PM2 process
**`campus-harmony-erp`** (port **8726**) and one nginx file. Nothing else on the server is touched.

The database is MongoDB Atlas (company cluster), not the MongoDB running on the VPS.

## Layout

| Piece | Where |
|---|---|
| Code | `/var/www/campus-harmony-erp` (git clone of `main`) |
| Frontend | built into `dist/`, served by nginx |
| Backend | PM2 `campus-harmony-erp`, `127.0.0.1:8726`, reached via nginx at `/api/` |
| Settings | `backend/.env` (from `deploy/env.production.example`) |
| Uploads | `backend/uploads/` |

## First-time setup

1. **DNS** (Hostinger → ivyuha.in → DNS): `A` record `campus-erp` → `62.72.13.40`.
2. **Code and settings**
   ```bash
   cd /var/www && git clone https://github.com/Vyuha150/campus-harmony-erp.git
   cp campus-harmony-erp/deploy/env.production.example campus-harmony-erp/backend/.env
   nano campus-harmony-erp/backend/.env   # MONGODB_URI, JWT_SECRET, CORS_ORIGINS
   ```
3. **Build and start**: `bash /var/www/campus-harmony-erp/deploy/deploy.sh`
4. **nginx + HTTPS**
   ```bash
   cp /var/www/campus-harmony-erp/deploy/nginx-subdomain.conf /etc/nginx/sites-available/campus-harmony-erp
   ln -s /etc/nginx/sites-available/campus-harmony-erp /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   certbot --nginx -d campus-erp.ivyuha.in
   ```
5. **Check**: open `https://campus-erp.ivyuha.in`, log in, and `curl https://campus-erp.ivyuha.in/api/ready`.

## Updating later

Push to `main`, then on the VPS: `bash /var/www/campus-harmony-erp/deploy/deploy.sh`

## Retiring the old deployment

The old Postgres-era backend (`/var/www/campus`, PM2 `campus-backend`, port 8725,
nginx `campus-erp.vyuhainnovationfoundation.online`, expired domain) can be removed
once the new one is live: `pm2 delete campus-backend && pm2 save`, remove its nginx
site file, `nginx -t && systemctl reload nginx`. Keep `/var/www/campus` as a backup
until everyone agrees it can go.

## If it must live under a path (ivyuha.in/university-erp)

`ivyuha.in` itself is served by Vercel, so a path needs a rewrite in **that** Vercel
project sending `/university-erp/*` to the VPS, plus a frontend build with
base path `/university-erp/`. Prefer a subdomain unless the path is a firm requirement.

## Useful commands

```bash
pm2 logs campus-harmony-erp --lines 100   # backend logs
pm2 restart campus-harmony-erp            # restart
curl http://127.0.0.1:8726/api/ready      # health (DB connectivity included)
```
