#!/bin/bash

#############################################################################
# Manage Your Money - Deployment & Update Script
# Used to deploy updates and restart the application
#############################################################################

set -e

APP_DIR="/var/www/manageyourmoney"
APP_NAME="manageyourmoney"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_section() {
    echo -e "\n${BLUE}▶ $1${NC}\n"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    print_error "This script must be run as root"
    exit 1
fi

print_section "Manage Your Money - Deployment"

# Pull latest changes
print_section "Pulling Latest Changes"
cd "$APP_DIR"
git pull origin main
print_status "Repository updated"

# Install dependencies
print_section "Installing Dependencies"
npm ci --production
print_status "Dependencies installed"

# Build application
print_section "Building Application"
npm run build
print_status "Application built"

# Restart app
print_section "Restarting Application"
pm2 restart "$APP_NAME"
pm2 save
print_status "Application restarted"

# Verify
print_section "Verifying Deployment"
if pm2 list | grep -q "$APP_NAME.*online"; then
    print_status "App is running successfully"
    echo ""
    echo "Logs:"
    pm2 logs "$APP_NAME" --lines 20
else
    print_error "App failed to start"
    exit 1
fi

echo -e "\n${GREEN}Deployment completed successfully!${NC}"
