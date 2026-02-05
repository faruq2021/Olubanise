# 🚨 CRITICAL: Database Connection String Missing

## Problem Identified

The Orchestrator is crashing with:
```
System.ArgumentException: Format of the initialization string does not conform to specification starting at index 0.
```

This means the **database connection string is NOT SET** on Render!

## ✅ Solution

### Step 1: Check if you have a PostgreSQL database on Render

1. Go to https://dashboard.render.com
2. Look for a **PostgreSQL** service in your dashboard
3. If you have one, click on it and find the **Internal Database URL**

### Step 2: Add Connection String to Orchestrator

Go to your **Orchestrator** service → **Environment** tab

Add this variable:

```
Key:   ConnectionStrings__DefaultConnection
Value: <Your PostgreSQL connection string>
```

⚠️ **IMPORTANT**: Use **double underscore** `__` (not single `_`)

### Step 3: Get the Correct Connection String

#### If you have a Render PostgreSQL database:
1. Open your PostgreSQL service on Render
2. Copy the **Internal Database URL**
3. It should look like:
   ```
   postgresql://user:password@dpg-xxxxx-a/database_name
   ```
4. Use this as the value for `ConnectionStrings__DefaultConnection`

#### If you DON'T have a database yet:
You need to create one first!

1. In Render Dashboard, click **New +**
2. Select **PostgreSQL**
3. Name it: `olubanise-db`
4. Choose Free tier
5. Click **Create Database**
6. Wait for it to provision
7. Copy the **Internal Database URL**
8. Add it to Orchestrator environment variables

### Step 4: Run Database Migrations

After adding the connection string, you may need to run migrations.

The Orchestrator should auto-create tables on first run, but if not, you'll need to:
1. Connect to your database
2. Run the schema from `schema/init.sql`

---

## 📋 Complete Environment Variables Checklist

Your **Orchestrator** service should have:

```bash
# Database (CRITICAL - MISSING!)
ConnectionStrings__DefaultConnection = <PostgreSQL URL>

# Worker Authentication
Worker__SharedSecret = OlubaniseInternalSecureKey_2026

# Encryption
ENCRYPTION_KEY = 01234567890123456789012345678901

# API Keys
ANTHROPIC_API_KEY = sk-ant-your-key-here

# Optional
BYPASS_BILLING = true
ASPNETCORE_URLS = http://+:10000
```

---

## 🧪 Verify After Fix

After adding the connection string and redeploying:

```bash
curl https://olubanise-orchestrator.onrender.com/api/sessions/health
```

Should return: `{"status":"healthy"}`

Then test the Worker endpoint:
```bash
curl -X POST "https://olubanise-orchestrator.onrender.com/api/sessions/00000000-0000-0000-0000-000000000000/status" \
  -H "Content-Type: application/json" \
  -H "X-Worker-Secret: OlubaniseInternalSecureKey_2026" \
  -d '{"status":"connecting"}'
```

Should return: HTTP 200 (no error)
