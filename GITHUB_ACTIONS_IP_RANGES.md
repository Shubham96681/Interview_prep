# GitHub Actions IP Ranges (Optional Security Enhancement)

## ⚠️ Important Note

**You don't need to do this!** Your security group already allows SSH from `0.0.0.0/0`, which works fine.

However, if you want to **restrict SSH access** for better security, you can allow only GitHub Actions IP ranges instead of allowing from anywhere.

---

## 🔍 Step 1: Get GitHub Actions IP Ranges

GitHub publishes their IP ranges via API:

### Option 1: Use GitHub API (Recommended)
```bash
# Get all GitHub IP ranges
curl https://api.github.com/meta

# Or get just Actions IPs
curl https://api.github.com/meta | jq '.actions[]'
```

### Option 2: Manual List (Changes frequently)
GitHub Actions IPs are in CIDR format like:
- `140.82.112.0/20`
- `143.55.64.0/20`
- `185.199.108.0/22`
- `192.30.252.0/22`
- And more...

**⚠️ Warning:** These IPs change frequently! You'll need to update your security group regularly.

---

## 🔒 Step 2: Update Security Group

### In AWS Console:

1. Go to **EC2** → **Instances** → Select your instance
2. Click **Security** tab → Click security group link
3. Click **Edit inbound rules**
4. **Remove** the current SSH rule (port 22 from 0.0.0.0/0)
5. **Add multiple rules** for each GitHub Actions IP range:
   - Rule 1: SSH | TCP | 22 | `140.82.112.0/20` | Allow
   - Rule 2: SSH | TCP | 22 | `143.55.64.0/20` | Allow
   - Rule 3: SSH | TCP | 22 | `185.199.108.0/22` | Allow
   - Rule 4: SSH | TCP | 22 | `192.30.252.0/22` | Allow
   - ... (add all GitHub Actions IP ranges)
6. **Also add your IP** (if you want to SSH manually):
   - Rule N: SSH | TCP | 22 | `54.91.53.228/32` | Allow
7. Click **Save rules**

---

## ⚠️ Problems with This Approach

1. **IPs Change Frequently:** GitHub updates their IP ranges regularly, so you'll need to update your security group often
2. **Maintenance Overhead:** You'll need to monitor and update the rules
3. **Can Break Deployments:** If GitHub adds new IPs and you haven't updated, deployments will fail
4. **Complex Setup:** You need to add many CIDR blocks

---

## ✅ Recommended Approach

**Keep your security group as is (0.0.0.0/0) and use:**

1. **Strong SSH Keys:** Use secure, unique SSH keys (which you already have)
2. **Key-Based Authentication Only:** Disable password authentication
3. **Regular Key Rotation:** Rotate SSH keys periodically
4. **Monitor Access:** Use CloudTrail to monitor SSH access
5. **Consider AWS Systems Manager:** Use Session Manager instead of SSH (no port 22 needed)

---

## 🆘 Alternative: Use AWS Systems Manager

Instead of SSH, use **AWS Systems Manager Session Manager**:

### Benefits:
- ✅ No SSH keys needed
- ✅ No port 22 needed (more secure)
- ✅ Works through AWS API
- ✅ Better audit trail
- ✅ No IP restrictions needed

### Setup:
1. Attach IAM role with SSM permissions to EC2 instance
2. SSM Agent is pre-installed on Amazon Linux 2
3. Use AWS CLI or Systems Manager console to connect
4. Update GitHub Actions workflow to use SSM instead of SSH

---

## 💡 Recommendation

**For now, keep your security group as `0.0.0.0/0`** because:
- It's simpler
- It works reliably
- Your SSH key provides security
- GitHub Actions IPs change frequently

If you want better security, consider **AWS Systems Manager** instead of restricting IPs.

---

## 📋 Summary

- ❌ **Don't add your IP to GitHub secrets** - it won't help
- ❌ **Don't restrict to GitHub IPs** - they change too often
- ✅ **Keep security group as 0.0.0.0/0** - it works fine
- ✅ **Use strong SSH keys** - this is your security
- ✅ **Consider Systems Manager** - better long-term solution

