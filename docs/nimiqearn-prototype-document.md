# NimiqEarn Quest Prototype Document

## 1. Project Overview

### Product Name

NimiqEarn Quest

### Product Type

AI-powered Telegram task and bounty marketplace powered by NIM payouts.

### Core Idea

NimiqEarn Quest is designed as a mobile-first earning and engagement layer for the Nimiq ecosystem. It allows task creators to publish bounties and microtasks inside Telegram, while workers complete those tasks and receive instant NIM rewards through a simplified wallet onboarding and payout flow.

The product is intended to make NIM useful in a daily, practical way. Instead of only being held or traded, NIM becomes the payment rail for small jobs, community rewards, product testing incentives, referral campaigns, and contribution-based payouts.

## 2. Problem Statement

Two clear problems exist:

### Problem A: Access to Simple Online Earnings

Many users, especially in mobile-first and emerging markets, want access to flexible earning opportunities but face several barriers:

- traditional freelance platforms are too heavy and desktop-oriented
- onboarding often requires formal banking or lengthy verification
- payout delays reduce trust
- many opportunities are not designed for low-friction mobile participation

### Problem B: Web3 Projects Need Lightweight Growth Infrastructure

Startups, DAOs, communities, and ecosystem builders need ways to:

- distribute micro-bounties
- reward user engagement
- recruit contributors
- test products quickly
- run low-cost growth campaigns
- incentivize community actions without manual operations

Most available tooling is fragmented, expensive, or not optimized for Telegram-native communities.

## 3. Proposed Solution

NimiqEarn Quest combines a Telegram bot, task marketplace logic, Nimiq-based payouts, and AI-assisted verification into one simple system.

The platform will allow:

- workers to discover and complete tasks inside Telegram
- task creators to post paid opportunities and fund rewards in NIM
- the system to verify, score, and process submissions
- payouts to be sent quickly after approval

The goal is to create a lightweight earn-and-reward economy around Nimiq.

## 4. Product Vision

The long-term vision is to make Telegram a practical work and participation channel for Nimiq-powered communities.

In that model:

- every community action can become a measurable task
- every accepted contribution can become an instant NIM payout
- every new user can be onboarded into Nimiq through earning rather than speculation

NimiqEarn Quest is not just a bounty board. It is intended to become a repeatable engagement engine for ecosystem growth.

## 5. Target Users

### Workers

Primary worker personas include:

- students looking for small online income opportunities
- freelancers completing quick digital tasks
- creators participating in campaign-based work
- developers joining bounty programs
- community members earning through engagement or support actions

### Task Creators

Primary task creator personas include:

- Web3 startups
- DAOs
- ecosystem teams
- creators and marketers
- product teams running user research or testing campaigns
- community managers who need verifiable participation incentives

## 6. Primary Use Cases

NimiqEarn Quest is designed around practical task types such as:

- joining and engaging in community campaigns
- social amplification tasks
- product testing and feedback
- bug report bounties
- content creation requests
- developer micro-bounties
- onboarding and referral campaigns
- survey and feedback tasks

Example:

A Nimiq ecosystem project could post a task asking users to test a new wallet flow, submit a screenshot and short feedback, and receive NIM after verification.

## 7. Product Experience

### Worker Experience

The worker journey is designed to be simple:

1. User opens the Telegram bot.
2. User starts onboarding and creates or connects a Nimiq payout profile.
3. User browses available quests.
4. User opens task details and sees reward, deadline, instructions, and proof requirements.
5. User submits proof through the bot.
6. The system reviews the submission through AI checks and platform rules.
7. Approved users receive NIM rewards.
8. The worker gains reputation and can unlock higher-quality tasks over time.

### Creator Experience

The creator journey is designed for campaign efficiency:

1. Creator registers through a creator onboarding flow.
2. Creator funds a task budget.
3. Creator submits task details, reward amount, proof rules, and acceptance criteria.
4. The system publishes the task.
5. Workers participate and submit proof.
6. The system assists with verification and moderation.
7. Approved participants are paid in NIM.
8. Creator receives task performance analytics.

