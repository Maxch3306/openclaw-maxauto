---
phase: 01-config-infrastructure
plan: 01
subsystem: infra
tags: [config, merge-patch, websocket, gateway, race-condition]

# Dependency graph
requires: []
provides:
  - "patchConfig() helper for merge-patch config writes via gateway"
  - "waitForReconnect() helper for post-restart reconnection polling"
  - "All 11 config write sites using merge-patch instead of full-replace"
affects: [02-mcp-management, 03-skills-section, 04-general-section, 05-workspace-section, 06-telegram-access-control]

# Tech tracking
tech-stack:
  added: []
  patterns: [config-patch-merge, reconnect-polling]

key-files:
  created:
    - src/api/config-helpers.ts
  modified:
    - src/stores/settings-store.ts
    - src/stores/chat-store.ts
    - src/components/settings/IMChannelsSection.tsx

key-decisions:
  - "Used gateway config.patch with optimistic locking (baseHash) for all config writes"
  - "Removed splitProviders() as merge-patch makes built-in/custom provider separation unnecessary at write time"
  - "removeCustomModel and removeProvider read config via gateway.request to find keys to null-out"

patterns-established:
  - "Config writes: construct partial patch object, call patchConfig(), await waitForReconnect(), then reload"
  - "Key deletion: set value to null in patch object (RFC 7396 merge-patch semantics)"

requirements-completed: [INFR-01]

# Metrics
duration: 8min
completed: 2026-03-14
---

# Phase 1 Plan 1: Config Patch Migration Summary

**Migrated all 11 config write sites from full-replace to gateway merge-patch with optimistic locking, eliminating race conditions and removing 6.5s of hardcoded restart delays**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-14T12:42:28Z
- **Completed:** 2026-03-14T12:50:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `patchConfig()` and `waitForReconnect()` helpers in new `src/api/config-helpers.ts`
- Migrated 8 settings-store methods, 1 chat-store method, and 2 IMChannelsSection functions to use config.patch
- Removed dead code: `writeConfigAndRestart()`, `restartGateway()`, `splitProviders()`, and unused imports

## Task Commits

Each task was committed atomically:

1. **Task 1: Create config-helpers.ts** - `382809eef` (feat)
2. **Task 2: Migrate all 11 call sites and remove dead code** - `52e501254` (feat)

## Files Created/Modified
- `src/api/config-helpers.ts` - New helper with patchConfig() and waitForReconnect()
- `src/stores/settings-store.ts` - 8 methods migrated, writeConfigAndRestart/splitProviders removed
- `src/stores/chat-store.ts` - setAgentModel migrated from config.set to patchConfig
- `src/components/settings/IMChannelsSection.tsx` - saveTelegramConfig/disableTelegram migrated, restartGateway removed

## Decisions Made
- Used gateway's `config.patch` with `baseHash` optimistic locking for all writes (prevents stale-hash races)
- Removed `splitProviders()` since merge-patch eliminates the need to separate built-in vs custom providers at write time -- patches only affect specified keys
- For removal operations (removeCustomModel, removeProvider, removeQuickProvider), read current config via `gateway.request("config.get")` to identify keys that need null-deletion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused splitProviders function**
- **Found during:** Task 2 (migration)
- **Issue:** After migrating all call sites, `splitProviders()` had zero callers, causing TS6133 error
- **Fix:** Removed the function entirely
- **Files modified:** src/stores/settings-store.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 52e501254 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary cleanup of dead code revealed by migration. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Config infrastructure complete: all config writes use merge-patch semantics
- Ready for any phase that needs to write config (MCP, Skills, Workspace, Channels, etc.)
- Pattern established: construct partial patch, call patchConfig(), await waitForReconnect()

---
*Phase: 01-config-infrastructure*
*Completed: 2026-03-14*
