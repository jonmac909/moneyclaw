# MoneyClaw — Plaid Setup Guide

## Step 1: Get Plaid API Keys

1. Go to **https://dashboard.plaid.com/signup** and create a free account
2. Once logged in, go to **Developers → Keys**
3. Copy your **client_id** and **Sandbox secret** (use Development secret when ready for real banks)

## Step 2: Configure the Server

```bash
cd plaid-server
cp .env.example .env
```

Open `.env` and paste your keys:
```
PLAID_CLIENT_ID=paste_your_client_id
PLAID_SECRET=paste_your_secret
PLAID_ENV=sandbox
```

## Step 3: Install & Run

```bash
npm install
npm start
```

You should see:
```
MoneyClaw Plaid Server
─────────────────────
Environment: sandbox
Listening:   http://localhost:8484
Credentials: configured
```

## Step 4: Connect Accounts in MoneyClaw

1. Open MoneyClaw and go to the **Settings** tab
2. You should see "Bank Connections (Plaid)" with a green "Server online" indicator
3. Click **+ Connect Account**
4. Plaid Link will open — in sandbox mode, use these test credentials:
   - Username: `user_good`
   - Password: `pass_good`
5. Once connected, click **Sync All** to pull account data

## Going Live (Real Banks)

When you're ready to connect real accounts:

1. In your Plaid dashboard, apply for **Development** access (free, 100 accounts)
2. Update `.env`:
   ```
   PLAID_SECRET=your_development_secret
   PLAID_ENV=development
   ```
3. Restart the server
4. Now when you click "Connect Account," you'll see real Canadian banks (RBC, TD, etc.)

## Supported Institutions (Canada)

Plaid supports most major Canadian banks including:
- RBC Royal Bank
- TD Canada Trust
- BMO
- Scotiabank
- CIBC
- National Bank
- Tangerine
- Simplii Financial

**Note:** Some institutions like Interactive Brokers or RBC Dominion Securities (wealth management) may have limited or no Plaid support. For those, you'll continue using manual entry in MoneyClaw.
