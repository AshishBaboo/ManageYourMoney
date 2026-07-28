#!/bin/bash

#############################################################################
# ManageYourMoney - VPS Installation & Deployment Script
# Developed by Ashish Baboo (ashishbaboo.com)
#
# This script sets up a production-ready React + Node.js environment
# on a Linux VPS with Nginx, SSL, PM2, and Supabase integration
#############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="manageyourmoney"
APP_DIR="/var/www/${APP_NAME}"
APP_USER="www-data"
APP_PORT=5173
NODE_ENV="production"
DOMAIN="${1:-money.ashishbaboo.com}"

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "ManageYourMoney - VPS Setup"
    echo "=========================================="
    echo -e "${NC}"
}

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_section() {
    echo -e "\n${BLUE}▶ $1${NC}\n"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root"
        exit 1
    fi
}

# Update system
update_system() {
    print_section "Updating System Packages"
    apt-get update
    apt-get upgrade -y
    print_status "System packages updated"
}

# Install Node.js
install_nodejs() {
    print_section "Installing Node.js & npm"

    if command -v node &> /dev/null; then
        print_warning "Node.js already installed: $(node -v)"
        return
    fi

    # Install NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs

    print_status "Node.js $(node -v) installed"
    print_status "npm $(npm -v) installed"
}

# Install PM2
install_pm2() {
    print_section "Installing PM2 (Process Manager)"

    if npm list -g pm2 &> /dev/null; then
        print_warning "PM2 already installed"
        return
    fi

    npm install -g pm2
    pm2 startup
    pm2 save

    print_status "PM2 installed and configured"
}

# Install Nginx
install_nginx() {
    print_section "Installing Nginx"

    if command -v nginx &> /dev/null; then
        print_warning "Nginx already installed: $(nginx -v 2>&1)"
        return
    fi

    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx

    print_status "Nginx installed and started"
}

# Install SSL/TLS (Let's Encrypt)
install_certbot() {
    print_section "Installing Certbot (Let's Encrypt)"

    apt-get install -y certbot python3-certbot-nginx

    print_status "Certbot installed"
}

# Install Git
install_git() {
    print_section "Installing Git"

    if command -v git &> /dev/null; then
        print_warning "Git already installed: $(git --version)"
        return
    fi

    apt-get install -y git
    print_status "Git installed"
}

# Clone repository
clone_repository() {
    print_section "Cloning Repository"

    if [ -d "$APP_DIR" ]; then
        print_warning "App directory already exists. Pulling latest changes..."
        cd "$APP_DIR"
        git pull origin main
    else
        mkdir -p "$APP_DIR"
        git clone https://github.com/AshishBaboo/ManageYourMoney.git "$APP_DIR"
        cd "$APP_DIR"
    fi

    print_status "Repository cloned/updated"
}

# Setup environment
setup_environment() {
    print_section "Setting Up Environment Variables"

    cat > "$APP_DIR/.env.production" << 'EOF'
NODE_ENV=production
VITE_SUPABASE_URL=https://uctmoxfalxyczrttyqto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjdG1veGZhbHh5Y3pydHR5cXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTkwMDUsImV4cCI6MjEwMDgzNTAwNX0.TesC6oDwR4bndWvqD7aV9VyJzgq-4j_jbMRfT6moiOY
EOF

    chown "$APP_USER:$APP_USER" "$APP_DIR/.env.production"
    chmod 600 "$APP_DIR/.env.production"

    print_status "Environment variables configured"
    print_warning "Review .env.production and update SUPABASE keys if needed"
}

# Install dependencies
install_dependencies() {
    print_section "Installing Node Dependencies"

    cd "$APP_DIR"
    npm ci --production

    print_status "Dependencies installed"
}

# Build application
build_application() {
    print_section "Building Application"

    cd "$APP_DIR"
    npm run build

    print_status "Application built successfully"
}

# Configure PM2
configure_pm2() {
    print_section "Configuring PM2"

    cat > "$APP_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [{
    name: 'manageyourmoney',
    script: 'npm',
    args: 'run preview',
    cwd: '/var/www/manageyourmoney',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/pm2/err.log',
    out_file: '/var/log/pm2/out.log',
    log_file: '/var/log/pm2/combined.log',
    time: true
  }]
};
EOF

    cd "$APP_DIR"
    pm2 start ecosystem.config.js
    pm2 save

    print_status "PM2 configured and app started"
}

