# ROYAL POWER – Smart IT Support & Asset Management

IT equipment request and ticketing system with a **User Portal** and a role-protected **Admin Portal**.

**Stack:** React 18 + TypeScript, Vite, Tailwind CSS, Supabase (Postgres, Auth, Storage, Realtime, RLS), React Router, Recharts, React Hook Form, Lucide, react-hot-toast.

## 1. Supabase setup

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run these files **in order** (paste each, press Run):
   1. `supabase/migrations/0001_schema.sql` – tables, constraints, indexes
   2. `supabase/migrations/0002_functions_triggers.sql` – ticket numbering, notifications, `submit_ticket`, `track_ticket`, `admin_analytics`
   3. `supabase/migrations/0003_rls_storage.sql` – Row Level Security, storage buckets, realtime
   4. `supabase/migrations/0004_seed.sql` – 12 departments, 7 categories with all equipment, default settings
   (With the Supabase CLI: `supabase db push` does the same.)
3. **Project Settings → API**: copy the Project URL, the `anon` key and the `service_role` key.

## 2. Configure environment

```bash
cp .env.example .env
```

Fill `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
The service-role key is used **only** by the provisioning script on your machine. Never prefix it with `VITE_` and never add it to Netlify/Vercel.

## 3. Create the first admin (no credentials in frontend code)

```bash
npm install
npm run provision:admin
```

This creates `admin@royalpower.local` with the initial password from `.env` (`ADMIN_INITIAL_PASSWORD`, demo value `Royal@silver123`). The account has `must_change_password = true` and **has no admin rights until the password is changed**: the server-side `is_admin()` check enforces this, not just the UI. After first login you are forced to set a new password.

Change `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` in `.env` before provisioning a real deployment.

## 4. Run locally

```bash
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
```

## 5. Deploy

- **Netlify:** import the repo; `netlify.toml` already sets the build command, `dist` publish dir and SPA redirect.
- **Vercel:** import the repo; `vercel.json` provides the SPA rewrite.
- Add only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables.

## How it fits together

| Area | Details |
|---|---|
| Public submission | `submit_ticket()` (security-definer RPC) validates input, generates `PREFIX-YEAR-00001` atomically, stores the ticket and items, logs activity, notifies admins. Anonymous users have **no** direct table access to tickets. |
| Private tracking | `track_ticket(ticket_no, email, code)` returns one ticket only if the Ticket ID, the request email **and** the private tracking code shown at submission all match (code stored hashed; 5 failures lock the ticket for 15 minutes). |
| Admin data | RLS restricts tickets, logs, notifications and admin settings to authenticated users where `is_admin()` is true. |
| Catalog | Departments, categories and items are read live by the request form (Realtime), so admin changes appear immediately. Deleting catalog entries never deletes historical tickets (names are stored on the ticket). |
| Audit log | Every status change, assignment and remark is written to `ticket_activity_logs` by database triggers. |
| Settings | Site name, logo (public `branding` bucket), support details, ticket prefix, default priority and SOPs are stored in `system_settings`. |

## Admin portal pages

Dashboard · All / Pending / In Progress / Resolved / Cancelled tickets · Equipment Management · Categories · Department Management · IT SOP Library · Notifications · Reports & Analytics · Settings · Logout.

## End-to-end test checklist

1. Open `/` as an employee → **Create Request**.
2. Fill the form (add several items, try "Other"), attach a file, submit.
3. Note the generated Ticket ID (e.g. `RP-2026-00001`), tracking code and submission time.
4. Sign in at `/admin/login`, set the new password on first login.
5. The ticket is on the Dashboard and in All/Pending Tickets; a notification arrives (critical tickets notify separately).
6. Open it → set **In Progress**, assign staff, add remarks.
7. Set **Resolved** (or **Cancelled**) with resolution notes.
8. Open `/track`, enter the Ticket ID + request email + tracking code (shown on the success screen) → the updated status and public history show.
9. Admin → Equipment Management → add an item.
10. Reload `/request/new` or `/catalog` → the new item is there.

## Security notes

- No admin credentials in the bundle; the admin is provisioned server-side.
- Role is stored in `profiles.role`; a trigger blocks clients from changing it.
- Regular users cannot read other tickets, admin settings, logs or notifications (RLS).
- Attachments go to a private bucket (5 MB, images/PDF/Office only); only admins can read them.
- CSV exports neutralise spreadsheet-formula injection.

## Inventory, office users, assignments (migration 0005)

Run `supabase/migrations/0005_inventory.sql` once in the Supabase SQL Editor.

- **Admin → Inventory**: enter total stock per item, see assigned vs backup quantity, who holds each item, and **Download Excel** (one sheet per category + Summary + Assigned Equipment).
- **Admin → Office Users**: add employees (employee ID, name, department, designation, email, phone, branch) and issue/return equipment. Available = total stock − assigned.

## Auto-deploy and auto-update (GitHub)

1. Upload the project to a GitHub repo (do **not** upload `node_modules`, `dist`, `.env`, `release`).
2. Repo → Settings → Secrets and variables → Actions: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Netlify → Add new site → Import from Git. Build `npm run build`, publish `dist`, same two env vars.
4. Every push to `main` makes Netlify redeploy the website and `.github/workflows/release.yml` build a new Windows installer + Android APK and publish them as the latest GitHub Release.
5. Installed Windows apps check the latest release on start (and every 4 h) and update themselves.
6. The website shows only the Android button on phones and only the Windows button on computers. Leave the download-link fields in *Admin → Settings* empty to always use the latest release.

First time only: `node scripts/update-package.mjs` then `npm install` (adds electron-updater, Capacitor and the auto-update config to package.json).

## Desktop app (Windows installer)

1. `npm run desktop:build` → installer appears in `release/ROYAL-POWER-Setup.exe`.
2. Put that file in `public/downloads/` and redeploy the website, **or** upload it to GitHub Releases and paste the link in *Admin → Settings → Desktop app download link* (no rebuild needed).
3. The website then shows **Download App** (header, home banner, footer). The buttons are hidden inside the desktop app itself.
