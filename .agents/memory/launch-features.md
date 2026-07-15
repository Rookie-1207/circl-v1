---
name: Circl Launch-Blocker Features
description: Architecture decisions for Delete Account, Block User, Report System, Join Safety, and Session Expiry features
---

## Delete Account
Soft-delete: `deletedAt` + `scheduledDeletionAt = now+30d` columns on `usersTable`. Auth middleware (`requireAuth`) rejects 401 on all subsequent requests from a deleted account. Frontend re-authenticates via `supabase.auth.signInWithPassword` to verify password before calling `DELETE /users/me`, then calls `logout()`.

**Why:** Supabase admin API not available; soft-delete gives users a 30-day recovery window via support.

## Block User
Bidirectional `user_blocks` table (blockerId, blockedId, unique constraint). Shared helpers in `lib/blocks.ts`: `areUsersBlocked(a, b)` and `getBlockedUserIds(userId)`. Blocks enforced in: discover (filter excluded IDs), view-profile (404), connections (404), conversations (filter list + 403 on send), activities join (403).

**Why:** Bidirectional enforcement prevents both sides from finding each other regardless of who blocked whom.

## Report System
`reports` table with `targetType` enum (user/activity/message) + `targetId`. Stored in DB only, no external webhook. `POST /reports` requires auth. No duplicate-prevention (multiple reports from same user allowed — admin dedup job later).

## Join Safety (Race Fix)
`POST /activities/:id/join` was TOCTOU (SELECT-then-INSERT). Fixed to atomic `INSERT ... onConflictDoNothing().returning()`, relying on the existing DB unique index `activity_participants_activity_user_unique_idx`. If no row returned, SELECT the existing row's status.

**Why:** Under concurrent requests the old code could insert two rows; the DB constraint was already there but not utilized.

## Session Expiry
`isIntentionalLogout` ref in `AuthProvider` set to `true` before calling `supabase.auth.signOut()`. `onAuthStateChange(SIGNED_OUT)` sets `sessionExpired = true` only when ref is `false`. `AuthGate` stores intended path in `sessionStorage` (key: `circl_redirect_after_login`) before redirecting to `/login`, shows a toast, then clears the path and redirects after successful login.
