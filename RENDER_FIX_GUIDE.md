# 🔧 Fix Render Environment Variable - Step by Step

**Issue**: Worker authentication failing with 401 Unauthorized  
**Cause**: `Worker__SharedSecret` on Render has wrong value  
**Time to Fix**: 3 minutes

---

## 📋 Step-by-Step Instructions

### Step 1: Open Render Dashboard
1. Open your web browser
2. Go to: **https://dashboard.render.com**
3. Log in if prompted

### Step 2: Select Your Service
1. You'll see a list of your services
2. Look for **"olubanise-orchestrator"** (or similar name)
3. Click on it to open the service details

### Step 3: Navigate to Environment Tab
1. At the top of the service page, you'll see several tabs:
   - Overview
   - Events
   - Logs
   - Shell
   - **Environment** ← Click this one
   - Settings
2. Click on the **Environment** tab

### Step 4: Find the Variable
1. You'll see a list of environment variables
2. Scroll down to find: **`Worker__SharedSecret`**
   - Note: It has TWO underscores: `Worker__SharedSecret`
3. Click the **Edit** button (pencil icon) next to it

### Step 5: Update the Value
1. You'll see the current value (probably something like `olubanise_secret_123`)
2. **Delete** the current value completely
3. **Copy and paste** this exact value (case-sensitive!):
   ```
   OlubaniseInternalSecureKey_2026
   ```
4. Double-check:
   - ✅ Starts with capital `O`
   - ✅ Has underscores: `_`
   - ✅ Ends with `_2026`
   - ✅ No extra spaces before or after

### Step 6: Save Changes
1. Click the **Save Changes** button (usually blue)
2. Render will show a notification: "Environment updated"
3. Your service will **automatically redeploy** (takes 2-3 minutes)
4. You'll see deployment progress in the **Events** or **Logs** tab

---

## ✅ Verify the Fix

### Option 1: Run PowerShell Test Script
```powershell
cd C:\Users\USER\OneDrive\Desktop\Olubanise
.\test-render-config.ps1
```

**Expected output:**
```json
{
  "hasWorkerSecret": true,
  "secretLength": 31,        ✅ Changed from 20
  "secretPreview": "O...6"   ✅ Changed from "o...3"
}
```

### Option 2: Manual cURL Test
```powershell
curl https://olubanise-orchestrator.onrender.com/api/sessions/debug/config
```

---

## 🎯 What Should Happen After Fix

Once Render finishes redeploying (watch the Logs tab):

1. ✅ **Worker will authenticate successfully** (no more 401 errors)
2. ✅ **WhatsApp session will initialize**
3. ✅ **QR code will be generated** (check Worker logs)
4. ✅ **Status updates will work** (Worker → Orchestrator communication)

---

## 🚨 Troubleshooting

### "I don't see Worker__SharedSecret in the list"
- Click **"Add Environment Variable"** button
- Key: `Worker__SharedSecret`
- Value: `OlubaniseInternalSecureKey_2026`
- Click **Add**

### "Still getting 401 after update"
1. Wait 3-5 minutes for deployment to complete
2. Check Render **Logs** tab for "Application started" message
3. Re-run the test script
4. If still failing, check for typos in the secret value

### "Service won't redeploy"
1. Go to **Settings** tab
2. Scroll to bottom
3. Click **"Manual Deploy"** → **"Deploy latest commit"**

---

## 📸 Visual Reference

### Before (Wrong):
```json
{
  "secretLength": 20,
  "secretPreview": "o...3"  ❌
}
```

### After (Correct):
```json
{
  "secretLength": 31,
  "secretPreview": "O...6"  ✅
}
```

---

## 🔐 Important Notes

- **Case-sensitive**: Must be exactly `OlubaniseInternalSecureKey_2026`
- **No spaces**: Don't add spaces before or after
- **Double underscore**: Variable name is `Worker__SharedSecret` (two underscores)
- **Auto-redeploy**: Render automatically redeploys when you save environment changes

---

## 📞 Need Help?

If you're stuck at any step, let me know:
- Which step you're on
- What you see on the screen
- Any error messages

I can provide screenshots or more detailed guidance for that specific step!
