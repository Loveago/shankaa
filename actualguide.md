# VPS Deployment Guide — Tsk5 Full Stack (Copy & Paste Ready)

This guide walks you through deploying the **entire Tsk5 application** (backend + frontend) on a **single VPS** under your own domain. You'll also host **PostgreSQL** directly on the VPS (not a cloud DB).

**Architecture**:
- Backend Node.js/Express → runs on port 5000 via PM2
- Frontend React (built static files) → served by Nginx
- PostgreSQL → runs locally on the VPS
- Nginx → reverse proxies API calls to backend, serves frontend static files, handles SSL

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Initial VPS Setup](#step-1-initial-vps-setup)
3. [Step 2: DNS Configuration](#step-2-dns-configuration)
4. [Step 3: Install Dependencies](#step-3-install-dependencies)
5. [Step 4: PostgreSQL Setup (Full Superuser Access)](#step-4-postgresql-setup-full-superuser-access)
6. [Step 5: Deploy Backend](#step-5-deploy-backend)
7. [Step 6: Build & Deploy Frontend](#step-6-build--deploy-frontend)
8. [Step 7: Nginx Configuration](#step-7-nginx-configuration)
9. [Step 8: Enable HTTPS with Certbot (SSL)](#step-8-enable-https-with-certbot-ssl)
10. [Step 9: Maintenance & Updates](#step-9-maintenance--updates)
11. [Troubleshooting](#troubleshooting)

---

### Prerequisites

- VPS with **Ubuntu 22.04** (or 24.04) — any provider (DigitalOcean, Linode, Hetzner, Vultr, etc.)
- SSH access as a **non-root user with sudo privileges**
- A domain name (e.g., `data-deals.com`) with DNS access
- Your project code in a **Git repository** (GitHub, GitLab, etc.)
- At least **1GB RAM** (2GB recommended)

---

### Step 1: Initial VPS Setup

```bash
# 1. SSH into your VPS
ssh your_user@your_vps_ip

# 2. Update all system packages
sudo apt update && sudo apt upgrade -y

# 3. Install essential tools
sudo apt install -y curl wget git ufw

# 4. Configure firewall — allow SSH, HTTP, and HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# 5. Verify firewall is active
sudo ufw status
```

---

### Step 2: DNS Configuration

In your domain registrar's DNS panel, create these **A records**:

| Type | Hostname | Value            |
|------|----------|------------------|
| A    | @        | `your_vps_ip`    |
| A    | www      | `your_vps_ip`    |

Wait **5–15 minutes** for DNS propagation. Verify with:

```bash
# Replace with your domain
ping data-deals.com
```

---

### Step 3: Install Dependencies

Run these commands one after another:

```bash
# ---- Install Node.js v20 LTS ----
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # Should show v20.x
npm -v    # Should show 10.x

# ---- Install Nginx ----
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# ---- Install PM2 (process manager) ----
sudo npm install -g pm2

# ---- Install PostgreSQL ----
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Verify PostgreSQL is running
sudo systemctl status postgresql
```

---

### Step 4: PostgreSQL Setup (Full Superuser Access)

This gives your app database user **full superuser privileges**. The database runs locally on the VPS.

```bash
# 1. Switch to the postgres system user
sudo -i -u postgres

# 2. Enter the PostgreSQL interactive terminal
psql
```

Inside the `psql` prompt, run these SQL commands **one at a time**:

```sql
-- Create a superuser role for your app
CREATE USER tsk5admin WITH PASSWORD 'Shankaa1122@';

-- Grant superuser privileges (full access)
ALTER USER tsk5admin WITH SUPERUSER CREATEDB CREATEROLE;

-- Create the database owned by this user
CREATE DATABASE tsk5db OWNER tsk5admin;

-- Exit PostgreSQL
\q
```

```bash
# 3. Exit the postgres system user
exit

# 4. Test the connection (you'll be prompted for the password)
psql -U tsk5admin -d tsk5db -h localhost

# If it connects successfully, type \q to quit
```

**Security note**: Since PostgreSQL only listens on `localhost` (default), the superuser is only accessible from within the VPS — not exposed to the internet. This is safe.

---

### Step 5: Deploy Backend

```bash
# 1. Clone your repository
#    Replace with your actual repo URL
cd /var
sudo mkdir -p www
sudo chown $USER:$USER www
cd www
git clone https://github.com/your-username/your-repo.git shankaa
cd shankaa/tsk5_backend

# 2. Install backend dependencies
npm install

# 3. Create environment file
#    (Use actual values from your local .env.production or create from scratch)
cat > .env << 'EOF'
# Server Configuration
PORT=5000
NODE_ENV=production

# Database (PostgreSQL running on same VPS)
# Replace the password with what you set in Step 4
DATABASE_URL=postgresql://tsk5admin:Shankaa1122a1@localhost:5432/tsk5db?schema=public

# JWT Secret — GENERATE YOUR OWN: run 'openssl rand -base64 32' on the VPS
JWT_SECRET=aweuifafh4uauoip4f4fuafugu4fuipq4guhauhap7934hupaw

# Admin Seed User — Created on first startup
ADMIN_NAME=Admin
const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?topup=callback`;
ADMIN_PHONE=+233501234567

# Paystack Payment Gateway
# Get these from https://dashboard.paystack.com
PAYSTACK_SECRET_KEY=
PAYSTACK_CALLBACK_URL=https://data-deals.com/api/payment/callback

# Frontend URL
FRONTEND_URL=https://data-deals.com

# Chat Encryption Key — GENERATE YOUR OWN: run 'openssl rand -base64 32'
CHAT_ENCRYPTION_KEY=aweuifafh4uauoip4f4fuafugu4fuipq4guhauhap7934hupaw
EOF

# 4. IMPORTANT: Generate your own secrets
#    Run these commands and replace the placeholders above:
echo "Run: openssl rand -base64 32"
echo "Use the output for JWT_SECRET and CHAT_ENCRYPTION_KEY"

# 5. Run database migrations (this creates all tables)
npx prisma migrate deploy

# 6. Generate Prisma client
npx prisma generate

# 7. Start backend with PM2
pm2 start index.js --name "tsk5-backend" --env production

# 8. Configure PM2 to auto-start on server reboot
pm2 startup
#   Copy-paste the command PM2 outputs (it will look something like:)
#   sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u your_user --hp /home/your_user
pm2 save

# 9. Verify backend is running
pm2 status
#   Should show "tsk5-backend" as "online"
curl http://localhost:5000/health
#   Should return: {"status":"ok","timestamp":"..."}
```

---

### Step 6: Build & Deploy Frontend

```bash
# 1. Navigate to frontend directory
cd /var/www/shankaa/tsk5_frontend

# 2. Install dependencies
npm install

# 3. Build the React app for production
#    BASE_URL will be empty string (same domain), so API calls go to /
#    This works because Nginx will proxy /api/*, /products/*, /order/* to the backend
npm run build

# 4. Verify the build was created
ls -la build/
#   Should show: index.html, static/, asset-manifest.json, etc.
```

---

### Step 7: Nginx Configuration

**Critical**: The backend routes are mounted at **both** `/api/*` and root-level paths like `/products` and `/order`. The Nginx config must proxy ALL of them.

```bash
# 1. Create the Nginx site configuration
#    Replace 'data-deals.com' with your actual domain
sudo nano /etc/nginx/sites-available/data-deals.com
```

Paste the following configuration **exactly** (replace `data-deals.com` with your domain):

```nginx
server {
    listen 80;
    server_name data-deals.com www.data-deals.com;

    # Path to the built frontend files
    root /var/www/shankaa/tsk5_frontend/build;
    index index.html;

    # ──────────────────────────────────────────────
    # API PROXY — Route ALL API calls to the backend
    # ──────────────────────────────────────────────

    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Products endpoint (mounted at /products NOT /api/products)
    location /products {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Order endpoint (mounted at /order NOT /api/order)
    location /order {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket connections (for real-time features)
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # ──────────────────────────────────────────────
    # FRONTEND — Serve the React SPA for all other routes
    # ──────────────────────────────────────────────
    location / {
        # Serve existing files/directories as-is
        if (!-e $request_filename) {
            rewrite ^(.*)$ /index.html break;
        }
    }
}
```

**Save** (Ctrl+O, Enter) and **exit** (Ctrl+X).

Now activate the site:

```bash
# 2. Enable the site by creating a symlink
sudo ln -s /etc/nginx/sites-available/data-deals.com /etc/nginx/sites-enabled/

# 3. Remove the default Nginx site (optional but recommended)
sudo rm /etc/nginx/sites-enabled/default

# 4. Test the Nginx configuration
sudo nginx -t
#   Should output: "test is successful"

# 5. Reload Nginx to apply changes
sudo systemctl reload nginx
```

**Test your deployment**:
```bash
# Check the frontend is being served
curl -I http://data-deals.com
# Should return 200 OK

# Check the backend health endpoint
curl http://data-deals.com/health
# Should return: {"status":"ok","timestamp":"..."}

# Check products API
curl http://data-deals.com/products
# Should return JSON array (may be empty [] if no products exist)
```

---

### Step 8: Enable HTTPS with Certbot (SSL)

```bash
# 1. Install Certbot and the Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# 2. Obtain SSL certificate (Certbot auto-configures Nginx)
#    Replace with your actual domain
sudo certbot --nginx -d data-deals.com -d www.data-deals.com

#    Follow the prompts:
#    - Enter your email (for renewal notices)
#    - Agree to Terms of Service
#    - Choose whether to redirect HTTP to HTTPS (select "2" — YES)

# 3. Verify auto-renewal is set up
sudo systemctl status certbot.timer

# 4. Test the renewal process (dry run)
sudo certbot renew --dry-run
```

Your site is now live at **`https://data-deals.com`** 🎉

---

### Step 9: Maintenance & Updates

#### Update the application

```bash
cd /var/www/shankaa

# Pull latest code
git pull origin main

# ---- Update Backend ----
cd tsk5_backend
npm install
npx prisma migrate deploy
npx prisma generate
pm2 restart tsk5-backend

# ---- Update Frontend ----
cd tsk5_frontend
npm install
npm run build

# Reload Nginx (just in case)
sudo systemctl reload nginx
```

#### Useful PM2 commands

```bash
pm2 status                     # List all processes
pm2 logs tsk5-backend          # View backend logs
pm2 logs tsk5-backend --lines 100  # Last 100 lines
pm2 monit                      # Monitor CPU/RAM usage
pm2 restart tsk5-backend       # Restart backend
pm2 stop tsk5-backend          # Stop backend
pm2 delete tsk5-backend        # Remove from PM2
```

#### View backend logs in real-time

```bash
pm2 logs tsk5-backend --lines 200
```

#### Database backup

```bash
# Backup the entire database
pg_dump -U tsk5admin -h localhost tsk5db > /home/your_user/tsk5_backup_$(date +%Y%m%d).sql

# Restore from backup
psql -U tsk5admin -h localhost -d tsk5db < /home/your_user/tsk5_backup_20250101.sql
```

---

### Troubleshooting

#### Blank screen or "Failed to fetch" in browser

```bash
# Check if backend is running
pm2 status

# Check backend logs for errors
pm2 logs tsk5-backend --lines 50

# Check if Nginx is proxying correctly
curl -v http://localhost:5000/products
# Should return JSON, NOT HTML

# Try through Nginx
curl -v http://data-deals.com/products
# Should also return JSON

# Check Nginx error logs
sudo tail -50 /var/log/nginx/error.log
```

#### Database connection errors

```bash
# Test PostgreSQL connection
psql -U tsk5admin -d tsk5db -h localhost

# Check if PostgreSQL is running
sudo systemctl status postgresql

# Verify the DATABASE_URL in .env matches your credentials
# Format: postgresql://USER:PASSWORD@localhost:5432/DBNAME?schema=public
```

#### Nginx configuration test

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### Port 80/443 already in use

```bash
sudo lsof -i :80
sudo lsof -i :443
sudo systemctl stop apache2   # If Apache is using port 80
```

---

> **Your app is now fully deployed with:**
> - Self-hosted PostgreSQL database with superuser access
> - Backend running on PM2 (auto-restarts on crash & reboot)
> - Frontend served as static files via Nginx
> - HTTPS with auto-renewing SSL certificate
> - All API routes (/api, /products, /order) properly proxied
