# Bot Command Reference — Milestone 1

The NimiqEarn Quest Telegram bot (`apps/bot`, built on [grammY](https://grammy.dev))
exposes the following commands, menus, and flows in Milestone 1.

## Commands

| Command | Audience | Behavior |
| --- | --- | --- |
| `/start` | All | New users enter onboarding (welcome → terms → profile). Returning users get the main menu. |
| `/menu` | Registered | Opens the main menu. Prompts unregistered users to `/start`. |
| `/wallet` | Registered | Link/update a Nimiq payout address and verify ownership by signing (rate-limited). |
| `/quests` | Registered | Milestone 1 stub. Workers see a "coming in M2" notice; creators are pointed to *My Quests*. |
| `/creator` | Registered | Opens the Creator Hub, or invites the user to become a creator. |
| `/help` | All | Command list, menu guide, and community guidelines. |

Unknown commands (`/something`) return a friendly hint. Unrecognized plain text
(when no conversation is active) suggests `/menu` or `/help`.

## Main menu (inline keyboard)

| Button | Action |
| --- | --- |
| Start Earning | Shows the worker profile + verification status. |
| My Wallet | Enters the wallet link/update flow. |
| Creator Hub | Opens the Creator Hub (register or dashboard). |
| Help | Shows the help text. |

## Creator Hub

| Button | Action |
| --- | --- |
| Become a Creator | Upgrades a verified worker to the `CREATOR` role. |
| Create Quest | Starts the 8-step quest creation wizard. |
| My Quests | Lists the creator's quests with publish/edit actions. |
| Publish draft #N | Publishes a specific draft (`DRAFT → PUBLISHED`). |
| Edit draft #N | Opens the draft editor for a specific draft. |
| Main Menu | Returns to the main menu. |

## Conversations (multi-step flows)

| Conversation | Entry | Steps |
| --- | --- | --- |
| `onboarding` | `/start` (new user) | Welcome banner → terms agreement → profile saved. |
| `wallet` | `/wallet`, *My Wallet* | Prompt address → create signing challenge → user signs on the web page → poll status → verified. |
| `createQuest` | *Create Quest* | Title, category, description, reward, slots, deadline, proof type, proof instructions → review → save draft. |
| `editQuest` | *Edit draft #N* | Field menu → edit one field at a time (saved per change) → done. |

Each step has a 5-minute timeout and a *Cancel* control. Bot prompt messages and
user inputs are cleaned up as a step completes to keep the chat tidy
(`utils/chat-cleanup.ts`).

## Validation rules (client-side, enforced again by the API)

| Field | Rule |
| --- | --- |
| Title | 3–100 characters |
| Description | ≥ 10 characters |
| Reward | Positive number, ≤ 1,000,000,000, ≤ 8 decimal places |
| Slots | Positive whole number |
| Deadline | `YYYY-MM-DD` (interpreted as 23:59:59 UTC) or parseable date, must be in the future |
| Proof instructions | ≥ 5 characters |
| Nimiq address | Valid Nimiq user-friendly address (format + checksum via `@nimiq/core`) |

## Rate limiting

Sensitive flow entries — `/wallet` / *My Wallet*, *Create Quest*, and *Edit draft* —
are throttled per user (5 actions / 60s) using a Redis fixed-window limiter
(`utils/rate-limit.ts`, `middleware/rate-limit.ts`). Exceeding the limit returns a
"slow down" message without entering the flow.

## Run modes

| Mode | When | How |
| --- | --- | --- |
| Polling | Local dev | Leave `WEBHOOK_URL` empty, run `pnpm dev:bot`. |
| Webhook | Production-like | Set `WEBHOOK_URL` + `WEBHOOK_SECRET`, expose `BOT_WEBHOOK_PORT`. |

See [setup.md](setup.md) for environment configuration and the full QA checklist.
