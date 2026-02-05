# Render Environment Variable Verification

## 🔍 Current Status

**Orchestrator Configuration Check:**
```bash
curl https://olubanise-orchestrator.onrender.com/api/sessions/debug/config
```

**Current Result:**
```json
{
  "hasWorkerSecret": true,
  "secretLength": 20,
  "secretPreview": "o...3"
}
```

## ❌ PROBLEM IDENTIFIED

The `Worker__SharedSecret` on Render is set to the **WRONG VALUE**!

- **Current**: 20 characters, starts with `o`, ends with `3`
- **Expected**: 31 characters, starts with `O`, ends with `6`

## ✅ SOLUTION

1. Go to Render Dashboard: https://dashboard.render.com
2. Open your **Olubanise Orchestrator** service
3. Click **Environment** tab
4. Find `Worker__SharedSecret`
5. **UPDATE** the value to:
   ```
   OlubaniseInternalSecureKey_2026
   ```
6. Click **Save Changes**
7. Wait for redeploy (2-3 minutes)

## 🧪 Verify After Fix

Run this command:
```bash
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

Then test authentication:
```bash
curl -X POST "https://olubanise-orchestrator.onrender.com/api/sessions/00000000-0000-0000-0000-000000000000/status" \
  -H "Content-Type: application/json" \
  -H "X-Worker-Secret: OlubaniseInternalSecureKey_2026" \
  -d '{"status":"connecting"}'
```

**Expected**: HTTP 200 (no error)

---

## 📝 Correct Values Reference

| Service | Variable Name | Correct Value |
|---------|--------------|---------------|
| **Orchestrator** | `Worker__SharedSecret` | `OlubaniseInternalSecureKey_2026` |
| **Worker** | `WORKER_SECRET` | `OlubaniseInternalSecureKey_2026` |

Both must be **EXACTLY** the same value (case-sensitive)!