## 8. Core MVP Features

The MVP is intentionally focused. It aims to prove demand, validate payout flow reliability, and demonstrate real NIM usage.

### A. Telegram Bot Interface

The bot is the main user entry point and supports:

- user registration
- task browsing
- task application and participation
- proof submission
- notifications
- wallet and payout status checks

### B. Wallet Onboarding

The onboarding flow introduces users to Nimiq in a simple way. Depending on implementation maturity, this may support:

- linking an existing Nimiq wallet address
- guided new wallet onboarding
- storing payout preferences securely

The MVP priority is reliable reward routing, not a fully custom wallet product.

### C. Task Marketplace

Workers can:

- view active tasks
- filter by category, reward, and complexity
- see deadlines and proof instructions

Creators can:

- publish tasks
- define reward budgets
- set participant caps
- define proof requirements

### D. Submission System

Users can submit:

- text responses
- links
- screenshots
- usernames
- wallet-linked proof references

The submission pipeline is designed to support both automated review and manual fallback.

### E. NIM Payout Engine

The payout system handles:

- reward calculation
- approval-based disbursement
- payout logging
- creator budget deductions

### F. AI-Assisted Verification

The AI layer helps reduce admin work by:

- checking whether proof matches task requirements
- detecting repetitive spam submissions
- flagging suspicious task behavior
- assisting with moderation decisions

The AI layer supports review, but high-risk decisions can still require manual approval in the MVP.

### G. Reputation and Trust Layer

To improve task quality over time, the product includes:

- worker reputation scores
- completion rate tracking
- creator reliability signals
- spam and abuse flags

## 9. Prototype User Flows

### Flow 1: New Worker

1. `/start`
2. Welcome screen introduces earning with NIM
3. User selects `Start Earning`
4. Bot asks for wallet setup or wallet connection
5. User receives a short onboarding guide
6. Bot shows available quests
7. User selects a quest and submits proof
8. Status changes from `submitted` to `under review`
9. User receives `approved` and payout notification

### Flow 2: Returning Worker

1. User opens bot
2. Bot shows summary:
   pending submissions, completed quests, total earned, reputation score
3. User selects a new task
4. User submits proof
5. User tracks reward status

### Flow 3: Task Creator

1. Creator enters creator dashboard flow
2. Creator provides task title, category, instructions, reward, cap, and deadline
3. Creator deposits or commits task budget
4. Task is published
5. Creator monitors submissions
6. Approved users are paid
7. Creator reviews campaign analytics

## 10. Proposed Bot Commands and Menus

Illustrative bot commands for the MVP:

- `/start` - begin onboarding
- `/quests` - list available tasks
- `/wallet` - manage payout wallet
- `/earnings` - view reward history
- `/reputation` - view trust score
- `/submit` - continue a pending submission
- `/creator` - open creator tools
- `/help` - support and FAQs

Example menu sections:

- Start Earning
- Browse Quests
- My Tasks
- My Earnings
- My Wallet
- Invite Friends
- Creator Dashboard

## 11. Dashboard and Admin Surfaces

Although Telegram is the main user interface, a lightweight web dashboard may be used for internal operations or creator tooling.

Potential MVP dashboard capabilities:

- creator task creation form
- task budget controls
- submission review queue
- payout status log
- analytics overview
- flagged content moderation panel

This dashboard does not need to be feature-heavy in the MVP. It only needs to reduce operator friction and support campaign management.

## 12. System Architecture

At a high level, the prototype can be structured into five layers:

### 1. Telegram Interaction Layer

- Telegram bot webhook or polling service
- command handlers
- message routing

### 2. Application Logic Layer

- onboarding logic
- quest lifecycle management
- submission workflow
- reputation engine
- creator campaign logic

### 3. Verification Layer

- AI-assisted proof analysis
- spam detection
- duplicate submission checks
- moderation rule engine

### 4. Payment Layer

- Nimiq wallet integration
- payout queue
- transaction logging
- budget accounting

