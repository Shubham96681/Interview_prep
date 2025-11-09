# Debugging React Error #310 on EC2

This guide will help you debug and fix React error #310 directly on your EC2 instance.

## Quick Fix (Recommended)

SSH into your EC2 instance and run:

```bash
cd /var/www/interview-prep
chmod +x fix-react-error-310.sh
./fix-react-error-310.sh
```

This script will:
1. Check React versions
2. Clean all caches and old files
3. Reinstall dependencies
4. Verify React installation
5. Check for duplicate React instances
6. Rebuild the frontend

## Step-by-Step Debugging

### Step 1: Check React Versions

```bash
cd /var/www/interview-prep
chmod +x check-react-version.sh
./check-react-version.sh
```

This will show you:
- React version in package.json
- React-DOM version in package.json
- Installed versions in node_modules
- Any duplicate React instances

**Common Issue**: If React and React-DOM versions don't match, this can cause error #310.

### Step 2: Disable Minification to See Full Error

```bash
cd /var/www/interview-prep
chmod +x debug-react-error.sh
./debug-react-error.sh
```

This will:
- Backup your current build
- Temporarily disable minification
- Rebuild the frontend
- Show you the full error message instead of "Minified React error #310"

After running this:
1. Reload the page in your browser
2. Check the browser console
3. You should now see the full error message with stack trace

### Step 3: Manual Fix (If Scripts Don't Work)

If the scripts don't work, try these manual steps:

#### 3.1. Clean Everything

```bash
cd /var/www/interview-prep
rm -rf node_modules dist .vite
rm -f package-lock.json
npm cache clean --force
```

#### 3.2. Reinstall Dependencies

```bash
npm install --legacy-peer-deps
```

#### 3.3. Verify React Versions Match

```bash
# Check versions
cat package.json | grep -A 1 '"react"'
cat node_modules/react/package.json | grep '"version"'
cat node_modules/react-dom/package.json | grep '"version"'
```

If versions don't match, force them to match:

```bash
npm install react@^18.2.0 react-dom@^18.2.0 --legacy-peer-deps --save-exact
```

#### 3.4. Check for Duplicate React Instances

```bash
find node_modules -name "react" -type d
```

If you see multiple React instances, remove them:

```bash
# Remove duplicate React from nested dependencies
find node_modules -name "react" -type d -not -path "*/node_modules/react" | xargs rm -rf
```

#### 3.5. Rebuild

```bash
npm run build
```

#### 3.6. Restart Services

```bash
# Restart PM2
pm2 restart interview-prep-backend

# Reload Nginx
sudo systemctl reload nginx
```

## Common Causes of React Error #310

1. **Version Mismatch**: React and React-DOM versions don't match
2. **Duplicate React**: Multiple React instances in node_modules
3. **Hook Order**: Hooks called in different order between renders
4. **Conditional Hooks**: Hooks called conditionally (inside if statements)
5. **Build Cache**: Stale build cache causing inconsistent builds

## Verify the Fix

After running the fix script:

1. **Check the browser console** - The error should be gone or show a full stack trace
2. **Check React DevTools** - Install React DevTools browser extension to see component tree
3. **Check Network tab** - Verify all JavaScript files are loading correctly

## If Error Persists

If the error still occurs after running the fix script:

1. **Check browser console** for the full error message (after disabling minification)
2. **Check server logs**:
   ```bash
   pm2 logs interview-prep-backend --lines 50
   ```
3. **Check Nginx logs**:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```
4. **Verify the build**:
   ```bash
   ls -lh /var/www/interview-prep/dist/
   ```

## Restore Minification

After debugging, restore minification:

```bash
cd /var/www/interview-prep
git checkout vite.config.ts
npm run build
```

## Additional Debugging

### Enable React Dev Mode (Temporary)

Edit `vite.config.ts` and add:

```typescript
export default defineConfig({
  define: {
    'process.env.NODE_ENV': '"development"', // Force dev mode
  },
  // ... rest of config
})
```

Then rebuild:
```bash
npm run build
```

This will give you more detailed error messages.

### Check Component Structure

The error might be in the component structure. Check:

1. All hooks are called at the top level (not in conditionals)
2. Hooks are called in the same order every render
3. No hooks are called inside loops or callbacks

## Need More Help?

If the error persists, share:
1. Full error message from browser console (after disabling minification)
2. Output of `check-react-version.sh`
3. Output of `pm2 logs interview-prep-backend --lines 50`

