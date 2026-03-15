---
phase: 11-bot-account-management
plan: 02
subsystem: ui
tags: [telegram, multi-bot, dialog, add-bot, remove-bot, token-validation, agent-binding]

# Dependency graph
requires:
  - phase: 11-bot-account-management-plan-01
    provides: BotCardList/BotCard components, IMChannelsSection shell with placeholder state
provides:
  - AddBotDialog with token validation via getMe, 1:1 agent binding, migration support
  - RemoveBotDialog with impact summary and atomic delete
  - Fully wired IMChannelsSection with dialog rendering and reload on add/remove
affects: [12-per-bot-access-control]

# Tech tracking
tech-stack:
  added: []
  patterns: [step-based modal flow (validate-then-select), atomic config delete via merge-patch null, reloadKey remount pattern]

key-files:
  created: [src/components/settings/AddBotDialog.tsx, src/components/settings/RemoveBotDialog.tsx]
  modified: [src/components/settings/IMChannelsSection.tsx]

key-decisions:
  - "AddBotDialog loads its own config on open for duplicate detection and binding data -- no prop dependency needed"
  - "Token validation triggers config load for fresh binding/account state before showing agent dropdown"
  - "RemoveBotDialog loads impact summary on open to show bound agent, policies, and access list counts"
  - "reloadKey counter pattern forces BotCardList remount after add/remove for clean state refresh"

patterns-established:
  - "Step-based modal: validation step gates next step visibility (token validated -> agent dropdown appears)"
  - "Atomic config delete: merge-patch null for account key + buildUpdatedBindings(null) in single patchConfig"
  - "Destructive dialog pattern: warning icon, impact summary, red Remove button"

requirements-completed: [MBOT-01, MBOT-02]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 11 Plan 02: Bot Lifecycle Dialogs Summary

**AddBotDialog with getMe token validation, 1:1 agent binding, and lazy migration; RemoveBotDialog with impact summary and atomic merge-patch delete**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T04:43:38Z
- **Completed:** 2026-03-15T04:47:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created AddBotDialog with step-based flow: token input with regex pre-check, getMe API validation, duplicate bot detection, agent dropdown with 1:1 enforcement, and lazy migration for flat-to-multi-account configs
- Created RemoveBotDialog with impact summary (bound agent, DM/group policies, access list entry count) and atomic delete via single patchConfig call
- Wired both dialogs into IMChannelsSection with reloadKey counter pattern for post-action refresh

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AddBotDialog and RemoveBotDialog** - `90e0b0e76` (feat)
2. **Task 2: Wire dialogs into IMChannelsSection** - `272e91fc4` (feat)

## Files Created/Modified
- `src/components/settings/AddBotDialog.tsx` - Modal dialog for adding a new Telegram bot with token validation and agent selection
- `src/components/settings/RemoveBotDialog.tsx` - Confirmation dialog showing what will be lost when removing a bot
- `src/components/settings/IMChannelsSection.tsx` - Updated to render AddBotDialog and RemoveBotDialog with reload support

## Decisions Made
- AddBotDialog loads its own config on open rather than receiving existingAccountIds from parent -- simpler data flow and always fresh data
- Token validation triggers config load to get latest bindings for 1:1 agent enforcement
- RemoveBotDialog loads impact summary asynchronously on open rather than requiring parent to pass it
- Used reloadKey counter to force BotCardList remount after add/remove -- cleanest approach for full state refresh

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full bot CRUD is now complete: add (with validation + agent binding), view/edit (BotCard expanded), toggle enable/disable, remove (with confirmation)
- Ready for Phase 12: per-bot access control refinements

---
*Phase: 11-bot-account-management*
*Completed: 2026-03-15*
