# Check Your Network ACL Rules

## Your Network ACL Details:
- **Network ACL ID:** `acl-072cb06a87f0de2f9`
- **Type:** Default Network ACL
- **Associated with:** 6 Subnets
- **VPC ID:** `vpc-09217f1faff9d7120`
- **Inbound rules:** 2 rules
- **Outbound rules:** 2 rules

---

## 🔍 Step 1: Check Inbound Rules

1. Click on the Network ACL ID: `acl-072cb06a87f0de2f9`
2. Click **Inbound rules** tab
3. Check what the 2 rules are

### Expected Rules (Default Network ACL):
The default Network ACL should have:
- **Rule 100:** Allow all traffic from `0.0.0.0/0` (IPv4)
- **Rule 101:** Allow all traffic from `::/0` (IPv6)

### If Rules Are Different:
If you see rules like:
- ❌ **Deny all traffic** - This will block SSH
- ❌ **Allow only specific IPs** - This will block GitHub Actions
- ✅ **Allow all traffic (0.0.0.0/0)** - This is correct

---

## 🔍 Step 2: Check Outbound Rules

1. Click **Outbound rules** tab
2. Check what the 2 rules are

### Expected Rules (Default Network ACL):
The default Network ACL should have:
- **Rule 100:** Allow all traffic to `0.0.0.0/0` (IPv4)
- **Rule 101:** Allow all traffic to `::/0` (IPv6)

---

## ✅ Step 3: Fix If Needed

### If Rules Are Blocking Traffic:

1. **Edit Inbound Rules:**
   - Click **Edit inbound rules**
   - If there's a "Deny All" rule, either:
     - Delete it, OR
     - Add an "Allow All" rule with a lower rule number (e.g., 100)
   - Add rule:
     - **Rule number:** 100
     - **Type:** All traffic
     - **Protocol:** All
     - **Port range:** All
     - **Source:** 0.0.0.0/0
     - **Allow/Deny:** Allow
   - Click **Save changes**

2. **Edit Outbound Rules:**
   - Click **Edit outbound rules**
   - Same as above - ensure there's an "Allow All" rule
   - Add rule:
     - **Rule number:** 100
     - **Type:** All traffic
     - **Protocol:** All
     - **Port range:** All
     - **Destination:** 0.0.0.0/0
     - **Allow/Deny:** Allow
   - Click **Save changes**

---

## 📋 What to Look For

**✅ CORRECT Configuration:**
```
Inbound Rules:
Rule #100: All traffic | All | All | 0.0.0.0/0 | Allow

Outbound Rules:
Rule #100: All traffic | All | All | 0.0.0.0/0 | Allow
```

**❌ WRONG Configuration:**
```
Inbound Rules:
Rule #100: All traffic | All | All | 0.0.0.0/0 | Deny  ← This blocks everything!
```

---

## 💡 Quick Fix

If you want to quickly test, you can temporarily:
1. Delete all custom rules
2. The default Network ACL should automatically allow all traffic

Or add explicit allow rules as shown above.

---

**After fixing the Network ACL rules, try the deployment again!**

