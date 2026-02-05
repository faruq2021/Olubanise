# Test Connection String Format

## Your Connection String
```
postgresql://olubanise_db_user:SEinwqzJ3nMSSQFcyQovezv5Nz8PPz8B@dpg-d61nu7tactks73bg6ie0-a/olubanise_db
```

## ⚠️ Important Notes

### 1. Use Internal URL for Render Services
The connection string you provided appears to be the **short form**. 

For Render-to-Render connections, use the **Internal Database URL** which should look like:
```
postgresql://olubanise_db_user:SEinwqzJ3nMSSQFcyQovezv5Nz8PPz8B@dpg-d61nu7tactks73bg6ie0-a.oregon-postgres.render.com:5432/olubanise_db
```

### 2. Check for Special Characters
The password `SEinwqzJ3nMSSQFcyQovezv5Nz8PPz8B` contains uppercase letters and numbers, which should be fine.

### 3. Alternative Format
Npgsql (the PostgreSQL driver for .NET) also supports this format:
```
Host=dpg-d61nu7tactks73bg6ie0-a.oregon-postgres.render.com;Port=5432;Database=olubanise_db;Username=olubanise_db_user;Password=SEinwqzJ3nMSSQFcyQovezv5Nz8PPz8B;SSL Mode=Require
```

---

## ✅ Recommended Actions

### Option 1: Get the Full Internal URL from Render

1. Go to your **PostgreSQL database** service on Render
2. Look for **"Internal Database URL"** (not "External Database URL")
3. Copy the FULL URL (should include `.oregon-postgres.render.com` or similar)
4. Use that as the value for `ConnectionStrings__DefaultConnection`

### Option 2: Use the Key-Value Format

Instead of the URL format, try this format:
```
Host=dpg-d61nu7tactks73bg6ie0-a.oregon-postgres.render.com;Port=5432;Database=olubanise_db;Username=olubanise_db_user;Password=SEinwqzJ3nMSSQFcyQovezv5Nz8PPz8B;SSL Mode=Require
```

This format is more explicit and less prone to parsing errors.

### Option 3: Let Render Auto-Link

1. Go to your **Orchestrator service** on Render
2. Click **"Environment"** tab
3. Look for **"Add from Database"** button
4. Select your PostgreSQL database
5. Render will automatically add the correct `DATABASE_URL`

---

## 🧪 Quick Test

Once you update the connection string, wait for redeploy and run:

```bash
curl https://olubanise-orchestrator.onrender.com/api/sessions/debug/config
```

Should show:
```json
{
  "hasConnectionString": true,
  "connectionStringLength": 150+
}
```

---

## 🔍 What to Check in Render

1. **PostgreSQL Database Service:**
   - Status should be "Available" (green)
   - Copy the **Internal Database URL** (full version)

2. **Orchestrator Service:**
   - Add environment variable:
     - **Name**: `ConnectionStrings__DefaultConnection`
     - **Value**: `<Full Internal Database URL>`
   - OR use `DATABASE_URL` if auto-linked

3. **After Save:**
   - Wait for automatic redeploy
   - Check logs for "Database connection string found"

---

## 💡 Most Likely Issue

The connection string you provided is missing the full hostname. The complete internal URL should be:

```
postgresql://olubanise_db_user:SEinwqzJ3nMSSQFcyQovezv5Nz8PPz8B@dpg-d61nu7tactks73bg6ie0-a.oregon-postgres.render.com:5432/olubanise_db
```

Notice the addition of:
- `.oregon-postgres.render.com` (or your region)
- `:5432` (port number)

Please get the **full Internal Database URL** from your PostgreSQL service page on Render!
