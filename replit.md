# Circl

A social networking app for college students to find gym partners, study groups, hackathon teammates, startup co-founders, sports partners, coffee meetups, gaming friends, and travel partners. NOT a dating app.

## Run & Operate

- `pnpm --filter @workspace/circl run dev` — run the frontend (port from env)
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Wouter routing, TanStack Query, shadcn/ui, Framer Motion, next-themes
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/` — Drizzle table definitions (users, connections, conversations, messages, notifications)
- `artifacts/api-server/src/routes/` — Express route handlers (users, connections, conversations, notifications, dashboard)
- `artifacts/circl/src/` — React frontend (pages, components, theming)
- `lib/api-client-react/src/generated/` — Generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — Generated Zod schemas for server validation (do not edit)

## Architecture decisions

- **Mock auth**: Authentication is not yet implemented. All API routes use `CURRENT_USER_ID = 1` as the mock current user. When auth is added, replace this with middleware that extracts the authenticated user from the session/token.
- **Ownership checks**: Even with mock auth, all connection updates check that `toUserId === CURRENT_USER_ID`, and conversation message reads/writes verify conversation membership.
- **Compatibility score**: Computed server-side in `GET /users` based on shared interests, lookingFor, and availability arrays between the current user and discovered users.
- **Conversation creation**: Triggered automatically when a connection request is accepted (PATCH /connections/:id with status=accepted).
- **OpenAPI-first**: The spec in `lib/api-spec/openapi.yaml` is the single source of truth. Run codegen after any spec changes.

## Product

- **Dashboard** `/` — Stats overview (matches, pending requests, messages, profile views), recent matches, activity by category chart
- **Discover** `/discover` — User cards with compatibility score badges, Connect/Pass buttons, category filter chips, search
- **Matches** `/matches` — Accepted connections + pending requests with Accept/Reject actions
- **Chat** `/conversations` and `/conversations/:id` — Conversation list + real-time polling chat thread
- **Profile** `/profile` — Edit current user's profile (name, bio, interests, lookingFor, availability, goals)
- **Notifications** `/notifications` — Connection requests, accepted connections, messages; mark read/mark all read
- **Settings** `/settings` — Dark mode toggle (localStorage persisted)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any `lib/api-spec/openapi.yaml` change, run codegen then `pnpm run typecheck:libs` before checking artifact types.
- The DB schema uses `text().array()` for interests/lookingFor/availability — Drizzle `array()` must be a method call, not `array(text())`.
- After changing `lib/db/src/schema/`, run `pnpm --filter @workspace/db run push` to apply DDL changes.
- Mock `CURRENT_USER_ID = 1` is defined at the top of every route file — search for it when implementing real auth.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
