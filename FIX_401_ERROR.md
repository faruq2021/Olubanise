# 🚨 URGENT: Fix 401 Unauthorized Error on Render

## Problem
The Worker is getting **401 Unauthorized** when trying to communicate with the Orchestrator because the `Worker__SharedSecret` environment variable is **NOT SET** on Render.

## Solution

### Step 1: Go to Render Dashboard
1. Open https://dashboard.render.com
2. Find your **Olubanise Orchestrator** service
3. Click on it to open the service details

### Step 2: Add Environment Variable
1. Click on the **"Environment"** tab in the left sidebar
2. Click **"Add Environment Variable"** button
3. Add the following:
   ```
   Key:   Worker__SharedSecret
   Value: OlubaniseInternalSecureKey_2026
   ```
   ⚠️ **IMPORTANT**: Use **double underscore** `__` (not single `_`)

4. Click **"Save Changes"**

### Step 3: Wait for Redeploy
- Render will automatically redeploy your service
- Wait 2-3 minutes for the deployment to complete

### Step 4: Verify It Works
After deployment completes, run this command to test:

```powershell
curl https://olubanise-orchestrator.onrender.com/api/sessions/debug/config
```

**Expected output:**
```json
{
  "hasWorkerSecret": true,
  "secretLength": 31,
  "secretPreview": "O...6"
}
```

If you see `"hasWorkerSecret": false`, the variable is still not set correctly.

---

## Why This Happened
- .NET uses `Worker:SharedSecret` in code (with colon `:`)
- But environment variables use `Worker__SharedSecret` (with double underscore `__`)
- The `__` gets converted to `:` by .NET's configuration system
- If you set `WORKER_SHARED_SECRET` or `Worker_SharedSecret` (single underscore), it won't work!

---

## Quick Reference

| Service | Environment Variable | Value |
|---------|---------------------|-------|
| **Orchestrator** (.NET) | `Worker__SharedSecret` | `OlubaniseInternalSecureKey_2026` |
| **Worker** (Node.js) | `WORKER_SECRET` | `OlubaniseInternalSecureKey_2026` |

Both must have the **same value**, just different variable names!
