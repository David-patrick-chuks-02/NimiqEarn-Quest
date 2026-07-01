# NimiqEarn Quest — Bug Audit

Full-codebase audit performed 2026-06-30. Covers `apps/api`, `apps/bot`, `packages/*`,
`apps/web`, and the Prisma schema. Findings are ordered by severity. Each entry lists the
location, what's wrong, the concrete impact, and a suggested fix.

---

## 🔴 Critical

### C1. The API has no authentication or authorization — any user can impersonate any other
- **Where:** every route under [apps/api/src/routes/](apps/api/src/routes/); identity comes
  only from the `:telegramId` URL param (e.g. [users.ts:21](apps/api/src/routes/users.ts#L21),
  [wallets.ts:23](apps/api/src/routes/wallets.ts#L23),
  [creators.ts:11](apps/api/src/routes/creators.ts#L11),
  [quests.ts:26](apps/api/src/routes/quests.ts#L26)). `grep` for any auth hook in
  `apps/api/src` returns nothing.
- **Problem:** The API trusts the `telegramId` in the path with zero verification. There is no
  bearer token, no shared secret between the bot and API, and no Telegram signature check.
  Telegram user IDs are short integers and effectively guessable/enumerable.
- **Impact:** Anyone who can reach the API can link/replace another user's payout wallet
  (`PUT /api/users/:telegramId/wallet`), promote arbitrary accounts to CREATOR, create and
  publish quests as someone else, and read any user's profile. This is a full
  account-takeover / payout-redirection hole.
- **Fix:** Require a shared secret header (bot → API) at minimum, and ideally derive the user
  identity from a verified Telegram `initData`/HMAC signature rather than a path param. Add a
  Fastify `onRequest`/`preHandler` auth guard and lock CORS down (see M9).

---

## 🟠 High

### H1. Wallet "verification" is a no-op — linking instantly marks the wallet VERIFIED and the user ACTIVE
- **Where:** [wallet.service.ts:91-106](apps/api/src/services/wallet.service.ts#L91-L106) and
  [wallet.service.ts:74-85](apps/api/src/services/wallet.service.ts#L74-L85).
- **Problem:** `linkWallet` sets `status: "VERIFIED"` and flips the user `PENDING → ACTIVE`
  with no proof of address ownership (no signed message, no micro-transaction, nothing). The
  whole gate (`assertVerifiedProfile`, `hasVerifiedWallet`, the `WalletStatus.PENDING` default,
  the "Account verified" UI in [worker-status.ts](apps/bot/src/menus/worker-status.ts)) is
  bypassed by simply submitting any *well-formed* address.
- **Impact:** Anyone can become a "verified" creator and enter payout addresses they don't
  control. Defeats the stated verification architecture and the anti-fraud intent.
- **Fix:** Keep the wallet `PENDING` on link and run a real ownership check (signed challenge or
  on-chain proof) before promoting to `VERIFIED`/`ACTIVE`.
- **✅ Resolved:** Implemented a signed-message ownership challenge. The API issues a challenge
  (`wallet_verification_challenges`), the user signs it with their Nimiq wallet via the web
  signing page ([apps/web/app/link-wallet/page.tsx](apps/web/app/link-wallet/page.tsx)), and the
  signature is cryptographically verified ([packages/nimiq](packages/nimiq/src/index.ts),
  `verifyNimiqSignedMessage`) before the wallet is marked `VERIFIED` and the user `ACTIVE`.

### H2. No DB uniqueness on `nimiqAddress` — duplicate-wallet check is racy
- **Where:** schema [schema.prisma:75](packages/database/prisma/schema.prisma#L75) (no
  `@unique`); app-level check at
  [wallet.service.ts:45-57](apps/api/src/services/wallet.service.ts#L45-L57).
- **Problem:** Uniqueness is enforced only by a `findFirst` read immediately followed by a
  write. Two concurrent `linkWallet` calls for the same address both pass the check and both
  write — and there is no constraint to stop them.
- **Impact:** The "one wallet per account, no duplicate addresses" guarantee (advertised to
  users in [messages.ts:77](apps/bot/src/copy/messages.ts#L77) and
  [worker-status.ts:40](apps/bot/src/menus/worker-status.ts#L40)) can be violated. Multiple
  accounts can claim the same payout address.
- **Fix:** Add `@unique` to `nimiqAddress` in the schema and handle the resulting
  `P2002` error as `ADDRESS_IN_USE`.

### H3. User-controlled names are injected into Telegram Markdown without escaping
- **Where:** the greeting/welcome strings embed names as `*${name}*` —
  [messages.ts:116](apps/bot/src/copy/messages.ts#L116) (`onboarding.welcome`),
  [messages.ts:140](apps/bot/src/copy/messages.ts#L140) (`onboarding.complete`),
  [messages.ts:155](apps/bot/src/copy/messages.ts#L155) (`menu.greeting`) — fed unescaped from
  [onboarding.ts:60-66](apps/bot/src/conversations/onboarding.ts#L60-L66),
  [start.ts:26-27](apps/bot/src/commands/start.ts#L26-L27),
  [menu.ts:22-23](apps/bot/src/commands/menu.ts#L22-L23),
  [creator.ts:205-209](apps/bot/src/menus/creator.ts#L205-L209).
- **Problem:** `displayName` / `first_name` come straight from Telegram and are interpolated
  into `parse_mode: "Markdown"` text **without** `escapeMarkdown`. A name containing an
  unbalanced `*`, `_`, `` ` `` or `[` produces invalid Markdown.
- **Impact:** Telegram rejects the send with HTTP 400 ("can't parse entities"). The welcome
  banner, onboarding completion, and main-menu greeting all fail for any user whose Telegram
  name contains a Markdown special character — i.e. those users can't onboard or open the menu.
- **Fix:** Run every interpolated name through `escapeMarkdown` (and fix H/M5 about which
  escaper to use).

---

## 🟡 Medium

### M4. `escapeMarkdown` escapes the *MarkdownV2* charset but every message uses legacy `"Markdown"`
- **Where:** [markdown.ts:2](apps/bot/src/utils/markdown.ts#L2) escapes
  `_ * [ ] ( ) ~ \` > # + - = | { } . ! \`; all `ctx.reply`/`prompt` calls use
  `parse_mode: "Markdown"` (v1), e.g.
  [create-quest.ts](apps/bot/src/conversations/create-quest.ts),
  [quest-list.ts:40](apps/bot/src/menus/quest-list.ts#L40).
- **Problem:** Telegram's legacy `Markdown` does not support backslash-escaping. So escaped
  content renders the backslashes literally (a quest title "Mr. X" shows as `Mr\. X`), and the
  escaper does not actually protect v1 from unbalanced `*`/`_`.
- **Impact:** Visible `\` litter in user-facing text wherever `escapeMarkdown` is used, and the
  escaping doesn't reliably prevent parse errors it was meant to prevent.
- **Fix:** Switch all messages to `parse_mode: "MarkdownV2"` (matches the escaper) — or rewrite
  the escaper for v1 rules. Standardize on one.

### M5. `formatLinkedWallet` mangles an already-spaced address
- **Where:** [wallet.ts:14-16](apps/bot/src/conversations/wallet.ts#L14-L16), used at
  [wallet.ts:81](apps/bot/src/conversations/wallet.ts#L81).
- **Problem:** `validateNimiqAddress` returns `toUserFriendlyAddress()`, which is **already**
  grouped with spaces (`NQxx xxxx xxxx …`). `formatLinkedWallet` then inserts another space
  every 9 characters, producing garbled grouping.
- **Impact:** The "Wallet linked" confirmation shows a misformatted payout address. (The
  `current wallet` message at [messages.ts:90](apps/bot/src/copy/messages.ts#L90) shows it
  correctly, making the inconsistency obvious.)
- **Fix:** Display `wallet.nimiqAddress` directly; drop the re-spacing.

### M6. `rewardAmount` has no upper bound or decimal-scale guard
- **Where:** [shared/src/index.ts:40](packages/shared/src/index.ts#L40)
  (`rewardAmount: z.number().positive()`) → written to `Decimal(18,8)` at
  [quest.service.ts:67](apps/api/src/services/quest.service.ts#L67).
- **Problem:** A value exceeding `Decimal(18,8)` range (more than ~10 integer digits) or with
  more than 8 decimal places throws a Prisma error inside `db.quest.create`. That error is **not**
  a `QuestServiceError`, so the route's `catch` rethrows it → unhandled → HTTP 500.
- **Impact:** A creator entering a very large reward (e.g. `99999999999`) gets a 500 and loses
  the entire wizard input (bot shows the generic `saveFailed`). Also float precision can subtly
  alter stored amounts.
- **Fix:** Add `.max(...)` and a decimal-places refinement in `createQuestSchema`; surface as
  `INVALID_QUEST`.

### M7. `listCreatorQuests` forwards an arbitrary `?status` value into Prisma
- **Where:** [quest.service.ts:86-92](apps/api/src/services/quest.service.ts#L86-L92)
  (`status as Quest["status"]`), exposed via
  [quests.ts:68-86](apps/api/src/routes/quests.ts#L68-L86).
- **Problem:** The raw query string is cast to the enum type and passed to Prisma with no
  validation. An invalid value (e.g. `?status=foo`) triggers `PrismaClientValidationError`,
  which isn't a `QuestServiceError` → uncaught → HTTP 500.
- **Impact:** Trivially reachable 500 on the public list endpoint.
- **Fix:** Validate `status` against `questStatusSchema` and reject/ignore invalid values.

### M8. CORS reflects any origin
- **Where:** [app.ts:21](apps/api/src/app.ts#L21) — `cors({ origin: true })`.
- **Problem:** Every origin is allowed. Combined with C1 (no auth), the API is fully open to
  any web page.
- **Fix:** Restrict `origin` to known front-ends once auth is in place.

---

## 🟢 Low / polish

### L9. Bot exits with status code 0 on invalid/missing config
- **Where:** [index.ts:13-18](apps/bot/src/index.ts#L13-L18) — `process.exit(0)` after a config
  validation failure.
- **Problem:** A fatal misconfiguration is reported as a *successful* exit. In CI/containers
  this masks the failure (orchestrators treat 0 as healthy).
- **Fix:** Exit non-zero (e.g. `process.exit(1)`) for a genuine config error.

### L10. Webhook HTTP server is never closed on shutdown
- **Where:** shutdown handler at [bot.ts:46-50](apps/bot/src/bot.ts#L46-L50) only calls
  `bot.stop()` + `redis.disconnect()`; the `http.Server` from
  [webhook.ts:17-38](apps/bot/src/webhook.ts#L17-L38) is never `server.close()`-d.
- **Impact:** On SIGTERM/SIGINT in webhook mode the listening socket lingers; not a graceful
  shutdown.
- **Fix:** Return/track the server and `server.close()` during shutdown.

### L11. Seeded creator can't create or publish quests
- **Where:** [seed.ts:18-28](packages/database/prisma/seed.ts#L18-L28) creates a CREATOR with
  `status: ACTIVE` but **no** `WalletProfile`; `assertVerifiedProfile`
  ([profile.service.ts:37](apps/api/src/services/profile.service.ts#L37)) requires a VERIFIED
  wallet.
- **Impact:** The "Test Creator" seed account is blocked from the core creator flows it's meant
  to demo (`NOT_VERIFIED`).
- **Fix:** Seed a VERIFIED `WalletProfile` for the test creator (and admin if needed).

### L12. `parseDeadline` stores date-only as UTC but renders in server-local time
- **Where:** parse at
  [create-quest.ts:41-52](apps/bot/src/conversations/create-quest.ts#L41-L52)
  (`T23:59:59.000Z`); render via `toLocaleDateString` at
  [create-quest.ts:54-60](apps/bot/src/conversations/create-quest.ts#L54-L60) and
  [quest-list.ts:30-34](apps/bot/src/menus/quest-list.ts#L30-L34).
- **Impact:** For servers west of UTC, a deadline entered as `2026-07-01` can display as
  `Jun 30, 2026` — an off-by-one-day confusion.
- **Fix:** Format with an explicit `timeZone: "UTC"`, or store the intended local end-of-day.

### L13. `registerCreator` returns a user without the wallet relation
- **Where:** [creator.service.ts:57-60](apps/api/src/services/creator.service.ts#L57-L60) —
  `db.user.update(...)` has no `include: { walletProfile: true }`.
- **Impact:** The `POST /creator/register` response always has `wallet: null` even though the
  user just linked one (`toUserResponse` reads `user.walletProfile`). Misleading API response.
- **Fix:** Add the `walletProfile` include to the update.

### L14. Quest wizard never enforces the title max length (100)
- **Where:** title is only checked for `< 3` at
  [create-quest.ts:264-267](apps/bot/src/conversations/create-quest.ts#L264-L267); schema caps
  at 100 ([shared/src/index.ts:37](packages/shared/src/index.ts#L37)).
- **Impact:** A >100-char title passes the whole 8-step wizard, then fails server validation
  with the generic `saveFailed`, discarding all entered data — poor UX and inconsistent with the
  inline retry loops used for reward/slots/deadline.
- **Fix:** Validate `title.length` (and other max bounds) inline during the step.

### L15. Logging middleware records full message text
- **Where:** [logging.ts:10-14](apps/bot/src/middleware/logging.ts#L10-L14) logs raw
  `ctx.message.text`.
- **Impact:** Wallet addresses and any other user-typed content land in logs (privacy /
  data-retention concern).
- **Fix:** Redact or omit free-text bodies; log lengths/types instead.

---

## Notes / not bugs (verified during audit)
- `upsertUser` correctly omits `role` on update, so re-running `/start` won't demote a CREATOR.
- The unknown-command filter ([commands/index.ts:20-25](apps/bot/src/commands/index.ts#L20-L25))
  and `fallbackMiddleware` don't double-respond (fallback early-returns on `/`-prefixed text).
- Conversation `maxMilliseconds`/`otherwise` timeout handling was reviewed; behavior depends on
  `@grammyjs/conversations@^2.1.1` internals and was not flagged as a definite defect.
</content>
</invoke>
