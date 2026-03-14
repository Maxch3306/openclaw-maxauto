# Requirements: MaxAuto

**Defined:** 2026-03-14
**Core Value:** Users can install, configure, and use OpenClaw without touching a terminal — everything managed through a clean desktop UI.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Telegram Channel Management

- [ ] **TELE-01**: User can enter and validate a Telegram bot token in-app
- [ ] **TELE-02**: User can configure DM allow-list (which users can message the bot)
- [ ] **TELE-03**: User can configure group allow-list (which groups the bot serves)
- [ ] **TELE-04**: User can bind a Telegram bot to a specific agent (1:1 mapping)
- [ ] **TELE-05**: User can see connection status of the Telegram bot (connected/disconnected/error)

### Skills Management

- [ ] **SKIL-01**: User can view a list of all available skills with their status (enabled/disabled/unavailable)
- [ ] **SKIL-02**: User can toggle skills on and off
- [ ] **SKIL-03**: User can enter API keys for skills that require them
- [ ] **SKIL-04**: User can see why a skill is unavailable (missing dependencies, requirements)
- [ ] **SKIL-05**: User can install skill dependencies from the UI

### Workspace Configuration

- [ ] **WORK-01**: User can view and change the default workspace directory via native folder picker
- [ ] **WORK-02**: User can set a different workspace directory per agent
- [ ] **WORK-03**: User can open the workspace folder in the system file manager

### Infrastructure

- [x] **INFR-01**: Config writes use `config.patch` (merge semantics) instead of full replace to prevent race conditions

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Telegram

- **TELE-06**: User can manage multiple Telegram bot accounts
- **TELE-07**: User can toggle streaming mode for Telegram responses

### Skills

- **SKIL-06**: User can filter/search skills by name or category
- **SKIL-07**: User can configure per-agent skill allowlists

### Channels

- **CHAN-01**: User can manage WhatsApp channel connections
- **CHAN-02**: User can manage Discord bot connections
- **CHAN-03**: N:M channel-to-agent routing with rules

## Out of Scope

| Feature | Reason |
|---------|--------|
| MCP service management | Defer until skills management is solid |
| In-app file editing for workspace | Complexity, users have their own editors |
| ClawHub skill marketplace integration | Large scope, future milestone |
| Webhook-based Telegram integration | Polling is simpler for desktop app |
| Multi-channel per agent (N:M binding) | Keep 1:1 for simplicity |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1: Config Infrastructure | Complete |
| SKIL-01 | Phase 2: Skills Discovery | Pending |
| SKIL-04 | Phase 2: Skills Discovery | Pending |
| SKIL-02 | Phase 3: Skills Control | Pending |
| SKIL-03 | Phase 3: Skills Control | Pending |
| SKIL-05 | Phase 4: Skills Installation | Pending |
| WORK-01 | Phase 5: Workspace Defaults | Pending |
| WORK-03 | Phase 5: Workspace Defaults | Pending |
| WORK-02 | Phase 6: Per-Agent Workspace | Pending |
| TELE-01 | Phase 7: Telegram Bot Setup | Pending |
| TELE-05 | Phase 7: Telegram Bot Setup | Pending |
| TELE-02 | Phase 8: Telegram Access Control | Pending |
| TELE-03 | Phase 8: Telegram Access Control | Pending |
| TELE-04 | Phase 9: Channel-Agent Binding | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after roadmap creation*
