#!/bin/bash
# Diagnostic script to check instance-level firewall and SSH configuration
# Run this on your EC2 instance via manual SSH

echo "=== EC2 Instance Firewall & SSH Diagnostic ==="
echo ""

echo "1. Checking iptables rules..."
echo "----------------------------------------"
sudo iptables -L -n -v | head -20
echo ""

echo "2. Checking if SSH is listening on port 22..."
echo "----------------------------------------"
sudo netstat -tlnp | grep :22 || ss -tlnp | grep :22
echo ""

echo "3. Checking SSH service status..."
echo "----------------------------------------"
sudo systemctl status sshd --no-pager | head -10
echo ""

echo "4. Checking SSH configuration for restrictions..."
echo "----------------------------------------"
sudo grep -E "AllowUsers|DenyUsers|AllowGroups|DenyGroups|ListenAddress" /etc/ssh/sshd_config || echo "No user/group restrictions found"
echo ""

echo "5. Checking recent SSH connection attempts..."
echo "----------------------------------------"
sudo tail -20 /var/log/secure 2>/dev/null || sudo tail -20 /var/log/auth.log 2>/dev/null || echo "Cannot access SSH logs"
echo ""

echo "6. Checking if port 22 is accessible from localhost..."
echo "----------------------------------------"
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/localhost/22' && echo "✅ Port 22 is accessible from localhost" || echo "❌ Port 22 is NOT accessible from localhost"
echo ""

echo "7. Checking network interfaces..."
echo "----------------------------------------"
ip addr show | grep -E "inet |inet6 "
echo ""

echo "=== Diagnostic Complete ==="
echo ""
echo "If iptables shows blocking rules, run:"
echo "  sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT"
echo "  sudo service iptables save"
echo ""
echo "If SSH config has restrictions, edit:"
echo "  sudo nano /etc/ssh/sshd_config"
echo "  sudo systemctl restart sshd"

