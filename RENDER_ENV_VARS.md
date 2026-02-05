# Render Environment Variables Configuration

## 🔧 Orchestrator Service (.NET)

Set these environment variables in your **Orchestrator** web service on Render:

```
Worker__SharedSecret=OlubaniseInternalSecureKey_2026
ENCRYPTION_KEY=01234567890123456789012345678901
BYPASS_BILLING=true
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

**Important**: .NET uses double underscores (`__`) to represent nested configuration sections. So `Worker__SharedSecret` maps to `Worker:SharedSecret` in the code.

---

## 🔧 Worker Service (Node.js)

Set these environment variables in your **Worker** web service on Render:

```
WORKER_SECRET=OlubaniseInternalSecureKey_2026
ENCRYPTION_KEY=01234567890123456789012345678901
ORCHESTRATOR_URL=https://olubanise-orchestrator.onrender.com
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

**Important**: The Worker uses `WORKER_SECRET` (not `WORKER_SHARED_SECRET`).

---

## 🔍 Troubleshooting 401 Unauthorized

If you see **401 Unauthorized** errors when the Worker tries to communicate with the Orchestrator:

1. ✅ Verify `Worker__SharedSecret` is set in **Orchestrator** environment variables
2. ✅ Verify `WORKER_SECRET` is set in **Worker** environment variables  
3. ✅ Ensure both values are **identical**: `OlubaniseInternalSecureKey_2026`
4. ✅ Restart both services after updating environment variables

---

## 📝 How to Update on Render

1. Go to your service dashboard on Render
2. Click on **Environment** tab
3. Add/Update the environment variables listed above
4. Click **Save Changes**
5. Render will automatically redeploy your service

---

## 🔐 Security Note

For production, generate a strong random secret:
```bash
# Generate a secure random string
openssl rand -base64 32
```

Then update both `Worker__SharedSecret` and `WORKER_SECRET` with the same value.
