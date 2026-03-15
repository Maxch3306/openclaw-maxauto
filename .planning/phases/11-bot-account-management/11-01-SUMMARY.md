---
phase: 11-bot-account-management
plan: 01
subsystem: ui
tags: [telegram, multi-bot, card-ui, bot-card, agent-binding]

# Dependency graph
requires:
  - phase: 10-multi-bot-config-foundation
    provides: telegram-accounts.ts helpers, account-scoped config read/write
provides:
  - BotCardList container loading multi-account config, status, and bindings
  - BotCard component with compact/expanded views, status, toggle, 1:1 agent binding
  - Refactored IMChannelsSection as thin shell delegating to BotCardList
affects: [11-bot-account-management-plan-02, 12-per-bot-access-control]

# Tech tracking
tech-stack:
  added: []
  patterns: [card-list expand/collapse, per-card toggle with minimal config patch, 1:1 agent binding enforcement]

key-files:
  created: [src/components/settings/BotCardList.tsx, src/components/settings/BotCard.tsx]
  modified: [src/components/settings/IMChannelsSection.tsx]

key-decisions:
  - "Bot token read-only in expanded card view; remove-and-readd pattern for token changes"
  - "Pairing section always visible regardless of bot DM policy (simpler, handles empty gracefully)"
  - "Status derived per-card from config.enabled and status snapshot, not from shared parent state"

patterns-established:
  - "Card expand/collapse via parent expandedId state (single expanded card pattern)"
  - "Enable/disable toggle writes only enabled field via patchConfig to avoid data loss"
  - "1:1 agent enforcement: filter allBindings to find agents bound to other telegram accounts"

requirements-completed: [MBOT-03, MBOT-04, MBOT-06]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 11 Plan 01: Bot Account Management UI Summary

**Card-based multi-bot UI with BotCardList/BotCard components, per-bot status display, enable/disable toggle, and 1:1 agent binding enforcement**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T04:38:01Z
- **Completed:** 2026-03-15T04:42:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created BotCardList container that loads multi-account config, per-account status map, and bindings from gateway
- Created BotCard with compact view (status dot, @username, bound agent, enable/disable toggle) and expanded view (full settings form)
- Implemented 1:1 agent binding enforcement -- agents bound to other bots shown as disabled with explanation
- Refactored IMChannelsSection from 785 lines to ~220 lines, delegating all bot logic to card components

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BotCardList and BotCard components** - `1410d32b2` (feat)
2. **Task 2: Refactor IMChannelsSection to use BotCardList** - `6a3e017db` (refactor)

## Files Created/Modified
- `src/components/settings/BotCardList.tsx` - Container loading config/status/bindings, rendering BotCard list with empty state
- `src/components/settings/BotCard.tsx` - Per-bot card with compact header, expand-on-click, full settings form, 1:1 agent enforcement
- `src/components/settings/IMChannelsSection.tsx` - Thin shell rendering BotCardList + pairing section + other channels

## Decisions Made
- Bot token displayed as read-only in expanded card view; token changes require remove-and-readd (keeps BotCard simpler, AddBotDialog in Plan 02 handles token validation)
- Pairing section rendered unconditionally (was gated on isPairingMode && isConfigured); empty state message handles no-requests case gracefully
- ChannelAccountSnapshot type exported from BotCardList.tsx as the canonical location (shared between BotCardList and BotCard)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused Loader2 import from BotCard**
- **Found during:** Task 1 (BotCard component creation)
- **Issue:** TypeScript TS6133 error for unused Loader2 import
- **Fix:** Removed the import
- **Files modified:** src/components/settings/BotCard.tsx
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 1410d32b2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Trivial import cleanup. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BotCardList and BotCard provide the structural foundation for Plan 02's AddBotDialog and RemoveBotDialog
- showAddDialog and removeTarget state already wired in IMChannelsSection for Plan 02
- validateBotToken function can be extracted to shared util from the old code (or reimplemented in AddBotDialog)

---
*Phase: 11-bot-account-management*
*Completed: 2026-03-15*
