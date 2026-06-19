-- NimiqEarn Quest — Supabase storage buckets (create in Supabase dashboard or CLI)
-- proof-uploads: private — worker proof files (M2+)
-- quest-assets: public — optional creator campaign assets
-- web-assets: public — optional static web assets

-- Local dev uses Docker Postgres; production uses Supabase Postgres.
-- Run: pnpm db:push && pnpm db:seed
