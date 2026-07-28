#!/bin/bash

#############################################################################
# Manage Your Money - Monitoring & Maintenance Script
#############################################################################

set -e

APP_NAME="manageyourmoney"
APP_DIR="/var/www/manageyourmoney"
LOG_DIR="/var/log/manageyourmoney"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    clear
    echo -e "${BLUE}"
    echo "=========================================="
    echo "Manage Your Money - Monitoring Dashboard"
    echo "=========================================="
    echo -e "${NC}"
    echo "Last updated: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}[✓]${NC} $2"
    else
        echo -e "${RED}[✗]${NC} $2"
    fi
}

check_app_status() {
    echo -e "${BLUE}Application Status:${NC}"
    if pm2 list | grep -q "$APP_NAME.*online"; then
        echo -e "${GREEN}✓ App is RUNNING${NC}"
        pm2 list | grep "$APP_NAME"
    else
        echo -e "${RED}✗ App is NOT RUNNING${NC}"
    fi
    echo ""
}

check_nginx_status() {
    echo -e "${BLUE}Nginx Status:${NC}"
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✓ Nginx is RUNNING${NC}"
        echo "  $(nginx -v 2>&1)"
    else
        echo -e "${RED}✗ Nginx is NOT RUNNING${NC}"
    fi
    echo ""
}

check_disk_space() {
    echo -e "${BLUE}Disk Space:${NC}"
    df -h / | tail -1 | awk '{printf "  Root: %s / %s (%.1f%%)\n", $3, $2, $5}'
    df -h /var/www | tail -1 | awk '{printf "  App:  %s / %s (%.1f%%)\n", $3, $2, $5}'
    echo ""
}

check_memory() {
    echo -e "${BLUE}Memory Usage:${NC}"
    free -h | grep "^Mem:" | awk '{printf "  Total: %s | Used: %s (%.1f%%)\n", $2, $3, ($3/$2)*100}'
    echo ""
}

check_cpu() {
    echo -e "${BLUE}CPU Load:${NC}"
    echo "  $(cat /proc/loadavg | awk '{printf "1min: %.2f | 5min: %.2f | 15min: %.2f\n", $1, $2, $3}')"
    echo ""
}

check_errors() {
    echo -e "${BLUE}Recent Errors:${NC}"
    if [ -f "$LOG_DIR/error.log" ]; then
        ERROR_COUNT=$(tail -100 "$LOG_DIR/error.log" | grep -c "ERROR\|error" || echo 0)
        echo "  Errors in last 100 lines: $ERROR_COUNT"
    fi

    if pm2 logs 2>/dev/null | grep -i "error" | head -3; then
        echo ""
    else
        echo "  No recent errors"
    fi
    echo ""
}

show_logs() {
    echo -e "${BLUE}Recent Logs (last 20 lines):${NC}"
    pm2 logs "$APP_NAME" --lines 20 --nostream | tail -20
    echo ""
}

show_menu() {
    echo -e "${BLUE}Options:${NC}"
    echo "  1. View full logs (ctrl+c to exit)"
    echo "  2. Restart app"
    echo "  3. Stop app"
    echo "  4. Start app"
    echo "  5. Clear logs"
    echo "  6. Deploy updates"
    echo "  7. Refresh dashboard"
    echo "  0. Exit"
    echo ""
    read -p "Select option: " choice

    case $choice in
        1) pm2 logs "$APP_NAME" ;;
        2) pm2 restart "$APP_NAME" && sleep 2 ;;
        3) pm2 stop "$APP_NAME" && sleep 2 ;;
        4) pm2 start "$APP_NAME" && sleep 2 ;;
        5)
            echo "Clearing logs..."
            > "$LOG_DIR/error.log"
            pm2 flush
            sleep 1
            ;;
        6)
            echo "Running deploy script..."
            /usr/local/bin/deploy.sh
            sleep 2
            ;;
        7) return 0 ;;
        0) exit 0 ;;
        *) echo "Invalid option" && sleep 1 ;;
    esac
}

# Main loop
while true; do
    print_header
    check_app_status
    check_nginx_status
    check_disk_space
    check_memory
    check_cpu
    check_errors
    show_logs
    show_menu
done
