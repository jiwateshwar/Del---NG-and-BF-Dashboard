# RBT Operations Dashboard

Daily/weekly operations review dashboard for Ring Back Tone accounts (Orange
Burkina Faso, MTN Nigeria). Upload the latest MIS `.xlsx` for an account and
the dashboard — KPI cards, base/deactivation/revenue trends, and the
underlying numbers table — updates from it.

## How it works

- `lib/parser/` parses the MIS workbook generically (by header text, not
  fixed cell positions), so it survives new rows being appended and the
  minor column/label differences between accounts.
- `lib/accounts/config/*.ts` holds the small, account-specific mapping from
  raw sheet dimensions to display KPIs (e.g. which `Base` sheet category is
  "Active Base" for that account) — a one-time setup per account, not a
  per-upload step.
- Parsed data is upserted into a local SQLite database (`node:sqlite`), keyed
  by (account, date, metric) — re-uploading the same or a later MIS simply
  overwrites/extends history, never duplicates it.
- The dashboard reads from SQLite via `/api/accounts/[slug]/{kpis,metrics}`.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. Node 24+ is required (uses the built-in
`node:sqlite` module).

To add a new account, add a config file under `lib/accounts/config/`
(see the two existing ones for the shape) and register it in
`lib/accounts/registry.ts`. The `scripts/validate-*.ts` scripts are handy for
checking what the generic parser extracts from a new workbook before writing
its config — e.g.:

```bash
node scripts/validate-full-parse.ts
```

(Point that script at the new file and adjust the account slug first.)

## Deploying with Docker / Portainer

Build and run locally:

```bash
docker compose up --build
```

The app listens on port 3000 and persists its SQLite database and archived
uploads in the `rbt_dashboard_data` volume (`/data` inside the container) —
that volume is what needs to survive container recreation.

For Portainer: **Stacks → Add stack**, paste `docker-compose.yml` (or point
it at this repo), and deploy. No environment variables are required; no
authentication is enforced (the app is meant to sit behind your internal
network).
