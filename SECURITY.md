# Security configuration

PropManager now requires an authenticated administrator session for every application page and API route.

## Required environment variables

Copy `.env.example` to `.env` and set:

- `DATABASE_URL`
- `AUTH_SECRET` with at least 32 random characters
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

The application refuses login when these values are missing. Session cookies are HTTP-only, same-site, and secure in production.

## Dangerous administrative operations

Database seed and reset endpoints are blocked in production unless `ENABLE_DANGEROUS_ADMIN_ACTIONS=true` is explicitly configured. Keep this setting disabled on normal deployments.

## AI Copilot

The AI Copilot can include portfolio information in requests to an external model provider. It is disabled unless `ENABLE_AI_COPILOT=true` is explicitly configured. Review provider terms, privacy obligations, and tenant-data policies before enabling it.

## Database migration

Run `bun run db:migrate:deploy` during deployment. The stabilization migration removes the one-lease-per-unit database restriction so historical leases can be preserved and adds a unique unit-number constraint within each property.
