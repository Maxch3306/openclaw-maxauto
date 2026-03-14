# Requirements: MaxAuto v1.1

**Defined:** 2026-03-14
**Core Value:** Users can install, configure, and use OpenClaw without touching a terminal -- everything managed through a clean desktop UI.

## v1.1 Requirements

Requirements for multi-bot Telegram milestone. Each maps to roadmap phases.

### Bot Account Management

- [ ] **MBOT-01**: User can add a new Telegram bot by entering its token (validated via getMe API)
- [ ] **MBOT-02**: User can remove a Telegram bot account and its associated binding
- [ ] **MBOT-03**: User can enable/disable individual bot accounts without removing them
- [ ] **MBOT-04**: User can see per-bot connection status (connected/disconnected/error)

### Binding & Routing

- [x] **MBOT-05**: User can bind each bot to a specific agent via per-bot dropdown with match.accountId
- [ ] **MBOT-06**: UI enforces 1:1 binding -- same agent cannot be bound to two bots, same bot cannot be bound to two agents
- [x] **MBOT-07**: Existing single-bot config migrates to accounts.default structure when adding a second bot

### Per-Bot Access Control

- [ ] **MBOT-08**: Each bot has its own DM policy and allow-list configuration
- [ ] **MBOT-09**: Each bot has its own group policy and allow-list configuration

## Future Requirements

Deferred to future milestone.

### Multi-Channel

- **CHAN-01**: User can manage WhatsApp channel connections
- **CHAN-02**: User can manage Discord bot connections

### Advanced

- **MBOT-10**: Bot nickname/label for easier identification
- **MBOT-11**: Bulk enable/disable all bots

## Out of Scope

| Feature | Reason |
|---------|--------|
| N:M agent-channel routing | 1:1 enforcement is the explicit design choice |
| Webhook-based Telegram | Polling is simpler for desktop app |
| Cross-bot message forwarding | Complexity, unclear value |
| Auto-migration on app update | Lazy migration on first multi-bot add is safer |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MBOT-01 | Phase 11 | Pending |
| MBOT-02 | Phase 11 | Pending |
| MBOT-03 | Phase 11 | Pending |
| MBOT-04 | Phase 11 | Pending |
| MBOT-05 | Phase 10 | Complete |
| MBOT-06 | Phase 11 | Pending |
| MBOT-07 | Phase 10 | Complete |
| MBOT-08 | Phase 12 | Pending |
| MBOT-09 | Phase 12 | Pending |

**Coverage:**
- v1.1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-15 after roadmap creation*
