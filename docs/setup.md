# Local Development Setup

Milestone 1 — Day 1–2 scaffold. See [STACK.md](../STACK.md) for the full architecture.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for local Postgres + Redis)

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file
cp .env.example .env

# 3. Start Postgres + Redis
pnpm docker:up

# 4. Generate Prisma client and push schema
pnpm db:generate
pnpm db:push
pnpm db:seed

# 5. Run API + landing page
pnpm dev
```

| Service | URL |
| --- | --- |
| Landing page | http://localhost:3000 |
| API | http://localhost:3001 |
| API health | http://localhost:3001/health |
| API stats | http://localhost:3001/api/stats |

## Supabase (production / staging)

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Set `DATABASE_URL` to the Supabase Postgres connection string (pooler recommended).
3. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Create Storage buckets: `proof-uploads` (private), `quest-assets`, `web-assets`.
5. Run `pnpm db:push` against the Supabase database.

## Bot (Day 3+)

```bash
# Add BOT_TOKEN to .env from @BotFather
pnpm dev:bot
```

## Project structure

```
apps/
  api/    — TypeScript + Fastify
  bot/    — TypeScript + grammY
  web/    — Next.js landing + admin (M2)
packages/
  database/  — Prisma + Supabase Postgres
  shared/    — Zod schemas + constants
  nimiq/     — Address validation
```

## Useful commands

```bash
pnpm check          # typecheck + build (CI parity)
pnpm typecheck      # Typecheck all packages
pnpm build          # Build all packages
pnpm dev            # API + web (watch mode)
pnpm dev:all        # API + web + bot (watch mode)
pnpm dev:bot        # Bot only
pnpm docker:down    # Stop local services
pnpm db:migrate     # Create a named migration (after schema changes)
```
