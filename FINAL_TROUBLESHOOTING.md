# Final Troubleshooting Steps (Network ACL is Correct)

## ✅ What We've Confirmed:
- Security Group: SSH (port 22) from 0.0.0.0/0 ✅
- Network ACL: Allow all traffic from 0.0.0.0/0 ✅
- Instance is running ✅
- IP is correct: 54.159.42.7 ✅

Since both security group and Network ACL are correct, the issue must be elsewhere.

---

## 🔍 Step 1: Verify Instance Has Public IP

### In AWS Console:
1. Go to **EC2** → **Instances**
2. Select your instance: `i-0fad22450e70f3261`
3. Check the **Networking** tab
4. Verify:
   - **Public IPv4 address:** Should show `54.159.42.7`
   - **Elastic IP:** Should be assigned if using Elastic IP

**If Public IP is missing:**
- The instance might be in a private subnet
- Or the instance doesn't have auto-assign public IP enabled

---

## 🔍 Step 2: Check Subnet Configuration

### In AWS Console:
1. Go to **EC2** → **Instances**
2. Select your instance
3. Click **Networking** tab
4. Note the **Subnet ID**
5. Go to **VPC** → **Subnets**
6. Find your subnet
7. Check:
   - **Auto-assign public IPv4 address:** Should be **Yes**
   - **Route table:** Should have route to Internet Gateway

---

## 🔍 Step 3: Check Route Table

### In AWS Console:
1. Go to **VPC** → **Route Tables**
2. Find the route table associated with your subnet
3. Check the routes:
   - Should have: `0.0.0.0/0` → **Internet Gateway (igw-xxxxx)**
   - If missing, your instance cannot reach the internet

**If route to Internet Gateway is missing:**
- Your instance is in a private subnet
- You need to either:
  - Move instance to a public subnet, OR
  - Add a route to Internet Gateway

---

## 🔍 Step 4: Check Internet Gateway

### In AWS Console:
1. Go to **VPC** → **Internet Gateways**
2. Verify there's an Internet Gateway attached to your VPC: `vpc-09217f1faff9d7120`
3. Check **State:** Should be **Attached**

**If no Internet Gateway:**
- Your VPC doesn't have internet access
- Create and attach an Internet Gateway

---

## 🔍 Step 5: Test SSH from Your Local Machine

From your local machine, try to SSH:

```bash
ssh -i your-key-file.pem ec2-user@54.159.42.7
```

**If this works:**
- Your instance is reachable
- The issue is specific to GitHub Actions
- Check GitHub secret `EC2_SSH_KEY`

**If this doesn't work:**
- The instance might not be publicly accessible
- Check Steps 1-4 above

---

## 🔍 Step 6: Check Instance Security (Firewall on Instance)

If you can SSH in manually, check if there's a firewall blocking:

```bash
# SSH into instance
ssh -i your-key-file.pem ec2-user@54.159.42.7

# Check if SSH service is running
sudo systemctl status sshd
# or
sudo systemctl status ssh

# Check firewall rules (if firewalld is installed)
sudo firewall-cmd --list-all

# Check iptables rules
sudo iptables -L -n
```

---

## 🔍 Step 7: Verify GitHub Secret

1. Go to: https://github.com/Shubham96681/Interview_prep/settings/secrets/actions
2. Verify `EC2_SSH_KEY` exists
3. The key should match the key pair used when creating the EC2 instance

---

## 💡 Most Likely Issues:

### Issue 1: Instance in Private Subnet
- **Symptom:** No public IP or route to Internet Gateway
- **Fix:** Move to public subnet or add Internet Gateway route

### Issue 2: No Internet Gateway
- **Symptom:** Route table doesn't have route to Internet Gateway
- **Fix:** Create and attach Internet Gateway to VPC

### Issue 3: SSH Service Not Running
- **Symptom:** Can't SSH even from local machine
- **Fix:** Restart instance or check SSH service

### Issue 4: Wrong GitHub Secret
- **Symptom:** Can SSH locally but GitHub Actions fails
- **Fix:** Verify `EC2_SSH_KEY` matches EC2 key pair

---

## 🆘 Alternative: Use AWS Systems Manager

If SSH continues to fail, consider using **AWS Systems Manager Session Manager**:

1. No SSH keys needed
2. No port 22 needed
3. Works through AWS API
4. More secure

This requires:
- IAM role with SSM permissions
- SSM Agent (usually pre-installed on Amazon Linux 2)

---

## 📋 Complete Checklist:

- [ ] Instance has Public IP: 54.159.42.7
- [ ] Subnet has auto-assign public IP enabled
- [ ] Route table has route to Internet Gateway (0.0.0.0/0 → igw-xxx)
- [ ] Internet Gateway is attached to VPC
- [ ] Can SSH from local machine
- [ ] SSH service is running on instance
- [ ] GitHub secret `EC2_SSH_KEY` is correct
- [ ] Security Group allows SSH from 0.0.0.0/0 ✅ (Confirmed)
- [ ] Network ACL allows all traffic ✅ (Confirmed)

---

**Check Steps 1-4 first - these are the most common causes when security group and Network ACL are correct!**

