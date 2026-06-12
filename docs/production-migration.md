# Production Database Migration

The production migration is intentionally split into reversible stages.

## Prerequisites

1. Keep the current `app_state` table until final verification is complete.
2. Create a backup with `npm run db:backup`.
3. In Supabase Dashboard, open **Project Settings > API** and copy the
   `service_role` secret into local `.env.local` as
   `SUPABASE_SERVICE_ROLE_KEY`. Never commit or send this value in chat.
4. Add the same secret to the Render web service environment.

## Apply Schema

Open **Supabase Dashboard > SQL Editor > New query** and run:

`supabase/migrations/202606120001_normalized_schema.sql`

The migration keeps `app_state`, creates the normalized tables and enables
RLS. Any incompatible empty test table is moved to the access-restricted
`corject_legacy_backup` schema instead of being deleted. If one unexpectedly
contains data, the transaction stops without changing the table.

## Import Data And Auth Users

Run:

```powershell
npm run db:migrate
npm run db:verify
```

The importer:

- creates or reuses one Supabase Auth user for every unique employee email;
- migrates projects, memberships, milestones, tasks, comments and effort;
- migrates tickets, actions, field plans, commissioning nodes and notes;
- writes an idempotency record to `data_migrations`.

## Verify Before Cutover

Compare these counts with the pre-migration inventory:

- 9 profiles
- 3 projects
- 9 milestones
- 37 total tasks (34 project + 3 personal at the initial inventory; use the
  latest backup as authoritative if the live system changed)
- 9 tickets

Do not enable the new data model until counts and sample records match.

## Cutover

After the API/Auth implementation is deployed and verified, set:

```text
DATA_MODEL=normalized
REQUIRE_AUTH=true
VITE_REQUIRE_AUTH=true
VITE_DATA_API=true
```

Redeploy and test with an administrator account first.

## Rollback

Set all four flags back to legacy/false and redeploy. The original
`app_state` table remains available during the transition.
