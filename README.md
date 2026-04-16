# Codex Hackathon Review Dashboard

Minimal reviewer dashboard for triaging CSV submissions across multiple devices and networks.

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
- Preserves decisions when you replace the CSV later, as long as `api_id` stays stable

## Quick Start

### 1. Create Supabase tables

Open the SQL editor in Supabase and run:

[supabase/schema.sql](/Users/user/Desktop/code/hobby/codexhackathon/supabase/schema.sql)

### 2. Add environment variables

Copy [.env.example](/Users/user/Desktop/code/hobby/codexhackathon/.env.example) into `.env` and fill in:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

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

Because the app uses `api_id` as the applicant primary key:

- existing applicants keep their current reviewer assignment
- existing review decisions stay attached to the same applicants
- only new applicants are added
- new applicants are distributed to the least-loaded reviewers so the load stays balanced over time

## Notes

- The first import distributes applicants evenly. Later imports preserve existing assignments and only balance newly added applicants.
- The frontend never touches the Supabase service role key. All database access goes through the server.
- Reviewer auth is still a dropdown-based MVP. For stricter access control, the next step would be passwordless reviewer login.
