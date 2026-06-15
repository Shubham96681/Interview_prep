#!/usr/bin/env bash
set -e

echo "📦 EC2 prepare script starting..."

PKG_MGR=""
if command -v dnf >/dev/null 2>&1; then
  PKG_MGR="dnf"
elif command -v yum >/dev/null 2>&1; then
  PKG_MGR="yum"
fi

if [ -z "$PKG_MGR" ]; then
  echo "❌ No supported package manager found (dnf/yum)"
  exit 1
fi

echo "Using package manager: $PKG_MGR"

PACKAGES=""
if ! command -v git >/dev/null 2>&1; then
  PACKAGES="$PACKAGES git"
fi
if ! command -v nginx >/dev/null 2>&1; then
  PACKAGES="$PACKAGES nginx"
fi

if [ -n "$PACKAGES" ]; then
  echo "Installing packages:$PACKAGES"
  sudo $PKG_MGR install -y $PACKAGES
else
  echo "✅ git and nginx already installed"
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "❌ curl is required but not available on this instance"
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "📦 Installing Node.js 20..."
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
  sudo $PKG_MGR install -y nodejs
else
  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "📦 Upgrading Node.js to version 20..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo $PKG_MGR install -y nodejs
  fi
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "📦 Installing PM2..."
  sudo npm install -g pm2
fi

sudo systemctl enable nginx || true
sudo systemctl start nginx || true

echo "✅ Prerequisites ready:"
git --version
node --version
npm --version
pm2 --version || true
nginx -v 2>&1 || true

if [ -z "${EC2_USERNAME:-}" ]; then
  echo "❌ EC2_USERNAME is not set"
  exit 1
fi

echo "Setting up /var/www directory..."
sudo mkdir -p /var/www
sudo chown "$EC2_USERNAME:$EC2_USERNAME" /var/www

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "❌ GITHUB_TOKEN is not set"
  exit 1
fi

REPO_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/Shubham96681/Interview_prep.git"

echo "Syncing repository..."
if [ -d /var/www/interview-prep/.git ]; then
  cd /var/www/interview-prep
  git remote set-url origin "$REPO_URL"
  git fetch origin main
  git reset --hard origin/main
  git clean -fd
  echo "✅ Repository updated"
else
  rm -rf /var/www/interview-prep
  cd /var/www
  git clone "$REPO_URL" interview-prep
  cd interview-prep
  echo "✅ Repository cloned"
fi

sudo chown -R "$EC2_USERNAME:$EC2_USERNAME" /var/www/interview-prep
mkdir -p /var/www/interview-prep/dist
echo "✅ EC2 prepared for deployment"