# Configure Nginx
configure_nginx() {
    print_section "Configuring Nginx"

    cat > "/etc/nginx/sites-available/${APP_NAME}" << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    # SSL certificates (update paths after running certbot)
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Proxy settings
    location / {
        proxy_pass http://localhost:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }
}
EOF

    # Enable site
    ln -sf "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"

    # Remove default site if exists
    rm -f /etc/nginx/sites-enabled/default

    # Test Nginx configuration
    if nginx -t; then
        systemctl reload nginx
        print_status "Nginx configured and reloaded"
    else
        print_error "Nginx configuration error"
        exit 1
    fi
}

# Setup SSL certificate
setup_ssl() {
    print_section "Setting Up SSL Certificate"

    if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
        print_warning "SSL certificate already exists for ${DOMAIN}"
        return
    fi

    certbot certonly --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "ashish@ashishbaboo.com"

    # Add auto-renewal
    systemctl enable certbot.timer
    systemctl start certbot.timer

    print_status "SSL certificate configured with auto-renewal"
}

# Setup firewall
setup_firewall() {
    print_section "Setting Up Firewall"

    if ! command -v ufw &> /dev/null; then
        apt-get install -y ufw
    fi

    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable

    print_status "Firewall configured (22, 80, 443 open)"
}

# Setup logs
setup_logs() {
    print_section "Setting Up Logs"

    mkdir -p /var/log/pm2
    chown -R "$APP_USER:$APP_USER" /var/log/pm2

    print_status "Log directories created"
}

# Setup backup
setup_backup() {
    print_section "Setting Up Automated Backups"

    cat > /usr/local/bin/backup-app.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/manageyourmoney"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/backup_${DATE}.tar.gz" /var/www/manageyourmoney/
# Keep only last 7 backups
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +7 -delete
EOF

    chmod +x /usr/local/bin/backup-app.sh

    # Add to crontab (daily at 2 AM)
    (crontab -l 2>/dev/null | grep -v backup-app.sh; echo "0 2 * * * /usr/local/bin/backup-app.sh") | crontab -

    print_status "Automated backup configured (daily at 2 AM)"
}

# Health check
health_check() {
    print_section "Performing Health Checks"

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not installed"
        exit 1
    fi
    print_status "Node.js: $(node -v)"

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm not installed"
        exit 1
    fi
    print_status "npm: $(npm -v)"

    # Check Nginx
    if ! command -v nginx &> /dev/null; then
        print_error "Nginx not installed"
        exit 1
    fi
    print_status "Nginx: $(nginx -v 2>&1)"

    # Check PM2
    if ! command -v pm2 &> /dev/null; then
        print_error "PM2 not installed"
        exit 1
    fi
    print_status "PM2: $(pm2 -v)"

    # Check app status
    if pm2 list | grep -q "manageyourmoney"; then
        print_status "App running via PM2"
    else
        print_warning "App not running via PM2"
    fi
}

# Print summary
print_summary() {
    print_section "Installation Complete"

    echo -e "${GREEN}"
    echo "=========================================="
    echo "ManageYourMoney Setup Summary"
    echo "=========================================="
    echo -e "${NC}"

    echo "App Directory:  $APP_DIR"
    echo "Domain:         $DOMAIN"
    echo "App Port:       $APP_PORT"
    echo "Node Env:       $NODE_ENV"
    echo "App User:       $APP_USER"
    echo ""

    echo -e "${YELLOW}Important Next Steps:${NC}"
    echo "1. Update Supabase credentials in .env.production"
    echo "2. Run: certbot certonly --nginx -d $DOMAIN"
    echo "3. Monitor logs: pm2 logs manageyourmoney"
    echo "4. Check status: pm2 list"
    echo ""

    echo -e "${BLUE}Useful Commands:${NC}"
    echo "pm2 start ecosystem.config.js       # Start app"
    echo "pm2 stop manageyourmoney             # Stop app"
    echo "pm2 restart manageyourmoney          # Restart app"
    echo "pm2 logs manageyourmoney             # View logs"
    echo "pm2 monit                            # Monitor resources"
    echo "sudo systemctl restart nginx         # Restart Nginx"
    echo ""

    echo -e "${GREEN}Access your app at: https://${DOMAIN}${NC}"
    echo ""
}

# Main execution
main() {
    print_header

    check_root
    update_system
    install_git
    install_nodejs
    install_pm2
    install_nginx
    install_certbot
    clone_repository
    setup_environment
    install_dependencies
    build_application
    setup_logs
    configure_pm2
    configure_nginx
    setup_firewall
    setup_backup
    health_check
    print_summary
}

# Run main function
main "$@"
