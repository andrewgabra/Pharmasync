# PharmaSync v2 — Supabase + Vercel Migration

This replaces the old **Google Sheets + Apps Script + Netlify** stack with
**Supabase (Postgres + Auth) + Vercel serverless functions**, deployed from
this GitHub repo.

## What changed

| | Before | Now |
|---|---|---|
| Hosting | Netlify (static file) | Vercel (static + serverless API) |
| Shared data | Google Sheets | Supabase Postgres |
| Backend logic | Google Apps Script (`Code.gs`) | Vercel serverless functions (`/api/*.js`) |
| Auth | One shared admin password | Supabase Auth — real email/password accounts per person, with `admin` / `staff` roles |
| Approval workflow | Same concept, now backed by Postgres | Unchanged behavior — staff request, admin approves/rejects |

Everything else (the single-branch/multi-branch flow, discounts, price edits,
exports for Chefaa/Vezeeta/Instashop/Talabat/Stock List/Promotion Sheet, the
teal UI, undo/redo, fuzzy search, etc.) is the **same code, untouched** — only
the cloud-sync layer was swapped out.

## Project structure

```
/
├── public/                  ← served as static files by Vercel
│   ├── index.html           ← the whole app (same UI/logic as before)
│   ├── auth.js              ← Supabase Auth wrapper, loaded before index.html's script
│   └── supabase-config.js   ← public URL + anon key (safe to expose)
├── api/                     ← becomes serverless functions automatically
│   ├── _supabase.js         ← shared server-side client (ignored by router — starts with _)
│   ├── data.js              ← GET  /api/data
│   ├── save-discounts.js    ← POST /api/save-discounts        (admin only)
│   ├── save-price-edits.js  ← POST /api/save-price-edits      (admin only)
│   ├── audit-batch.js       ← POST /api/audit-batch           (admin only)
│   ├── versions.js          ← GET  /api/versions              (admin only)
│   ├── restore-version.js   ← POST /api/restore-version       (admin only)
│   ├── submit-request.js    ← POST /api/submit-request        (any signed-in user)
│   ├── requests.js          ← GET  /api/requests              (admin only)
│   ├── approve-request.js   ← POST /api/approve-request       (admin only)
│   ├── reject-request.js    ← POST /api/reject-request        (admin only)
│   └── clear-audit-log.js   ← POST /api/clear-audit-log       (admin only)
├── sql/
│   └── schema.sql            ← run once in Supabase SQL editor
├── package.json
├── vercel.json
├── .env.example
└── .gitignore
```

---

## Setup — Step by Step

### 1. Create the Supabase project

1. Go to **supabase.com** → New project
2. Name it `pharmasync` (or anything) → choose a region close to Egypt (e.g. `eu-central-1`)
3. Wait for it to finish provisioning (~2 min)

### 2. Run the database schema

1. In your Supabase project → **SQL Editor** → **New query**
2. Open `sql/schema.sql` from this repo, copy all of it, paste it in
3. Click **Run**
4. You should see 6 new tables: `profiles`, `discounts`, `price_edits`, `audit_log`, `versions`, `requests`

### 3. Get your API keys

In Supabase → **Project Settings → API**, copy:
- **Project URL** (e.g. `https://abcxyz.supabase.co`)
- **anon public** key
- **service_role** key (⚠️ keep this one secret — never put it in `public/`)

### 4. Configure the frontend (public key only)

Edit `public/supabase-config.js`:
```js
window.SUPABASE_URL = 'https://abcxyz.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJ...your-anon-key...';
```
This file is safe to commit — the anon key only allows what Row Level
Security policies permit (read shared data, sign in/sign up).

### 5. Push to GitHub

```bash
cd pharmasync-project
git init
git remote add origin https://github.com/andrewgabra/Pharmasync.git
git add .
git commit -m "Migrate to Supabase + Vercel"
git branch -M main
git push -u origin main --force
```
(`--force` is needed once, since the existing repo only has the old `item.html`.)

### 6. Deploy to Vercel

1. Go to **vercel.com** → **Add New... → Project**
2. Import `andrewgabra/Pharmasync` from GitHub
3. Before deploying, expand **Environment Variables** and add:

| Name | Value |
|---|---|
| `SUPABASE_URL` | same Project URL as step 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** key from step 3 (never the anon key here) |

4. Click **Deploy**
5. You'll get a URL like `pharmasync.vercel.app`

### 7. Create your admin account

1. Open the deployed site → click **🔐 Sign In** → **Create Account**
2. Sign up with `gpharmacyeg@gmail.com` and a password
3. Check that inbox for the confirmation email and confirm it
4. Back in Supabase → **SQL Editor** → run:
   ```sql
   update profiles set role = 'admin' where email = 'gpharmacyeg@gmail.com';
   ```
5. Sign in again on the site — you're now admin (see the 🔓 Admin badge in the header)

Any other team member who signs up will default to `role = 'staff'` — they
can use the app and submit approval requests, but can't directly edit
discounts/prices/audit log until you promote them the same way.

---

## How the approval workflow works now

1. A signed-in **staff** member tries to clear discounts / change a price / etc.
2. Instead of being blocked, they get a **"Request Approval"** modal
3. It's saved to the `requests` table in Supabase with `status = 'pending'`
4. When an **admin** signs in, the header badge shows a red count of pending requests
5. Clicking it opens the **Pending Requests** panel — Approve or Reject each one
6. Approving actually applies the change (and auto-snapshots a restore point first)
7. Every user's next page load pulls the updated data from Supabase — so an
   approved "clear discounts" stays cleared for everyone, permanently

## Updating the live site after a change

```bash
git add .
git commit -m "describe the change"
git push
```
Vercel auto-deploys on every push to `main` — no manual redeploy step, unlike
the old Netlify-drag-and-drop + Apps-Script-redeploy routine.

## Rollback

Vercel keeps every deployment. To roll back:
**Vercel dashboard → your project → Deployments → (pick an older one) → Promote to Production**
