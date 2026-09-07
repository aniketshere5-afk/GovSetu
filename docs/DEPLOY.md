# Deploying the SetuGov demo

The app is a **single full-stack Node service** — one process serves the tRPC API
*and* the built client. So it needs only **Railway** (app + MySQL). No Vercel, no
`/api` rewrite.

## What you need

- A GitHub account and a Railway account (free tier is enough).
- ~10 minutes.

## 1. Put the code on GitHub

```bash
cd ~/Downloads/sih129/setugov_extracted
git branch -M main                       # rework branch -> main
# create an empty repo at github.com/new (no README), then:
git remote add origin https://github.com/<you>/setugov.git
git push -u origin main
```

## 2. Create the Railway project

1. railway.app → **New Project** → **Deploy from GitHub repo** → pick the repo.
2. Railway reads `railway.json` and runs `pnpm install --frozen-lockfile && pnpm build`,
   then `pnpm start`. The first deploy will fail health checks until step 4 — that's fine.
3. In the same project: **New** → **Database** → **Add MySQL**.

## 3. Set service variables

On the **app service** → **Variables**, add:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` (reference — Railway resolves it) |
| `JWT_SECRET` | any long random string |
| `OWNER_OPEN_ID` | `dev-admin` |
| `DEMO_AUTH` | `1` |
| `VITE_DEMO_AUTH` | `1` |

`DEMO_AUTH` / `VITE_DEMO_AUTH` enable the `/demo-login` role picker (Citizen /
Official / Admin) because there is no OAuth portal for a standalone demo. The demo
holds seeded sample data only — **do not enable these on a deployment with real data.**

Then redeploy the service.

## 4. Run the database migration (once)

Copy the MySQL **public** URL from Railway (MySQL service → Variables →
`MYSQL_PUBLIC_URL`) and run locally:

```bash
cd ~/Downloads/sih129/setugov_extracted
DATABASE_URL='mysql://root:...@containers-...railway.app:PORT/railway' pnpm exec drizzle-kit migrate
```

Re-run this after any future schema change (migrations are **not** auto-applied on
deploy).

## 5. Open it

Railway → app service → **Settings** → **Generate Domain**. Visit the URL; the app
seeds its demo data on first boot. Use **Login → /demo-login** to switch roles.

---

### Faster path (hand it to Claude)

- **GitHub push**: create the empty repo, then give Claude a GitHub Personal Access
  Token (`repo` scope) and the repo URL — it will push the branch.
- **Railway**: give Claude a Railway **project token**; it can try
  `npx @railway/cli up` from the local folder (skips GitHub). Sandbox egress may
  block this — the web-UI path above always works.
- **Migration**: once MySQL exists, paste Claude the `MYSQL_PUBLIC_URL` and it will
  run `drizzle-kit migrate` for you.
