# ⛽ BBM Logger — Boat Fuel Tracking App

A mobile-first web app for logging boat fuel (BBM) usage. Captains fill in the form from their phones; admins see a filterable recap dashboard.

---

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Supabase** — Postgres database + Storage for photos
- **Vercel** — Deploy target
- **browser-image-compression** — client-side photo compression before upload

---

## 1. Supabase Setup

### 1a. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a name, region closest to Indonesia (e.g. Singapore), and a strong DB password
3. Wait for the project to spin up (~1 min)

### 1b. Run the SQL

1. In your Supabase dashboard go to **SQL Editor**
2. Paste the entire contents of [`supabase-setup.sql`](./supabase-setup.sql)
3. Click **Run**

This creates:
- `fuel_logs` table with all columns + RLS policies
- `fuel-photos` storage bucket (public read) + upload/read policies

### 1c. Get your credentials

From the Supabase dashboard → **Settings → API**:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
ADMIN_PASSWORD=your-strong-admin-password
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `ADMIN_PASSWORD` | Password for the `/admin` dashboard |

---

## 3. Customise Captain & Boat Names

Edit [`lib/constants.ts`](./lib/constants.ts) to replace the placeholder names with your actual fleet:

```ts
export const CAPTAIN_NAMES = [
  "Budi Santoso",
  // ... add your captains
];

export const BOAT_NAMES = [
  "KM Rajawali",
  // ... add your boats
];
```

---

## 4. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the captain form.  
Open [http://localhost:3000/admin](http://localhost:3000/admin) — the admin dashboard.

---

## 5. Deploy to Vercel

### 5a. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/bbm-logger.git
git push -u origin main
```

### 5b. Import to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Framework preset: **Next.js** (auto-detected)
4. **Environment Variables** — add all three from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ADMIN_PASSWORD`
5. Click **Deploy** — Vercel handles the build automatically

### 5c. Share URLs

- **Captain form**: `https://your-app.vercel.app/` — share this with captains
- **Admin dashboard**: `https://your-app.vercel.app/admin` — keep this private

---

## App Features

### Captain Entry Form (`/`)
- Dropdown for captain and boat name, free text route
- Date/time defaults to now (editable)
- Fuel volume (liters) + cost (IDR) with thousand-separator formatting
- Camera capture for before/after refueling photos
- Client-side image compression (under ~1 MB each) for slow connections
- Friendly validation + success confirmation + form reset

### Admin Dashboard (`/admin`)
- Password-gated (shared password in env var, 8-hour session cookie)
- Filters: by boat, captain, date range
- Summary cards: total liters, total cost, trip count
- Breakdown tables: by boat and by captain
- Full log table with thumbnail photos (click to enlarge)
- Sort by date (newest/oldest)
- Export filtered view to CSV

---

## Notes

- Photos are stored in Supabase Storage (`fuel-photos` bucket, public URLs)
- The captain form is fully public — no login required
- The admin API GET is protected by a middleware cookie check
- Admin sessions expire after 8 hours (cookie `admin_auth`)
