---
phase: 01-config-infrastructure
verified: 2026-03-14T13:10:00Z
status: gaps_found
score: 2/3 must-haves verified
gaps:
  - truth: "Two settings sections modified in quick succession do not clobber each other's changes"
    status: partial
    reason: "addCustomModel, updateCustomModel, and replaceProviderModels still call readConfigFile() (reads disk file via Tauri IPC) as their pre-read source instead of gateway.request('config.get'). These methods build a full custom-providers patch from that stale read, then call patchConfig(). If the gateway is mid-restart after a previous patchConfig(), the disk file may lag behind the gateway's in-memory config by up to 2s. Two rapid custom-model writes can read the same stale state and one will silently overwrite the other's data."
    artifacts:
      - path: "src/stores/settings-store.ts"
        issue: "addCustomModel (line 474), updateCustomModel (line 499), and replaceProviderModels (line 593) call readConfigFile() before calling patchConfig(). They should use gateway.request('config.get') to read live state."
    missing:
      - "Replace readConfigFile() pre-read in addCustomModel, updateCustomModel, replaceProviderModels with gateway.request('config.get', {})"
human_verification:
  - test: "Open the Models & API settings section. Add two custom model providers back-to-back without waiting for the gateway restart confirmation between them. Verify both providers appear in the saved config."
    expected: "Both providers persist in openclaw.json after both saves complete."
    why_human: "Requires live gateway interaction to observe race window behavior."
  - test: "Change a model API key in Models & API, then immediately switch to Channels and save a Telegram bot token — both within the same 2-second gateway restart window."
    expected: "Both changes appear in openclaw.json — the API key and the telegram config coexist."
    why_human: "Requires live timing; the cross-section case (different config paths) is safe but the within-section case above is not."
---

# Phase 1: Config Infrastructure Verification Report

**Phase Goal:** All config writes use merge semantics, eliminating race conditions between UI sections
**Verified:** 2026-03-14T13:10:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Config writes from any settings section merge into existing config rather than replacing the entire file | VERIFIED | All 11 call sites confirmed to call `patchConfig()`. No `config.set` or `writeConfigAndRestart` remain. `patchConfig()` in config-helpers.ts sends `config.patch` with `baseHash` and `raw` (partial JSON string). |
| 2 | Two settings sections modified in quick succession do not clobber each other's changes | PARTIAL | Write step is safe (merge semantics). However `addCustomModel`, `updateCustomModel`, `replaceProviderModels` read from `readConfigFile()` (disk) not `gateway.request("config.get")` (live). Two concurrent custom-model writes read the same stale disk state and one silently overwrites the other. Different-section writes (e.g. Models vs Channels) are safe. |
| 3 | Gateway auto-restarts after config changes without hardcoded sleep delays | VERIFIED | `writeConfigAndRestart()` removed (no matches). `waitForReconnect()` implemented with polling loop, no `setTimeout` delays in the write path. `restartGateway()` helper removed from IMChannelsSection. |

