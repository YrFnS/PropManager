# PropManager stabilization status

The stabilization release is implemented on `agent/stabilize-core-workflows` and validated as a complete system.

## Completed

- Database-backed authentication with signed, HTTP-only sessions
- Organization ownership, switching, memberships, and role enforcement
- Historical lease support and cross-organization relationship safeguards
- Fixed-precision monetary storage with decimal arithmetic
- Immutable payment void and refund adjustments
- Net-cash dashboard and reporting after refunds
- Organization-aware currency, locale, and timezone formatting
- Role-aware controls across finance and legacy management screens
- Stable login hydration and server-rendered permission markers
- Permission-safe Properties loading states and shell navigation
- Frozen Playwright dependency and browser security smoke tests
- Fresh-install and populated legacy-database migration rehearsal

## Validation passed

- `bun ci`
- Prisma client generation
- Fresh PostgreSQL migration deployment
- Legacy prototype-schema upgrade with data repair assertions
- TypeScript type checking
- Unit and architecture tests
- ESLint
- Next.js production build
- Chromium tests for localized login, RTL, owner controls, viewer control hiding, and direct API denial

## Before production

1. Restore a recent production backup into staging.
2. Run the documented migration and smoke-test sequence against that copy.
3. Configure production secrets and organization defaults from `.env.example`.
4. Keep dangerous administrative actions and the AI Copilot disabled until explicitly reviewed.
5. Deploy the same reviewed commit that passed staging.
