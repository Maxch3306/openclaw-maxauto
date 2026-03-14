# Roadmap: MaxAuto

## Overview

This milestone transforms MaxAuto from a chat-only desktop wrapper into a full OpenClaw management console. Starting with config infrastructure to prevent write races, then building skills management (discovery, control, installation), workspace configuration (default and per-agent), and finally completing Telegram channel management (bot setup, access control, agent binding). Each phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Config Infrastructure** - Safe config writes via patch semantics to prevent race conditions (completed 2026-03-14)
- [x] **Phase 2: Skills Discovery** - Users can see all available skills and understand their status (completed 2026-03-14)
- [x] **Phase 3: Skills Control** - Users can toggle skills and configure their API keys (completed 2026-03-14)
- [x] **Phase 4: Skills Installation** - Users can install missing skill dependencies from the UI (completed 2026-03-14)
- [x] **Phase 5: Workspace Defaults** - Users can view, change, and open the default workspace directory (completed 2026-03-14)
- [x] **Phase 6: Per-Agent Workspace** - Users can assign different workspace directories to individual agents (completed 2026-03-14)
- [x] **Phase 7: Telegram Bot Setup** - Users can enter a bot token and see its connection status (completed 2026-03-14)
- [x] **Phase 8: Telegram Access Control** - Users can control which users and groups can interact with the bot (completed 2026-03-14)
- [x] **Phase 9: Channel-Agent Binding** - Users can bind a Telegram bot to a specific agent (completed 2026-03-14)

## Phase Details

### Phase 1: Config Infrastructure
**Goal**: All config writes use merge semantics, eliminating race conditions between UI sections
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01
**Success Criteria** (what must be TRUE):
  1. Config writes from any settings section merge into existing config rather than replacing the entire file
  2. Two settings sections modified in quick succession do not clobber each other's changes
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Migrate all config writes to config.patch with merge semantics
- [ ] 01-02-PLAN.md — Fix residual readConfigFile() race in custom-model write methods (gap closure)

### Phase 2: Skills Discovery
**Goal**: Users can browse all available skills and understand why any skill is unavailable
**Depends on**: Phase 1
**Requirements**: SKIL-01, SKIL-04
**Success Criteria** (what must be TRUE):
  1. User can open the Skills settings section and see a list of all skills with enabled/disabled/unavailable status
  2. User can see a clear explanation for why any unavailable skill cannot be used (missing dependency, missing API key, etc.)
  3. Skills list reflects the live state from the running gateway without requiring an app restart
**Plans**: 1 plan

Plans:
- [ ] 02-01-PLAN.md -- Skills discovery UI with grouped card grid and status badges

### Phase 3: Skills Control
**Goal**: Users can enable/disable skills and provide API keys for skills that require them
**Depends on**: Phase 2
**Requirements**: SKIL-02, SKIL-03
**Success Criteria** (what must be TRUE):
  1. User can toggle a skill on or off and the change takes effect immediately without restarting the gateway
  2. User can enter an API key for a skill that requires one, and the skill becomes available after saving
  3. Toggling or configuring one skill does not affect the state of other skills
**Plans**: 1 plan

Plans:
- [ ] 03-01-PLAN.md — Add toggle switch and API key input to skill cards

### Phase 4: Skills Installation
**Goal**: Users can install missing skill dependencies directly from the UI
**Depends on**: Phase 3
**Requirements**: SKIL-05
**Success Criteria** (what must be TRUE):
  1. User can click an install action on an unavailable skill and its dependencies are installed
  2. User can see installation progress (not a frozen UI)
  3. After installation completes, the skill status updates to reflect it is now available
**Plans**: 1 plan

Plans:
- [ ] 04-01-PLAN.md — Add install button to skill cards with gateway skills.install integration

### Phase 5: Workspace Defaults
**Goal**: Users can view, change, and access the default workspace directory
**Depends on**: Phase 1
**Requirements**: WORK-01, WORK-03
**Success Criteria** (what must be TRUE):
  1. User can see the current default workspace path in the Workspace settings section
  2. User can change the default workspace directory using a native folder picker dialog
  3. User can click a button to open the workspace folder in the system file manager (Explorer/Finder)
**Plans**: 1 plan

Plans:
- [ ] 05-01-PLAN.md — Workspace section with folder picker and open-in-explorer

### Phase 6: Per-Agent Workspace
**Goal**: Users can assign different workspace directories to individual agents
**Depends on**: Phase 5
**Requirements**: WORK-02
**Success Criteria** (what must be TRUE):
  1. User can set a workspace directory override for a specific agent via folder picker
  2. User can see which agents use the default workspace vs. a custom workspace
  3. Per-agent workspace setting persists across gateway restarts
**Plans**: 1 plan

Plans:
- [ ] 06-01-PLAN.md — Per-agent workspace in edit dialog and workspace settings

### Phase 7: Telegram Bot Setup
**Goal**: Users can add a Telegram bot by entering its token and monitor its connection health
**Depends on**: Phase 1
**Requirements**: TELE-01, TELE-05
**Success Criteria** (what must be TRUE):
  1. User can enter a Telegram bot token in the Channels settings section and save it
  2. User can see whether the Telegram bot is connected, disconnected, or in an error state
  3. Invalid bot tokens are rejected with a clear error message before saving
**Plans**: 1 plan

Plans:
- [x] 07-01-PLAN.md — Token validation via Telegram getMe API and rich connection status display

### Phase 8: Telegram Access Control
**Goal**: Users can control which Telegram users and groups can interact with the bot
**Depends on**: Phase 7
**Requirements**: TELE-02, TELE-03
**Success Criteria** (what must be TRUE):
  1. User can configure a DM allow-list specifying which Telegram users can message the bot directly
  2. User can configure a group allow-list specifying which Telegram groups the bot serves
  3. Changes to allow-lists take effect without restarting the gateway
**Plans**: 1 plan

Plans:
- [ ] 08-01-PLAN.md — Tag/chip allow-list inputs for DM users, groups, and group senders

### Phase 9: Channel-Agent Binding
**Goal**: Users can bind a Telegram bot to a specific agent so messages route to the correct agent
**Depends on**: Phase 6, Phase 8
**Requirements**: TELE-04
**Success Criteria** (what must be TRUE):
  1. User can select which agent handles messages from a specific Telegram bot
  2. User can see the current binding (which agent is assigned to which Telegram bot)
  3. Changing the binding takes effect for new incoming messages without restarting the gateway
**Plans**: 1 plan

Plans:
- [ ] 09-01-PLAN.md — Agent binding dropdown with config persistence in Telegram settings

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9
Note: Phases 2-4 (Skills) and Phases 5-6 (Workspace) and Phases 7-8 (Telegram) can run in parallel after Phase 1 completes. Phase 9 depends on both Phase 6 and Phase 8.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Config Infrastructure | 1/2 | Complete    | 2026-03-14 |
| 2. Skills Discovery | 1/1 | Complete    | 2026-03-14 |
| 3. Skills Control | 1/1 | Complete    | 2026-03-14 |
| 4. Skills Installation | 0/1 | Complete    | 2026-03-14 |
| 5. Workspace Defaults | 0/1 | Complete    | 2026-03-14 |
| 6. Per-Agent Workspace | 0/1 | Complete    | 2026-03-14 |
| 7. Telegram Bot Setup | 1/1 | Complete    | 2026-03-14 |
| 8. Telegram Access Control | 0/1 | Complete    | 2026-03-14 |
| 9. Channel-Agent Binding | 1/1 | Complete    | 2026-03-14 |
