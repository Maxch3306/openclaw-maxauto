# Phase 1: Config Infrastructure - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

All config writes use merge semantics (`config.patch`) instead of full-file replacement (`config.set`), eliminating race conditions between UI sections. This is infrastructure — no new UI features.

</domain>

<decisions>
## Implementation Decisions

### Migration scope
- Claude decides whether to do full migration of all callers or foundation-only with incremental migration
- Key constraint: there are 10+ read-modify-write cycles across settings-store.ts, chat-store.ts, and IMChannelsSection.tsx
- All callers currently use the same pattern: readConfigFile() → modify → writeConfigAndRestart() or gateway.request("config.set", { baseHash, raw })

### Claude's Discretion
- Migration strategy: full migration vs foundation + incremental (Claude decides based on complexity)
- Restart strategy: config.patch auto-restart vs manual restart with improved polling (current hardcoded delays are 1.5s/3s/2s)
- Code organization: where the new config helper lives (new utility vs extend settings-store vs inline)
- Windows fallback for SIGUSR1-based auto-restart

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `readConfigFile()` in settings-store.ts (line 375): reads openclaw.json via Tauri IPC
- `writeConfigAndRestart()` in settings-store.ts (line 381): writes full config + restarts gateway with hardcoded delays
- `gateway.request("config.set", { baseHash, raw })`: WebSocket-based config write used by IMChannelsSection and chat-store
- `gateway.request("config.get")`: reads config with hash for optimistic locking

### Established Patterns
- Settings-store: every action does `readConfigFile()` → spread-merge → `writeConfigAndRestart()`
- IMChannelsSection: uses `config.get` → modify → `config.set` with baseHash
- Chat-store: uses `config.get` → modify → `config.set` with baseHash for agent model changes

### Integration Points
- `src/api/tauri-commands.ts` (line 71-73): `readConfig()` and `writeConfig()` IPC wrappers
- `src/api/gateway-client.ts`: WebSocket `request()` method for gateway API calls
- Gateway supports `config.patch` method (verified in OpenClaw source) — merge semantics with auto-restart
- CONCERNS.md flags: hardcoded restart delays (settings-store.ts lines 389-394)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-config-infrastructure*
*Context gathered: 2026-03-14*