**Score:** 2/3 truths verified (Truth 2 is partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/api/config-helpers.ts` | patchConfig() and waitForReconnect() utility functions | VERIFIED | 69 lines. Exports `patchConfig` (calls config.get for hash, then config.patch) and `waitForReconnect` (polls `gateway.connected`, warns on timeout). Both functions have JSDoc. |
| `src/stores/settings-store.ts` | Settings actions migrated to config.patch | VERIFIED | 8 patchConfig() calls present: addCustomModel (489), updateCustomModel (520), removeCustomModel (583), replaceProviderModels (617), setProviderAuth (671), removeProvider (710), addQuickProvider (726), removeQuickProvider (774). |
| `src/stores/chat-store.ts` | Agent model action migrated to config.patch | VERIFIED | 1 patchConfig() call at line 610 in setAgentModel. |
| `src/components/settings/IMChannelsSection.tsx` | Telegram config actions migrated to config.patch | VERIFIED | 2 patchConfig() calls: saveTelegramConfig (160), disableTelegram (179). No restartGateway helper. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/api/config-helpers.ts` | `src/api/gateway-client.ts` | `import { gateway }` | WIRED | Line 1: `import { gateway } from "./gateway-client";`. gateway.request() called at lines 23 and 26-34. |
| `src/stores/settings-store.ts` | `src/api/config-helpers.ts` | `import { patchConfig, waitForReconnect }` | WIRED | Line 4 import confirmed. patchConfig called 8 times, waitForReconnect called 8 times. |
| `src/stores/chat-store.ts` | `src/api/config-helpers.ts` | `import { patchConfig, waitForReconnect }` | WIRED | Line 4 import confirmed. patchConfig called at 610, waitForReconnect called at 613. |
| `src/components/settings/IMChannelsSection.tsx` | `src/api/config-helpers.ts` | `import { patchConfig, waitForReconnect }` | WIRED | Line 14 import confirmed. Both functions called in saveTelegramConfig and disableTelegram. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| INFR-01 | 01-01-PLAN.md | Config writes use `config.patch` (merge semantics) instead of full replace to prevent race conditions | PARTIAL | Write step uses merge semantics across all 11 call sites. But three methods (`addCustomModel`, `updateCustomModel`, `replaceProviderModels`) still read from `readConfigFile()` before writing, creating a residual race window in the read step for concurrent custom-model operations. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/stores/settings-store.ts` | 474 | `readConfigFile()` used as pre-read in `addCustomModel` write path | Warning | Reads disk file instead of live gateway state; stale if gateway is mid-restart after prior patch |
| `src/stores/settings-store.ts` | 499 | `readConfigFile()` used as pre-read in `updateCustomModel` write path | Warning | Same as above |
| `src/stores/settings-store.ts` | 593 | `readConfigFile()` used as pre-read in `replaceProviderModels` write path | Warning | Same as above |

Note: the `readConfigFile()` function at line 360 is kept and legitimately used as a fallback read path inside `loadConfig()` (line 455) when the gateway is not ready. That usage is appropriate. The issue is its use in write-path pre-reads at lines 474, 499, 593.

### Human Verification Required

#### 1. Cross-section race test

**Test:** Open Models & API section. Save an API key for a provider. Immediately switch to the Channels section and save a Telegram bot token — both actions within the 2-second gateway restart window.
**Expected:** Both the provider API key and the telegram config coexist in openclaw.json after both restarts complete.
**Why human:** Requires live timing against an actual running gateway.

#### 2. Custom model concurrent add test

**Test:** Add two custom model providers back-to-back without waiting for the "reconnected" confirmation between them.
**Expected:** Both custom providers appear in openclaw.json.
**Why human:** The residual readConfigFile() race window requires real gateway interaction to observe.

### Dead Code Removal Verified

| Item | Status |
|------|--------|
| `writeConfigAndRestart()` function | REMOVED — zero matches in codebase |
| `restartGateway()` local helper (IMChannelsSection) | REMOVED — zero matches in codebase |
| `splitProviders()` function | REMOVED — zero matches in codebase |
| `config.set` usage in migrated files | REMOVED — zero matches in src/ |
| TypeScript compilation | CLEAN — `npx tsc --noEmit` produces zero errors |

### Gaps Summary

The phase achieved its primary objective: all 11 write call sites use `patchConfig()` and merge semantics, dead code was removed cleanly, and TypeScript compiles without errors.

One gap remains: three write-path methods (`addCustomModel`, `updateCustomModel`, `replaceProviderModels`) still use `readConfigFile()` (Tauri IPC disk read) as their pre-read step rather than `gateway.request("config.get")`. These methods need to read the live gateway state so their patch payload is based on current config, not a potentially stale disk snapshot. The PLAN specified using `gateway.request("config.get")` for pre-reads in removal operations; the same pattern should apply to add/update operations.

The fix is straightforward: replace the `readConfigFile()` call in each of the three methods with `await gateway.request("config.get", {})` and use `result.config` as the config source (matching the pattern already used in `removeCustomModel`, `removeProvider`, and `removeQuickProvider`).

---

_Verified: 2026-03-14T13:10:00Z_
_Verifier: Claude (gsd-verifier)_
