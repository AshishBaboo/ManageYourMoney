#!/bin/bash

#############################################################################
# Manage Your Money - Quick Install Script
# For development/testing environments
#############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "Manage Your Money - Quick Install"
    echo "=========================================="
    echo -e "${NC}"
}

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_section() {
    echo -e "\n${BLUE}▶ $1${NC}\n"
}

print_header

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    print_section "Installing Node.js"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
    apt-get install -y nodejs
    print_status "Node.js installed"
fi

# Install dependencies
print_section "Installing Dependencies"
npm install
print_status "Dependencies installed"

# Setup environment
print_section "Setting Up Environment"
if [ ! -f ".env.local" ]; then
    cat > .env.local << 'EOF'
VITE_SUPABASE_URL=https://uctmoxfalxyczrttyqto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjdG1veGZhbHh5Y3pydHR5cXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTkwMDUsImV4cCI6MjEwMDgzNTAwNX0.TesC6oDwR4bndWvqD7aV9VyJzgq-4j_jbMRfT6moiOY
EOF
    print_status ".env.local created"
else
    print_status ".env.local already exists"
fi

# Ready
print_section "Ready to Start"
echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Update .env.local with your Supabase credentials"
echo "  2. Run: ${YELLOW}npm run dev${NC}"
echo "  3. Open: ${YELLOW}http://localhost:5173${NC}"
echo ""
