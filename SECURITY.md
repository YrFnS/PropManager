# Security configuration

PropManager requires an authenticated organization account for every application page and business API route. Portfolio records are scoped to the active organization, and write access is restricted by membership role.

## Required environment variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`
- `AUTH_SECRET` with at least 32 random characters

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are bootstrap credentials. They create the first database-backed owner account only when no matching user exists. Subsequent authentication uses the password hash stored for the user. Remove or rotate the bootstrap values after the first owner has signed in and another recovery process is established.

Session cookies are HTTP-only, same-site, secure in production, and expire after four hours.

## Organization roles

- `owner`: organization settings, members, data administration, and all workflows
- `manager`: portfolio, tenant, lease, payment, message, and maintenance workflows
- `accountant`: payment workflows and financial reporting
- `maintenance`: maintenance workflow updates
- `viewer`: read-only portfolio access

The application proxy enforces route permissions. Prisma query scoping also injects the active organization into business reads and writes, while database triggers validate ownership across linked records.

## Dangerous administrative operations

Database seed and reset endpoints are owner-only and blocked in production unless `ENABLE_DANGEROUS_ADMIN_ACTIONS=true` is explicitly configured. Keep this setting disabled on normal deployments.

## AI Copilot

The AI Copilot can include the active organization's portfolio information in requests to an external model provider. It remains disabled unless `ENABLE_AI_COPILOT=true` is explicitly configured. Review provider terms, privacy obligations, and tenant-data policies before enabling it.

## Database migrations

Run migrations during deployment:

```bash
bun ci
bun run db:migrate:deploy
bun run build
```

The organization migration creates the default organization, backfills all existing records, replaces globally unique tenant email addresses with organization-specific uniqueness, and adds database triggers that prevent cross-organization relationships.
