# Manage Your Money - VPS Deployment Guide

**Developed by Ashish Baboo** | [ashishbaboo.com](https://ashishbaboo.com)

Complete guide for deploying Manage Your Money to a production VPS with Nginx, SSL, PM2, and monitoring.

## 📋 Prerequisites

- Ubuntu 20.04 LTS or later (Debian-based Linux)
- VPS with at least 2GB RAM, 20GB storage
- Root or sudo access
- Domain name (for SSL certificate)
- Supabase account with PostgreSQL database

## 🚀 Quick Start (5 minutes)

### Option 1: Full Automated Installation

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Clone the repository
git clone https://github.com/AshishBaboo/ManageYourMoney.git
cd ManageYourMoney

# Make scripts executable
chmod +x scripts/*.sh

# Run full installation (interactive)
sudo bash scripts/install-vps.sh your-domain.com
```

The script will:
✓ Update system packages
✓ Install Node.js, Nginx, PM2, Certbot
✓ Clone/update repository
✓ Install dependencies
✓ Build the application
✓ Configure Nginx with SSL
✓ Set up PM2 process manager
✓ Configure firewall
✓ Set up automated backups

### Option 2: Step-by-Step Manual Installation

#### Step 1: Update System
```bash
sudo apt-get update
sudo apt-get upgrade -y
```

#### Step 2: Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt-get install -y nodejs
node -v  # Verify
```

#### Step 3: Install PM2
```bash
sudo npm install -g pm2
pm2 startup
pm2 save
```

#### Step 4: Install Nginx
```bash
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

#### Step 5: Install Certbot (Let's Encrypt)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

#### Step 6: Clone Repository
```bash
sudo mkdir -p /var/www/manageyourmoney
sudo chown -R $USER:$USER /var/www/manageyourmoney
git clone https://github.com/AshishBaboo/ManageYourMoney.git /var/www/manageyourmoney
cd /var/www/manageyourmoney
```

#### Step 7: Setup Environment
```bash
# Create production environment file
cat > .env.production << 'EOF'
NODE_ENV=production
VITE_SUPABASE_URL=https://uctmoxfalxyczrttyqto.supabase.co
VITE_SUPABASE_ANON_KEY=your-key-here
EOF

chmod 600 .env.production
```

#### Step 8: Install & Build
```bash
npm ci --production
npm run build
```

#### Step 9: Start with PM2
```bash
sudo pm2 start "npm run preview" --name "manageyourmoney" --cwd "/var/www/manageyourmoney"
sudo pm2 save
```

#### Step 10: Configure Nginx
See nginx-config.conf in this directory and update domain name.

#### Step 11: Setup SSL
```bash
sudo certbot certonly --nginx -d your-domain.com
sudo certbot renew --dry-run  # Test auto-renewal
```

#### Step 12: Setup Firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## 📚 Scripts Reference

### install-vps.sh
**Full production setup in one command**

```bash
sudo bash scripts/install-vps.sh your-domain.com
```

**What it does:**
- System updates
- Installs all dependencies
- Clones repository
- Configures environment
- Builds application
- Sets up Nginx with SSL
- Configures PM2
- Sets up firewall
- Configures automated backups

**Options:**
```bash
sudo bash scripts/install-vps.sh money.example.com
```

### deploy.sh
**Deploy updates to production**

```bash
sudo bash /usr/local/bin/deploy.sh
```

**What it does:**
- Pulls latest code from GitHub
- Installs updated dependencies
- Rebuilds application
- Restarts PM2 application
- Verifies deployment

**Use after:**
- Pushing code updates to GitHub
- Changing environment variables
- Updating dependencies

### quick-install.sh
**Development/testing quick setup**

```bash
bash scripts/quick-install.sh
npm run dev
```

**What it does:**
- Checks Node.js installation
- Installs npm dependencies
- Sets up .env.local
- Ready for development

### monitor.sh
**Real-time monitoring dashboard**

```bash
sudo bash scripts/monitor.sh
```

**Features:**
- App status (running/stopped)
- Nginx status
- Disk space usage
- Memory usage
- CPU load
- Recent errors
- Recent logs
- Interactive menu for actions

**Menu options:**
1. View full logs
2. Restart app
3. Stop app
4. Start app
5. Clear logs
6. Deploy updates
7. Refresh dashboard
0. Exit

## 🔧 Common Commands

### Application Management

```bash
# View app status
pm2 list

# View live logs
pm2 logs manageyourmoney

# Tail last 50 lines
pm2 logs manageyourmoney --lines 50

# Monitor resources
pm2 monit

# Restart app
pm2 restart manageyourmoney

# Stop app
pm2 stop manageyourmoney

# Start app
pm2 start manageyourmoney

# Delete app from PM2
pm2 delete manageyourmoney
```

### Nginx Management

```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# View Nginx status
sudo systemctl status nginx

# View access logs
sudo tail -f /var/log/nginx/access.log

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### SSL/Certificate Management

```bash
# Check certificate expiry
sudo certbot certificates

# Renew certificates manually
sudo certbot renew

# Test auto-renewal
sudo certbot renew --dry-run

# View certificate details
openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -text -noout
```

### System Monitoring

```bash
# Disk usage
df -h

# Memory usage
free -h

# CPU usage
top

# Network connections
netstat -tulpn

# Process list
ps aux | grep node
```

## 📊 Monitoring & Maintenance

### Set Up Daily Health Checks

```bash
# Edit crontab
sudo crontab -e

# Add this line for daily backup
0 2 * * * /usr/local/bin/backup-app.sh

# Add this line for weekly health report email
0 3 * * 0 pm2 status | mail -s "Manage Your Money - Weekly Status" admin@example.com
```

### View Backups

```bash
ls -lah /backups/manageyourmoney/
```

### Restore from Backup

```bash
cd /backups/manageyourmoney
tar -xzf backup_YYYYMMDD_HHMMSS.tar.gz -C /
sudo pm2 restart manageyourmoney
```

## 🔐 Security Checklist

- [ ] Update .env.production with real Supabase keys
- [ ] Change default SSH port (optional but recommended)
- [ ] Enable SSH key-based authentication
- [ ] Disable password-based SSH login
- [ ] Configure firewall (only open necessary ports)
- [ ] Enable automatic security updates
- [ ] Set up log monitoring
- [ ] Configure fail2ban for brute-force protection
- [ ] Enable SSL/TLS certificates (Let's Encrypt)
- [ ] Set up regular backups
- [ ] Configure HTTPS redirect

### Additional Security (Optional)

```bash
# Install fail2ban for DDoS protection
sudo apt-get install -y fail2ban

# Install unattended-upgrades for auto-updates
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

## 🚨 Troubleshooting

### App won't start
```bash
# Check PM2 logs
pm2 logs manageyourmoney

# Verify environment variables
cat /var/www/manageyourmoney/.env.production

# Check Node.js/npm
node -v
npm -v

# Manual test
cd /var/www/manageyourmoney
npm run build
npm run preview
```

### Nginx not proxying correctly
```bash
# Test Nginx config
sudo nginx -t

# Check Nginx error logs
sudo tail -50 /var/log/nginx/error.log

# Verify app is running on port 5173
netstat -tulpn | grep 5173
```

### SSL certificate issues
```bash
# Check certificate
sudo certbot certificates

# Renew if expired
sudo certbot renew --force-renewal

# Check certificate details
openssl x509 -text -noout -in /etc/letsencrypt/live/your-domain.com/fullchain.pem
```

### High disk usage
```bash
# Find large files
du -sh /var/www/manageyourmoney/*

# Clean npm cache
npm cache clean --force

# Remove old logs
pm2 flush

# Check backups
du -sh /backups/manageyourmoney
```

### High memory usage
```bash
# Check memory usage
free -h

# Monitor with PM2
pm2 monit

# Check for memory leaks in logs
pm2 logs manageyourmoney | grep -i "memory"
```

## 📈 Performance Optimization

### Enable Gzip Compression
Already configured in Nginx config, verified with:
```bash
curl -I -H "Accept-Encoding: gzip" https://your-domain.com
# Should show: Content-Encoding: gzip
```

### Cache Static Assets
Already configured with 1-year expiry for:
- .js, .css, .png, .jpg, .jpeg, .gif, .ico, .svg, .woff, .woff2, .ttf, .eot

### Enable HTTP/2
Already configured in Nginx with SSL

### Monitor Performance
```bash
# Check response times
tail -f /var/log/nginx/access.log | awk '{print $NF}'

# Check server load
uptime
top -b -n 1 | head -3
```

## 📝 Logs Location

- **App logs**: `/var/log/pm2/out.log` and `/var/log/pm2/err.log`
- **Nginx access**: `/var/log/nginx/access.log`
- **Nginx errors**: `/var/log/nginx/error.log`
- **System logs**: `/var/log/syslog`
- **Backups**: `/backups/manageyourmoney/`

## 🆘 Support & Resources

### Documentation
- [React Vite Documentation](https://vitejs.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [PM2 Documentation](https://pm2.io/docs)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

### Get Help
1. Check logs: `pm2 logs manageyourmoney`
2. Verify configuration: `sudo nginx -t`
3. Check system resources: `pm2 monit`
4. Review GitHub issues: https://github.com/AshishBaboo/ManageYourMoney/issues

---

**Developed by Ashish Baboo** | [ashishbaboo.com](https://ashishbaboo.com)

For issues, updates, or questions, visit the GitHub repository or contact support.
