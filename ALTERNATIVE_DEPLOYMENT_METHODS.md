# Alternative Deployment Methods for GitHub Actions

Since SSH connection is timing out from GitHub Actions even though:
- ✅ Security group allows `0.0.0.0/0`
- ✅ Instance is running
- ✅ Manual SSH works
- ✅ GitHub secret is set

Here are alternative deployment methods:

---

## Option 1: Use AWS Systems Manager (Recommended)

Instead of SSH, use AWS Systems Manager Session Manager. This is more secure and doesn't require opening port 22.

### Setup Steps:

1. **Attach IAM Role to EC2 Instance:**
   - Go to EC2 → Instances → Select your instance
   - Click **Actions** → **Security** → **Modify IAM role**
   - Attach a role with `AmazonSSMManagedInstanceCore` policy
   - Or create a new role with this policy

2. **Install SSM Agent (usually pre-installed on Amazon Linux 2):**
   ```bash
   sudo systemctl status amazon-ssm-agent
   # If not running:
   sudo systemctl start amazon-ssm-agent
   sudo systemctl enable amazon-ssm-agent
   ```

3. **Update GitHub Actions Workflow:**
   Use `aws-actions/configure-aws-credentials` and `aws-systems-manager` instead of SSH.

---

## Option 2: Use GitHub Actions with AWS CLI

Deploy using AWS CLI commands through GitHub Actions:

```yaml
- name: Deploy via AWS CLI
  uses: aws-actions/configure-aws-credentials@v2
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: us-east-1

- name: Run deployment command
  run: |
    aws ssm send-command \
      --instance-ids "i-0fad22450e70f3261" \
      --document-name "AWS-RunShellScript" \
      --parameters 'commands=["cd /var/www/interview-prep && git pull && ./deploy.sh"]'
```

---

## Option 3: Use CodeDeploy

Set up AWS CodeDeploy for automated deployments:

1. Create a CodeDeploy application
2. Create a deployment group
3. Use GitHub Actions to trigger CodeDeploy deployments

---

## Option 4: Check Instance-Level Firewall

The instance itself might have firewall rules blocking connections:

### Check iptables on EC2:
```bash
# SSH into your instance
ssh -i your-key.pem ec2-user@54.159.42.7

# Check iptables rules
sudo iptables -L -n -v

# If there are blocking rules, allow SSH:
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo service iptables save
```

### Check SSH configuration:
```bash
# Check SSH config
sudo cat /etc/ssh/sshd_config | grep -E "AllowUsers|DenyUsers|AllowGroups|DenyGroups"

# Restart SSH service
sudo systemctl restart sshd
```

---

## Option 5: Use GitHub Actions with Different SSH Action

Try a different SSH action that might handle connections better:

```yaml
- name: Deploy to EC2
  uses: appleboy/scp-action@master
  with:
    host: 54.159.42.7
    username: ec2-user
    key: ${{ secrets.EC2_SSH_KEY }}
    port: 22
    source: "."
    target: "/var/www/interview-prep"
```

---

## Option 6: Manual Deployment Script

Create a script that you can run manually or via cron:

1. **On EC2 instance, create a deployment script:**
   ```bash
   # /var/www/interview-prep/auto-deploy.sh
   #!/bin/bash
   cd /var/www/interview-prep
   git fetch origin main
   git reset --hard origin/main
   ./deploy.sh
   ```

2. **Set up a webhook endpoint** that triggers this script
3. **Use GitHub webhooks** to call this endpoint on push

---

## Option 7: Check Network ACLs

Network ACLs at the VPC level might be blocking:

1. Go to **VPC** → **Network ACLs**
2. Find the network ACL for your instance's subnet
3. Check **Inbound rules**:
   - Should allow SSH (port 22) from `0.0.0.0/0`
   - Should allow HTTP (port 80) from `0.0.0.0/0`

---

## Option 8: Use GitHub Actions with Retry Logic

Add more robust retry logic and connection testing:

```yaml
- name: Deploy to EC2
  continue-on-error: true
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: 54.159.42.7
    username: ec2-user
    key: ${{ secrets.EC2_SSH_KEY }}
    port: 22
    timeout: 600s
    command_timeout: 600s
    script: |
      # Your deployment commands here
```

---

## Option 9: Use GitHub Actions with Different Port

If port 22 is being blocked, try using a different port:

1. **Change SSH port on EC2:**
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Change: Port 22 to Port 2222
   sudo systemctl restart sshd
   ```

2. **Update security group** to allow port 2222
3. **Update GitHub Actions** to use port 2222

---

## Option 10: Use GitHub Actions with Proxy

If GitHub Actions IPs are being blocked, use a proxy:

```yaml
- name: Deploy to EC2 via Proxy
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: 54.159.42.7
    username: ec2-user
    key: ${{ secrets.EC2_SSH_KEY }}
    proxy_host: your-proxy-host
    proxy_port: 8080
    proxy_username: proxy-user
    proxy_password: ${{ secrets.PROXY_PASSWORD }}
```

---

## Recommended Solution

**Try Option 1 (AWS Systems Manager)** - It's the most reliable and secure method, and doesn't require opening port 22.

If that's not possible, **try Option 4 (Check Instance-Level Firewall)** - The instance might have iptables rules blocking connections.

---

## Quick Diagnostic Commands

Run these on your EC2 instance to diagnose:

```bash
# Check if SSH is listening on port 22
sudo netstat -tlnp | grep :22

# Check SSH service status
sudo systemctl status sshd

# Check iptables
sudo iptables -L -n -v

# Check SSH logs
sudo tail -f /var/log/secure

# Test SSH connection from instance itself
ssh -v localhost
```

