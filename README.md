# Codex Hackathon Review Dashboard

Minimal reviewer dashboard for triaging CSV submissions across multiple devices and networks.

## Calicut Event

The Calicut reviewer roster is Vaishakh Suresh, Viswanatha Kartha V, Joji Panackal, and Advaith Narayanan. The initial 190 registrations are distributed 48/48/47/47 in that order, with all decisions pending.

The new Supabase project reference is `wfvjflocrmuvfqewluoe`. Its API URL is `https://wfvjflocrmuvfqewluoe.supabase.co`. Configure the hosting environment with this URL and the matching server-side secret key before deploying this event. Do not reuse a key from the previous project.

Registration exports contain personal data. Import them directly without committing them to this public repository:

```bash
CSV_PATH="/absolute/path/to/calicut-registrations.csv" npm run sync:supabase
```

The checked-in `data/applicants.csv` is historical, not the Calicut event. Do not sync it to the new database. The server must use Supabase mode in production. Keep previous event databases unchanged.

`supabase/schema.sql` enables RLS and grants access only to the server's service role. No browser RLS policies are needed for this backend-only access model. This does not add reviewer authentication: the existing reviewer dropdown remains an identity selector, not a secure login.

Run the import regression tests with `npm test`.

## Architecture

This app now supports two modes:

- `Supabase mode` (recommended): shared cloud database for reviewers on different devices
- `Local mode`: fallback for single-machine testing using `data/reviews.json`

The same UI works in both modes. Once `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, the server reads and writes review state from Supabase.

## What It Does

- Loads applicants from `data/applicants.csv`
- Evenly assigns them across the reviewers listed in `config/reviewers.json`
- Lets each reviewer approve or reject applicants from a minimal web UI
- Saves review decisions centrally in Supabase
- Preserves decisions when you replace the CSV later, as long as the Luma ID stays stable (`api_id` for legacy exports, `guest_id` for current exports)

## Quick Start

### 1. Create Supabase tables

Open the SQL editor in Supabase and run:

[supabase/schema.sql](/Users/user/Desktop/code/hobby/codexhackathon/supabase/schema.sql)

### 2. Add environment variables

Copy [.env.example](/Users/user/Desktop/code/hobby/codexhackathon/.env.example) into `.env` and fill in:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Important:

- the server needs `SUPABASE_SERVICE_ROLE_KEY` for syncing applicants and saving reviews
- the publishable key alone is not enough for this backend

### 3. Set your reviewer names

Edit [config/reviewers.json](/Users/user/Desktop/code/hobby/codexhackathon/config/reviewers.json).

### 4. Put in the latest CSV

Overwrite:

```text
data/applicants.csv
```

with the latest Luma export.

### 5. Sync the CSV into Supabase

```bash
npm run sync:supabase
```

Or use the in-app upload screen after the server is running:

```text
/admin.html
```

### 6. Run the app

```bash
npm start
```

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Deploying

This app is easiest to deploy on Render, Railway, Fly.io, or any Node host.

Set these environment variables in the host:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HOST`
- `PORT`

Then deploy the repo and run:

```bash
npm start
```

## Updating With New Responses

When new registrations come in:

1. Replace `data/applicants.csv` and run `npm run sync:supabase`
or
1. Open `/admin.html`
2. Upload the new CSV from the browser

Because the app uses the stable Luma ID as the applicant primary key:

- existing applicants keep their current reviewer assignment
- existing review decisions stay attached to the same applicants
- only new applicants are added
- new applicants are distributed to the least-loaded reviewers so the load stays balanced over time

## Notes

- The first import distributes applicants evenly. Later imports preserve existing assignments and only balance newly added applicants.
- The frontend never touches the Supabase service role key. All database access goes through the server.
- Reviewer auth is still a dropdown-based MVP. For stricter access control, the next step would be passwordless reviewer login.
