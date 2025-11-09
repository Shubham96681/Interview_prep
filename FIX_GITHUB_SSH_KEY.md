# Fix GitHub Actions SSH Key Secret

## ✅ What We Know:
- Local SSH works: `ssh -i your-key-file.pem ec2-user@54.159.42.7` ✅
- Security Group is correct ✅
- Network ACL is correct ✅
- Instance is publicly accessible ✅

**The issue is with the GitHub secret `EC2_SSH_KEY`**

---

## 🔑 Step 1: Get Your Private Key Content

On your local machine, get the full content of your private key:

### Windows (PowerShell):
```powershell
Get-Content your-key-file.pem
```

### Linux/Mac:
```bash
cat your-key-file.pem
```

**Copy the ENTIRE output**, including:
```
-----BEGIN RSA PRIVATE KEY-----
[entire key content - multiple lines]
-----END RSA PRIVATE KEY-----
```

**OR if it's a different format:**
```
-----BEGIN OPENSSH PRIVATE KEY-----
[entire key content]
-----END OPENSSH PRIVATE KEY-----
```

---

## 🔑 Step 2: Update GitHub Secret

1. Go to: https://github.com/Shubham96681/Interview_prep/settings/secrets/actions

2. Find `EC2_SSH_KEY` secret

3. Click **Update** (or create it if it doesn't exist)

4. **Paste the ENTIRE private key content** (from Step 1)

5. **Important:** Make sure:
   - ✅ The key starts with `-----BEGIN`
   - ✅ The key ends with `-----END`
   - ✅ All lines are included (no truncation)
   - ✅ No extra spaces or characters
   - ✅ The key matches the one you use locally

6. Click **Update secret**

---

## 🔍 Step 3: Verify Key Format

The key should look exactly like this (example):

```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
[multiple lines of base64 encoded content]
...
-----END RSA PRIVATE KEY-----
```

**Common mistakes:**
- ❌ Missing `-----BEGIN` or `-----END` lines
- ❌ Extra spaces or line breaks
- ❌ Only part of the key copied
- ❌ Wrong key file (using public key instead of private key)

---

## 🔍 Step 4: Verify Key Matches EC2 Key Pair

1. Go to **EC2** → **Key Pairs**
2. Find the key pair used when creating your instance
3. Make sure the GitHub secret matches this key pair

**Note:** You cannot download the private key from AWS if you created the key pair in AWS. You must use the `.pem` file you saved when creating the key pair.

---

## 🔄 Step 5: Test After Updating

After updating the GitHub secret:

1. Go to: https://github.com/Shubham96681/Interview_prep/actions
2. Click **Run workflow** → **Run workflow** (manual trigger)
3. Watch the deployment logs
4. Check if SSH connection succeeds

---

## 🆘 Alternative: Generate New Key Pair

If you lost your private key or it's not working:

### Option 1: Create New Key Pair in AWS
1. Go to **EC2** → **Key Pairs** → **Create key pair**
2. Download the `.pem` file
3. Update GitHub secret with the new key
4. **Note:** You'll need to update the key on the instance if you want to use it

### Option 2: Use Existing Key
If you have the `.pem` file locally, use that one.

---

## 💡 Quick Checklist:

- [ ] Copied ENTIRE private key (including BEGIN/END lines)
- [ ] Pasted into GitHub secret `EC2_SSH_KEY`
- [ ] Key matches the EC2 key pair
- [ ] No extra spaces or characters
- [ ] Saved the secret
- [ ] Triggered new deployment to test

---

**After updating the GitHub secret, the deployment should work!**

