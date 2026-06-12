# Corject Production Operations

## Recommended Production Plans

- Render: paid web service to avoid cold starts and hourly free-plan limits.
- Supabase: Pro before the application becomes business-critical, primarily
  for managed backups and production support rather than raw capacity.

Twenty-five users do not require microservices. One Node web service and one
Supabase PostgreSQL project are sufficient.

## Environments

Maintain two independent Supabase projects:

- `corject-staging`
- `corject-production`

Render should also have separate staging and production services. Never point
staging builds at the production database.

## Required Production Environment

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
DATA_MODEL=normalized
REQUIRE_AUTH=true
VITE_REQUIRE_AUTH=true
VITE_DATA_API=true
APP_BASE_URL=
APP_ORIGIN=
```

Secrets must be stored only in Render/Supabase environment configuration.

## Monitoring

- Monitor `GET /health`; it checks both the Node process and database latency.
- Alert when health fails for two consecutive checks.
- Retain Render logs for authentication failures, database retries, notification
  failures and state-version conflicts.
- Add a hosted error tracker later by supplying its DSN only through env.

## Backup And Recovery

- Run `npm run db:backup` immediately before every migration.
- Use Supabase managed daily backups in production.
- Test a restore into staging at least once per quarter.
- Keep `app_state` during the migration rollback window.
- Do not commit files from `backups/`.

## Deployment Checklist

1. Run `npm test`.
2. Run `npm run build`.
3. Back up production before schema/data migrations.
4. Apply migrations to staging first.
5. Run the importer and compare row counts.
6. Test administrator and standard-user authorization.
7. Deploy production.
8. Verify `/health`, login, task update, ticket update, comments and reports.

## Security Checklist

- Magic-link login enabled.
- Supabase Site URL and redirect URLs restricted to Corject domains.
- RLS enabled on every business table.
- `service_role` never exposed to Vite or browser code.
- Jira, Resend, WhatsApp and Render keys rotated after accidental disclosure.
- Project membership and administrator role checked on the server.
