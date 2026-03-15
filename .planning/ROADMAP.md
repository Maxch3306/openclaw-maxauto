# Roadmap: MaxAuto

## Milestones

- [x] **v1.0 Settings & Channels** - Phases 1-9 (shipped 2026-03-14)
- [ ] **v1.1 Multi-Bot Telegram** - Phases 10-12 (in progress)

## Phases

<details>
<summary>v1.0 Settings & Channels (Phases 1-9) - SHIPPED 2026-03-14</summary>

- [x] **Phase 1: Config Infrastructure** - Safe config writes via patch semantics to prevent race conditions (completed 2026-03-14)
- [x] **Phase 2: Skills Discovery** - Users can see all available skills and understand their status (completed 2026-03-14)
- [x] **Phase 3: Skills Control** - Users can toggle skills and configure their API keys (completed 2026-03-14)
- [x] **Phase 4: Skills Installation** - Users can install missing skill dependencies from the UI (completed 2026-03-14)
- [x] **Phase 5: Workspace Defaults** - Users can view, change, and open the default workspace directory (completed 2026-03-14)
- [x] **Phase 6: Per-Agent Workspace** - Users can assign different workspace directories to individual agents (completed 2026-03-14)
- [x] **Phase 7: Telegram Bot Setup** - Users can enter a bot token and see its connection status (completed 2026-03-14)
- [x] **Phase 8: Telegram Access Control** - Users can control which users and groups can interact with the bot (completed 2026-03-14)
- [x] **Phase 9: Channel-Agent Binding** - Users can bind a Telegram bot to a specific agent (completed 2026-03-14)

</details>

### v1.1 Multi-Bot Telegram

**Milestone Goal:** Support multiple Telegram bots, each bound to a unique agent with strict 1:1 enforcement and per-bot access control.

- [x] **Phase 10: Multi-Bot Config Foundation** - Account-scoped config layer with migration, binding fix, and pairing scoping (completed 2026-03-14)
- [ ] **Phase 11: Bot Account Management** - Card-based multi-bot UI with add/remove/toggle, status, and 1:1 enforcement
- [ ] **Phase 12: Per-Bot Access Control** - Each bot gets its own DM and group allow-list configuration

## Phase Details

### Phase 10: Multi-Bot Config Foundation
**Goal**: Config layer correctly supports multiple Telegram bot accounts with account-scoped bindings, migration from single-bot, and no data corruption
**Depends on**: Phase 9
**Requirements**: MBOT-05, MBOT-07
**Success Criteria** (what must be TRUE):
  1. Existing single-bot config migrates atomically to accounts.default structure when user adds a second bot, preserving all existing settings
  2. Saving one bot's agent binding does not destroy or modify other bots' bindings in the config
  3. Agent bindings use match.accountId to route messages to the correct bot-agent pair
  4. Account IDs are normalized consistently (lowercase alphanumeric + hyphen) matching OpenClaw's internal normalization
**Plans**: 1 plan

Plans:
- [ ] 10-01-PLAN.md — Account-scoped config helpers and IMChannelsSection refactor with binding fix

### Phase 11: Bot Account Management
**Goal**: Users can manage multiple Telegram bots through a card-based UI with full lifecycle control and strict 1:1 binding
**Depends on**: Phase 10
**Requirements**: MBOT-01, MBOT-02, MBOT-03, MBOT-04, MBOT-06
**Success Criteria** (what must be TRUE):
  1. User can add a new Telegram bot by entering its token, which is validated via getMe before saving
  2. User can remove a bot and see a confirmation showing what will be lost (binding, access config)
  3. User can enable or disable a bot without removing it or losing its configuration
  4. User can see each bot's connection status (connected, disconnected, error) in its card
  5. User cannot bind an agent that is already bound to another bot -- the dropdown shows why it is unavailable
**Plans**: 2 plans

Plans:
- [ ] 11-01-PLAN.md — BotCardList + BotCard component decomposition with status, toggle, and 1:1 enforcement
- [ ] 11-02-PLAN.md — AddBotDialog + RemoveBotDialog modal dialogs for bot lifecycle

### Phase 12: Per-Bot Access Control
**Goal**: Each Telegram bot has independent access control settings for DM and group interactions
**Depends on**: Phase 11
**Requirements**: MBOT-08, MBOT-09
**Success Criteria** (what must be TRUE):
  1. User can set a DM policy (allow/deny) and DM allow-list independently for each bot
  2. User can set a group policy (allow/deny) and group allow-list independently for each bot
  3. Changing one bot's access control settings does not affect any other bot's access control
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 10 -> 11 -> 12
Phase 10 is mandatory before 11 and 12 (config correctness foundation). Phase 12 depends on Phase 11 (needs per-bot editor UI to attach access control).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Config Infrastructure | v1.0 | 1/2 | Complete | 2026-03-14 |
| 2. Skills Discovery | v1.0 | 1/1 | Complete | 2026-03-14 |
| 3. Skills Control | v1.0 | 1/1 | Complete | 2026-03-14 |
| 4. Skills Installation | v1.0 | 0/1 | Complete | 2026-03-14 |
| 5. Workspace Defaults | v1.0 | 0/1 | Complete | 2026-03-14 |
| 6. Per-Agent Workspace | v1.0 | 0/1 | Complete | 2026-03-14 |
| 7. Telegram Bot Setup | v1.0 | 1/1 | Complete | 2026-03-14 |
| 8. Telegram Access Control | v1.0 | 0/1 | Complete | 2026-03-14 |
| 9. Channel-Agent Binding | v1.0 | 1/1 | Complete | 2026-03-14 |
| 10. Multi-Bot Config Foundation | 1/1 | Complete    | 2026-03-14 | - |
| 11. Bot Account Management | v1.1 | 0/2 | Not started | - |
| 12. Per-Bot Access Control | v1.1 | 0/? | Not started | - |
