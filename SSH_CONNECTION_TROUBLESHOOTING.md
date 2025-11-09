# SSH Connection Error Troubleshooting Guide

## Error: "Failed to connect to your instance - Error establishing SSH connection"

This error occurs when GitHub Actions cannot SSH into your EC2 instance. Here are the most common causes and solutions:

---

## 🔍 Step 1: Check EC2 Instance Status

### In AWS Console:
1. Go to **EC2 Dashboard** → **Instances**
2. Find your instance: `i-0fad22450e70f3261` (IP: `54.159.42.7`)
3. Check the **Instance State**:
   - ✅ **Running** = Good, continue to Step 2
   - ⚠️ **Stopped** = Start the instance
   - ❌ **Terminated** = Instance is gone, need to create new one
   - ⚠️ **Stopping/Starting** = Wait for it to finish

### If Instance is Stopped:
1. Select the instance
2. Click **Instance state** → **Start instance**
3. Wait 1-2 minutes for it to start
4. Note the new **Public IP** (it might have changed)
5. Update the IP in `.github/workflows/deploy.yml` if it changed

---

## 🔒 Step 2: Check Security Group Rules

### In AWS Console:
1. Select your instance
2. Click **Security** tab
3. Click on the **Security group** link
4. Click **Edit inbound rules**

### Required Rules:
| Type | Protocol | Port | Source | Description |
|------|----------|------|--------|-------------|
| SSH | TCP | 22 | **0.0.0.0/0** | **CRITICAL: Allow SSH from anywhere** |
| HTTP | TCP | 80 | 0.0.0.0/0 | Web access |
| Custom TCP | TCP | 5000 | 127.0.0.1 | Backend (local only) |

**⚠️ CRITICAL:** GitHub Actions runs from different IP addresses (not your IP: 13.221.81.1). 
- ❌ **WRONG:** Allowing SSH only from your IP (13.221.81.1) will cause connection failures
- ✅ **CORRECT:** You MUST allow SSH (port 22) from `0.0.0.0/0` to allow GitHub Actions to connect

### If SSH is restricted to your IP:
1. Click **Edit inbound rules**
2. Find the SSH rule (port 22)
3. Change **Source** from `Your IP` to `0.0.0.0/0`
4. Click **Save rules**

**Security Note:** This allows SSH from anywhere. For better security, you can:
- Use AWS Systems Manager Session Manager instead
- Or restrict to GitHub Actions IP ranges (but they change frequently)

---

## 🔑 Step 3: Verify SSH Key in GitHub Secrets

### Check GitHub Secret:
1. Go to: https://github.com/Shubham96681/Interview_prep
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Verify `EC2_SSH_KEY` exists
4. If missing or incorrect:
   - Get your EC2 private key file (`.pem` file)
   - Copy the entire content including:
     ```
     -----BEGIN RSA PRIVATE KEY-----
     [entire key content]
     -----END RSA PRIVATE KEY-----
     ```
   - Update or create the secret with this content

### Test SSH Key Locally:
On your local machine, test if the key works:
```bash
ssh -i your-key-file.pem ec2-user@54.159.42.7
```

If this works, the key is correct. If not, check:
- Key file permissions: `chmod 400 your-key-file.pem`
- Key matches the instance's key pair

---

## 💾 Step 4: Check if Instance Crashed (Disk Space)

The instance might have crashed due to disk space issues. Check via AWS Console:

### Option A: Use AWS Systems Manager (if enabled)
1. Go to **EC2** → **Instances**
2. Select your instance
3. Click **Connect** → **Session Manager** (if available)
4. Run: `df -h` to check disk space

### Option B: Check CloudWatch Logs
1. Go to **CloudWatch** → **Logs**
2. Check for any system logs or errors

### Option C: Restart the Instance
If the instance is unresponsive:
1. Stop the instance (wait for it to stop)
2. Start the instance (wait for it to start)
3. Try SSH again after 2-3 minutes

---

## 🌐 Step 5: Check Network Connectivity

### Test if instance is reachable:
```bash
# From your local machine
ping 54.159.42.7

# Test SSH port
telnet 54.159.42.7 22
# or
nc -zv 54.159.42.7 22
```

If ping fails:
- Instance might be stopped
- Security group might be blocking ICMP
- Network ACLs might be blocking

If port 22 is closed:
- Security group is blocking SSH
- Go back to Step 2

---

## 🔧 Step 6: Update GitHub Actions Workflow

If the instance IP changed, update the workflow:

1. Edit `.github/workflows/deploy.yml`
2. Update the `host` value:
   ```yaml
   host: 54.159.42.7  # Update to new IP if changed
   ```

---

## 🚨 Step 7: Manual Cleanup (If Instance is Full)

If you can SSH in manually, run these commands to free space:

```bash
# SSH into instance
ssh -i your-key-file.pem ec2-user@54.159.42.7

# Check disk space
df -h

# Clean up old files
cd /var/www/interview-prep
rm -rf node_modules server/node_modules dist
npm cache clean --force
pm2 flush
git gc --prune=now --aggressive

# Check space again
df -h
```

---

## ✅ Step 8: Test Connection from GitHub Actions

After fixing the issues, test the deployment:

1. Go to: https://github.com/Shubham96681/Interview_prep/actions
2. Click **Run workflow** → **Run workflow** (manual trigger)
3. Watch the logs to see if SSH connection succeeds

---

## 🔄 Quick Fix Checklist

- [ ] Instance is **Running** (not stopped/terminated)
- [ ] Security group allows SSH (port 22) from `0.0.0.0/0`
- [ ] GitHub secret `EC2_SSH_KEY` is set correctly
- [ ] SSH key works when testing locally
- [ ] Instance IP hasn't changed (or updated in workflow)
- [ ] Instance has enough disk space (check via AWS Console or restart)
- [ ] Network connectivity is working (ping/port test)

---

## 🆘 If Nothing Works

### Option 1: Create New EC2 Instance
If the instance is corrupted or terminated:
1. Create a new EC2 instance
2. Use the same key pair
3. Update IP in `.github/workflows/deploy.yml`
4. Run initial setup again

### Option 2: Use AWS Systems Manager
Instead of SSH, use AWS Systems Manager Session Manager:
- No need for SSH keys
- No need to open port 22
- More secure
- Requires IAM role setup

### Option 3: Contact AWS Support
If the instance is in a bad state and you can't access it.

---

## 📝 Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Connection timeout" | Security group blocking | Allow port 22 from 0.0.0.0/0 |
| "Permission denied" | Wrong SSH key | Check GitHub secret matches EC2 key |
| "Host key verification failed" | Key mismatch | Regenerate or verify key |
| "No route to host" | Instance stopped | Start the instance |
| "Connection refused" | SSH service down | Restart instance or check system logs |

---

**Need more help?** Check AWS EC2 documentation or AWS Support.

