# Troubleshooting Connection Timeout (Security Group is Correct)

## ✅ Security Group is Correctly Configured

Your security group shows:
- SSH (port 22): `0.0.0.0/0` ✅
- HTTP (port 80): `0.0.0.0/0` ✅
- HTTPS (port 443): `0.0.0.0/0` ✅

Since the security group is correct but you're still getting connection timeouts, here are other possible causes:

---

## 🔍 Step 1: Check EC2 Instance Status

### In AWS Console:
1. Go to **EC2** → **Instances**
2. Find your instance: `i-0fad22450e70f3261`
3. Check the **Instance State**:
   - ✅ **Running** = Good, continue to Step 2
   - ⚠️ **Stopped** = Start the instance
   - ⚠️ **Stopping/Starting** = Wait for it to finish
   - ❌ **Terminated** = Instance is gone, need to create new one

### Check Instance Health:
- Look at **Status checks**:
  - ✅ **2/2 checks passed** = Instance is healthy
  - ⚠️ **1/2 checks passed** = Instance might have issues
  - ❌ **0/2 checks passed** = Instance is unhealthy

---

## 🔄 Step 2: Restart the Instance

If the instance is running but unresponsive:

1. **Stop the instance:**
   - Select the instance
   - Click **Instance state** → **Stop instance**
   - Wait 1-2 minutes for it to stop

2. **Start the instance:**
   - Select the instance
   - Click **Instance state** → **Start instance**
   - Wait 1-2 minutes for it to start
   - **Note:** The public IP might change!

3. **Update the IP in workflow if it changed:**
   - Check the new **Public IPv4 address**
   - Update `.github/workflows/deploy.yml` if it's different from `54.159.42.7`

---

## 🌐 Step 3: Check Network ACLs

Network ACLs can also block traffic:

1. Go to **VPC** → **Network ACLs**
2. Find the network ACL associated with your instance's subnet
3. Check **Inbound rules**:
   - Should allow SSH (port 22) from `0.0.0.0/0`
   - Should allow HTTP (port 80) from `0.0.0.0/0`

---

## 🔧 Step 4: Test SSH Connection Manually

From your local machine, test if you can SSH in:

```bash
ssh -i your-key-file.pem ec2-user@54.159.42.7
```

**If this works:**
- Your local connection is fine
- The issue is specific to GitHub Actions
- Check if the GitHub secret `EC2_SSH_KEY` is correct

**If this doesn't work:**
- The instance might be down or SSH service is not running
- Try restarting the instance (Step 2)

---

## 🔑 Step 5: Verify GitHub Secret

1. Go to: https://github.com/Shubham96681/Interview_prep
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Verify `EC2_SSH_KEY` exists and contains your full private key:
   ```
   -----BEGIN RSA PRIVATE KEY-----
   [entire key content]
   -----END RSA PRIVATE KEY-----
   ```

4. **Important:** The key must match the key pair used when creating the EC2 instance

---

## 🚨 Step 6: Check CloudWatch Logs

1. Go to **CloudWatch** → **Logs**
2. Check for any system logs or errors
3. Look for SSH-related errors or connection issues

---

## 🔄 Step 7: Try Manual Deployment

If you can SSH in manually, try running the deployment script directly:

```bash
# SSH into instance
ssh -i your-key-file.pem ec2-user@54.159.42.7

# Navigate to project
cd /var/www/interview-prep

# Pull latest changes
git fetch origin main
git reset --hard origin/main

# Run deployment script
./deploy.sh
```

---

## 📋 Quick Checklist

- [ ] Instance is **Running** (not stopped/terminated)
- [ ] Status checks show **2/2 checks passed**
- [ ] Security group allows SSH from `0.0.0.0/0` ✅ (Already confirmed)
- [ ] Network ACLs allow SSH from `0.0.0.0/0`
- [ ] Can SSH in manually from your local machine
- [ ] GitHub secret `EC2_SSH_KEY` is set correctly
- [ ] Instance has been restarted recently (if it was stuck)

---

## 🆘 If Nothing Works

### Option 1: Create New EC2 Instance
If the instance is corrupted:
1. Create a new EC2 instance
2. Use the same key pair
3. Update IP in `.github/workflows/deploy.yml`
4. Run initial setup again

### Option 2: Use AWS Systems Manager Session Manager
Instead of SSH, use AWS Systems Manager:
- No need for SSH keys
- No need to open port 22
- More secure
- Requires IAM role setup

---

## 💡 Most Likely Solution

Since your security group is correct, the most likely issues are:

1. **Instance needs restart** - Try stopping and starting it
2. **Instance IP changed** - Check the new IP and update the workflow
3. **SSH service is down** - Restart the instance to fix this
4. **GitHub secret is wrong** - Verify the SSH key in GitHub secrets

**Try restarting the instance first** - this fixes most connection timeout issues when the security group is correct.