### 5. Data Layer

- users
- wallets
- quests
- submissions
- payouts
- creator accounts
- moderation events

## 13. Suggested Data Model

The MVP can be implemented with a simple but scalable schema.

### User

- user_id
- telegram_id
- username
- role
- reputation_score
- joined_at

### WalletProfile

- wallet_id
- user_id
- nimiq_address
- status
- created_at

### Quest

- quest_id
- creator_id
- title
- description
- category
- reward_amount
- reward_currency
- slots
- deadline
- status
- verification_type

### Submission

- submission_id
- quest_id
- user_id
- proof_payload
- status
- ai_score
- moderator_notes
- submitted_at

### Payout

- payout_id
- submission_id
- recipient_wallet
- amount
- transaction_hash
- payout_status
- paid_at

## 14. Verification Approach

Verification quality is central to the credibility of the platform.

The MVP verification strategy should combine:

- rule-based checks for required fields
- AI classification for text or screenshot relevance
- duplicate detection
- suspicious pattern scoring
- manual review fallback for uncertain cases

Examples:

- for screenshot tasks, AI can confirm that a required visual element exists
- for text feedback tasks, AI can flag low-effort or repeated responses
- for social tasks, the system can require links or usernames for auditability

## 15. Anti-Fraud and Trust Controls

Because rewards are involved, abuse prevention is necessary from day one.

MVP controls may include:

- rate limits on submissions
- duplicate account detection signals
- minimum account age or activity rules
- creator review tools
- flagged-user queues
- capped rewards for new users
- escalating trust levels based on completion history

## 16. Payout Logic

The payout pipeline should be straightforward and auditable:

1. Task is funded or allocated a budget.
2. User submits proof.
3. Submission is reviewed.
4. Approved submission enters payout queue.
5. Payout is executed in NIM.
6. Transaction is logged and surfaced to the user.

This process should emphasize:

- transparency
- traceability
- quick turnaround
- low operational overhead

## 17. Product Value

NimiqEarn Quest is valuable because it creates a practical reward loop instead of a passive marketplace experience.

Expected product value areas:

- wallet onboarding growth
- higher NIM utility
- more visible real-world reward use cases
- community campaign infrastructure for ecosystem teams
- lower barrier to Web3 participation through Telegram

## 18. Design Principles

The prototype is guided by a few product principles:

- mobile-first interaction
- low-friction onboarding
- fast and understandable reward flow
- simple task creation for communities
- transparent verification and payout status
- trust-building through moderation and reputation

## 19. MVP Prototype Scope

The initial prototype scope includes:

- live Telegram bot
- functional quest marketplace
- wallet onboarding flow
- NIM payout mechanism
- AI-assisted verification module
- reputation and anti-spam controls
- lightweight creator or admin management surface

## 20. Risks and Mitigation

### Risk: Spam submissions

Mitigation:

- AI-assisted filtering
- rate limits
- reputation gating

### Risk: Low-quality tasks from creators

Mitigation:

- creator review flow
- structured task templates
- moderation tools

### Risk: Payout disputes

Mitigation:

- transparent approval rules
- payout logs
- review notes and auditability

### Risk: User onboarding friction

Mitigation:

- simplified Telegram-first onboarding
- guided wallet instructions
- low-step task participation flow

## 21. Future Expansion

After MVP validation, future releases could support:

- richer creator analytics
- tiered worker reputation levels
- API access for ecosystem partners
- campaign templates
- multilingual onboarding
- more advanced anti-fraud systems
- referral campaign automation
- mini-app or web dashboard expansion

## 22. Conclusion

NimiqEarn Quest is a practical prototype for turning Telegram into a Nimiq-powered earning environment. Its strength is not only in concept, but in how directly it maps to measurable ecosystem outcomes: wallet creation, transaction volume, repeated NIM usage, and real participation incentives.

As a product idea, it is focused around a clear user flow: discover tasks, complete tasks, verify proof, and receive rewards in a simple Telegram-native experience.
