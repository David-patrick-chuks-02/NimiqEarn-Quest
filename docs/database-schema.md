# Database Schema — Milestone 1

Source of truth: [`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma).
Postgres (Supabase in staging/prod, Docker Postgres locally), accessed via Prisma.

## Entities

### `users` (`User`)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (PK) | Generated. |
| `telegram_id` | string | **Unique.** Telegram user id. |
| `telegram_username` | string? | Updated on each interaction. |
| `display_name` | string? | From Telegram first/last name. |
| `role` | `UserRole` | `WORKER` (default), `CREATOR`, `ADMIN`. |
| `status` | `UserStatus` | `PENDING` (default), `ACTIVE`, `SUSPENDED`. |
| `reputation_score` | int | Default 0 (used in M3). |
| `created_at` / `updated_at` | timestamp | Managed by Prisma. |

Relations: one optional `WalletProfile`, many `WalletAddressAudit`, many `Quest`.

### `wallet_profiles` (`WalletProfile`)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | **Unique** (one wallet per user). Cascade delete. |
| `nimiq_address` | string | **Unique** (one account per address). |
| `status` | `WalletStatus` | `PENDING` (default), `VERIFIED`, `INVALID`. |
| `linked_at` / `updated_at` | timestamp | |

> A wallet only becomes `VERIFIED` after the user signs an ownership challenge with their
> Nimiq wallet (see `WalletVerificationChallenge`). Format validation alone never verifies.

### `wallet_address_audits` (`WalletAddressAudit`)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | Indexed. Cascade delete. |
| `old_address` | string? | Null on first link. |
| `new_address` | string | |
| `changed_at` | timestamp | |

Append-only trail for transparent/auditable payout-address changes.

### `wallet_verification_challenges` (`WalletVerificationChallenge`)

Transient record backing the signed-message ownership flow.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | **Unique** (one active challenge per user). Cascade delete. |
| `token` | string | **Unique**, unguessable; used by the public signing page. |
| `nimiq_address` | string | Address being verified. |
| `message` | text | Exact message the wallet must sign. |
| `expires_at` | timestamp | Challenge validity window (15 min). |
| `created_at` | timestamp | |

On a successful signature the challenge is deleted and the `WalletProfile` is upserted as
`VERIFIED`.

### `quests` (`Quest`)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (PK) | |
| `creator_id` | uuid (FK → users) | Indexed. Cascade delete. |
| `title` | varchar(100) | |
| `category` | `QuestCategory` | See enum below. |
| `description` | text | |
| `reward_amount` | decimal(18,8) | NIM per slot. |
| `total_slots` | int | |
| `filled_slots` | int | Default 0 (incremented in M2). |
| `deadline` | timestamp | |
| `proof_type` | `QuestProofType` | See enum below. |
| `proof_instructions` | text | |
| `status` | `QuestStatus` | `DRAFT` (default), `PUBLISHED`, `CLOSED`, `ARCHIVED`. Indexed. |
| `created_at` | timestamp | |
| `published_at` | timestamp? | Set on publish. |

## Enums

- **UserRole:** `WORKER`, `CREATOR`, `ADMIN`
- **UserStatus:** `PENDING`, `ACTIVE`, `SUSPENDED`
- **WalletStatus:** `PENDING`, `VERIFIED`, `INVALID`
- **QuestCategory:** `PRODUCT_TESTING`, `SOCIAL_CAMPAIGN`, `COMMUNITY_ENGAGEMENT`, `REFERRAL`, `CONTENT`, `FEEDBACK`, `BUG_BOUNTY`, `OTHER`
- **QuestProofType:** `TEXT`, `LINK`, `SCREENSHOT`, `TRANSACTION_HASH`, `REFERRAL_EVENT`
- **QuestStatus:** `DRAFT`, `PUBLISHED`, `CLOSED`, `ARCHIVED`

## Relationships

```
User 1—0..1 WalletProfile
User 1—*    WalletAddressAudit
User 1—*    Quest   (as creator)
```

## Migration & seeding

```bash
pnpm db:generate   # generate the Prisma client
pnpm db:push       # apply schema to the database (dev)
pnpm db:migrate    # create a named migration (after schema changes)
pnpm db:seed       # insert sample admin, creator, and a draft quest
```

The default `DATABASE_URL` targets the Docker Compose Postgres (`pnpm docker:up`).
For Supabase, point `DATABASE_URL` at the project connection string and run `pnpm db:push`.

> **Note:** `wallet_profiles.nimiq_address` gained a `UNIQUE` constraint in M1 — run
> `pnpm db:push` (or a migration) to apply it to existing databases.

## Future entities (designed for, not implemented in M1)

| Entity | Milestone | Purpose |
| --- | --- | --- |
| `QuestSubmission` | M2–M3 | Proof record with status, AI confidence, and verification outcome. |
| `ModerationEvent` | M3 | Trust and review history for the verification pipeline. |
| `Payout` | M2+ | Dedicated payout table (today payouts live on `QuestSubmission`). |
