# Network ACL Troubleshooting Guide

## Problem: Connection Timeout Despite Correct Security Group

If your security group is correctly configured (SSH port 22 from 0.0.0.0/0) but GitHub Actions still cannot connect, the issue is likely **Network ACLs**.

---

## 🔍 What are Network ACLs?

Network ACLs are **stateless firewalls** at the subnet level that can block traffic even if your security group allows it. They work at a different layer than security groups.

**Important:** Network ACLs can override security group rules!

---

## ✅ Step 1: Check Network ACLs

### In AWS Console:

1. Go to **VPC** → **Network ACLs**
2. Find the Network ACL associated with your instance's subnet:
   - Go to **EC2** → **Instances**
   - Select your instance
   - Click **Networking** tab
   - Note the **Subnet ID**
   - Go back to **VPC** → **Network ACLs**
   - Find the Network ACL that has your subnet ID in the **Associated subnets** column

3. Click on the Network ACL
4. Click **Inbound rules** tab
5. Check if there's a rule allowing SSH (port 22)

### Required Inbound Rules:

| Rule # | Type | Protocol | Port Range | Source | Allow/Deny |
|--------|------|----------|------------|--------|------------|
| 100 | SSH | TCP | 22 | 0.0.0.0/0 | ✅ Allow |
| * | All traffic | All | All | 0.0.0.0/0 | ✅ Allow |

**Important:** Network ACL rules are evaluated in order (lowest rule number first). If you have a "Deny All" rule with a lower number, it will block everything.

### If SSH rule is missing:

1. Click **Edit inbound rules**
2. Click **Add rule**
3. Set:
   - **Rule number:** 100 (or any number lower than your "Deny All" rule)
   - **Type:** SSH
   - **Protocol:** TCP
   - **Port range:** 22
   - **Source:** 0.0.0.0/0
   - **Allow/Deny:** Allow
4. Click **Save changes**

---

## ✅ Step 2: Check Outbound Rules

Network ACLs also have **outbound rules** that control return traffic:

1. Click **Outbound rules** tab
2. Ensure there's a rule allowing return traffic:
   - **Type:** All traffic
   - **Protocol:** All
   - **Port range:** All
   - **Destination:** 0.0.0.0/0
   - **Allow/Deny:** Allow

---

## ✅ Step 3: Verify Route Tables

1. Go to **VPC** → **Route Tables**
2. Find the route table associated with your subnet
3. Check the routes:
   - Should have a route to `0.0.0.0/0` via an **Internet Gateway** (for public subnets)
   - If missing, your instance cannot reach the internet

---

## ✅ Step 4: Check Instance Public IP

1. Go to **EC2** → **Instances**
2. Select your instance
3. Check **Public IPv4 address**
4. Verify it matches `54.159.42.7`
5. If different, update `.github/workflows/deploy.yml` with the new IP

---

## 🔧 Quick Fix: Default Network ACL

If you're using the **default VPC**, the default Network ACL should allow all traffic. If you created a custom Network ACL, make sure it has the proper rules.

### To use default Network ACL:

1. Go to **VPC** → **Network ACLs**
2. Find your custom Network ACL
3. Note which subnets are associated
4. Go to **Subnets**
5. Select your subnet
6. Click **Actions** → **Edit subnet settings**
7. Change **Network ACL** to the default one (usually named "default")

---

## 📋 Complete Checklist

- [ ] Security Group: SSH (port 22) from 0.0.0.0/0 ✅ (Already confirmed)
- [ ] Network ACL Inbound: SSH (port 22) from 0.0.0.0/0
- [ ] Network ACL Outbound: All traffic to 0.0.0.0/0
- [ ] Route Table: Route to 0.0.0.0/0 via Internet Gateway
- [ ] Instance has Public IP: 54.159.42.7
- [ ] Instance is Running and healthy
- [ ] No firewall on the instance blocking SSH

---

## 🆘 Alternative: Use AWS Systems Manager

If Network ACLs are too restrictive or you can't modify them, consider using **AWS Systems Manager Session Manager** instead of SSH:

1. No need for SSH keys
2. No need to open port 22
3. Works through AWS API
4. More secure

This requires:
- IAM role with SSM permissions attached to the instance
- SSM Agent installed on the instance (usually pre-installed on Amazon Linux 2)

---

## 💡 Most Likely Solution

**Check Network ACLs first** - this is the most common cause when security groups are correct but connections still timeout.

