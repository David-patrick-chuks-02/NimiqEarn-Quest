![NimiqEarn Quest Banner](assets/banner.png)

# NimiqEarn Quest

A Telegram-native task and bounty marketplace for the **Nimiq ecosystem** — where users complete quests and receive NIM rewards. The product is designed around mobile-first access, fast payouts, simple participation, and structured creator campaigns.

**discover tasks → submit proof → get verified → receive NIM**

## Overview

NimiqEarn Quest combines:

- Telegram bot infrastructure
- Nimiq wallet onboarding
- Instant NIM payouts
- AI-assisted task verification
- Reputation and anti-spam controls
- Creator task publishing and management

Communities, startups, and DAOs publish paid tasks and bounties; workers complete them inside Telegram and earn NIM.

## Main Document

The primary concept and product-flow document is here:

- [docs/nimiqearn-prototype-document.md](docs/nimiqearn-prototype-document.md)

## What This Repository Contains

- product overview and problem framing
- worker and creator personas
- user journey flows
- bot command structure
- screen blueprints
- feature prioritization tables
- architecture, data model, and lifecycle diagrams
- verification, payout, and anti-fraud design
- **application code** — monorepo (`apps/`, `packages/`) for the live MVP

## Documentation

| Document | Description |
| --- | --- |
| [docs/nimiqearn-prototype-document.md](docs/nimiqearn-prototype-document.md) | Product concept and user flows |
| [docs/nimiqearn-verification-architecture.md](docs/nimiqearn-verification-architecture.md) | Hybrid verification pipeline (deterministic + AI) |
| [docs/setup.md](docs/setup.md) | Local development setup |

## Development

**Status:** Milestone 1 in progress — monorepo scaffold, Prisma schema, Fastify API, Next.js landing page.

### Quick start

**First time setup:**

```bash
pnpm install
cp .env.example .env
pnpm docker:up
pnpm db:generate && pnpm db:push && pnpm db:seed
```

**Verify build (should exit 0):**

```bash
pnpm check
```

**Start everything (API + landing + bot):**

```bash
pnpm dev:all
```

Or without the bot:

```bash
pnpm dev
```

Add `BOT_TOKEN` to `.env` before running the bot (`pnpm dev:bot`).

| Service | URL |
| --- | --- |
| Landing page | http://localhost:3000 |
| API health | http://localhost:3001/health |

### Stack

TypeScript · Fastify · grammY · Next.js · Prisma · Supabase · Redis · Nimiq

See [docs/setup.md](docs/setup.md) for full setup instructions.

## Notes

This repository is the public home for NimiqEarn Quest product documentation and MVP development. It is not meant to duplicate the Community Council forum proposal post.

## License

MIT
