---
phase: 01-config-infrastructure
verified: 2026-03-14T13:20:00Z
status: human_needed
score: 3/3 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 2/3
  gaps_closed:
    - "addCustomModel, updateCustomModel, and replaceProviderModels now read live gateway state via gateway.request('config.get') instead of readConfigFile()"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open Models & API section. Save an API key for a provider. Immediately switch to the Channels section and save a Telegram bot token — both actions within the 2-second gateway restart window."
    expected: "Both the provider API key and the telegram config coexist in openclaw.json after both restarts complete."
    why_human: "Requires live timing against an actual running gateway."
  - test: "Add two custom model providers back-to-back without waiting for the 'reconnected' confirmation between them."
    expected: "Both custom providers appear in openclaw.json with neither overwriting the other."
    why_human: "Requires real gateway interaction to observe the concurrent-write scenario end-to-end."
---

# Phase 1: Config Infrastructure Verification Report

**Phase Goal:** All config writes use merge semantics, eliminating race conditions between UI sections
**Verified:** 2026-03-14T13:20:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plan 01-02)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Config writes from any settings section merge into existing config rather than replacing the entire file | VERIFIED | All 11 call sites confirmed to call `patchConfig()`. No `config.set` or `writeConfigAndRestart` present. `patchConfig()` sends `config.patch` with `baseHash` + `raw` partial JSON string. |
| 2 | Two settings sections modified in quick succession do not clobber each other's changes | VERIFIED (automated) | All six write-path methods now use `gateway.request("config.get", {})` for pre-reads. Confirmed: `addCustomModel` (line 474-477), `updateCustomModel` (line 501-505), `replaceProviderModels` (line 598-602), `removeCustomModel` (line 537-540), `removeProvider` (line 694), `removeQuickProvider` (line 754). `readConfigFile()` only appears at its definition (line 360) and in the `loadConfig()` gateway-not-ready fallback (line 455). |
| 3 | Gateway auto-restarts after config changes without hardcoded sleep delays | VERIFIED | `writeConfigAndRestart()` removed (zero matches). `waitForReconnect()` uses polling loop with no `setTimeout` in the write path. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/api/config-helpers.ts` | `patchConfig()` and `waitForReconnect()` utility functions | VERIFIED | Exports both functions. `patchConfig` calls `config.get` for hash then `config.patch`. `waitForReconnect` polls `gateway.connected`. |
| `src/stores/settings-store.ts` | All write-path methods use `gateway.request("config.get")` for pre-reads | VERIFIED | `"config.get"` call sites at lines 433, 477, 505, 540, 602, 694, 754. Zero `readConfigFile()` calls in any write path. |
| `src/stores/chat-store.ts` | `setAgentModel` migrated to `config.patch` | VERIFIED | 1 `patchConfig()` call confirmed from initial verification. |
| `src/components/settings/IMChannelsSection.tsx` | Telegram config actions migrated to `config.patch` | VERIFIED | 2 `patchConfig()` calls: `saveTelegramConfig`, `disableTelegram`. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `src/stores/settings-store.ts` | `src/api/gateway-client.ts` | `import { gateway }` | WIRED | Line 2: `import { gateway } from "../api/gateway-client";`. `gateway.request("config.get", {})` called at 7 sites. |
| `src/stores/settings-store.ts` | `src/api/config-helpers.ts` | `import { patchConfig, waitForReconnect }` | WIRED | Confirmed from initial verification — `patchConfig` called 8 times, `waitForReconnect` called 8 times. |
| `src/api/config-helpers.ts` | `src/api/gateway-client.ts` | `import { gateway }` | WIRED | Confirmed from initial verification. `gateway.request()` called for `config.get` and `config.patch`. |
| `src/components/settings/IMChannelsSection.tsx` | `src/api/config-helpers.ts` | `import { patchConfig, waitForReconnect }` | WIRED | Confirmed from initial verification. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| INFR-01 | 01-01-PLAN.md, 01-02-PLAN.md | Config writes use `config.patch` (merge semantics) instead of full replace to prevent race conditions | SATISFIED | All 11 write call sites use `patchConfig()`. All 6 pre-read call sites use `gateway.request("config.get")`. TypeScript compiles clean (`npx tsc --noEmit` zero errors). Commit `c06fb46cd` applied the final fix. REQUIREMENTS.md marks INFR-01 as `[x]` complete at line 34. |

No orphaned requirements — REQUIREMENTS.md maps only INFR-01 to Phase 1, and both plan files declare it.

### Anti-Patterns Found

None. The three previously flagged `readConfigFile()` calls in write paths are gone. The remaining two occurrences are appropriate:

- Line 360: function definition (kept for `loadConfig()` fallback use)
- Line 455: inside `loadConfig()` when gateway is not yet ready — correct fallback path

### Dead Code Removal Verified

| Item | Status |
| --- | --- |
| `writeConfigAndRestart()` function | REMOVED |
| `restartGateway()` local helper (IMChannelsSection) | REMOVED |
| `splitProviders()` function | REMOVED |
| `config.set` usage in migrated files | REMOVED |
| `readConfigFile()` in any write path | REMOVED — only at definition (line 360) + `loadConfig()` fallback (line 455) |
| TypeScript compilation | CLEAN — `npx tsc --noEmit` produces zero errors |

### Human Verification Required

#### 1. Cross-section race test

**Test:** Open Models & API section. Save an API key for a provider. Immediately switch to the Channels section and save a Telegram bot token — both actions within the 2-second gateway restart window.
**Expected:** Both the provider API key and the telegram config coexist in openclaw.json after both restarts complete.
**Why human:** Requires live timing against an actual running gateway.

#### 2. Custom model concurrent add test

**Test:** Add two custom model providers back-to-back without waiting for the "reconnected" confirmation between them.
**Expected:** Both custom providers appear in openclaw.json with neither overwriting the other.
**Why human:** Requires real gateway interaction to observe the concurrent-write scenario end-to-end. The code path is now correct but the timing behavior can only be confirmed against a live gateway.

### Re-Verification Summary

The gap identified in the initial verification is closed. Commit `c06fb46cd` (2026-03-14) replaced the three `readConfigFile()` pre-reads in write-path methods with `gateway.request("config.get", {})`:

- `addCustomModel` (line 474): now reads live config
- `updateCustomModel` (line 501): now reads live config
- `replaceProviderModels` (line 598): now reads live config

All automated checks pass: zero `readConfigFile()` calls in any write path, 7 `"config.get"` call sites confirmed, `gateway` imported at line 2, TypeScript clean. The two human verification items were already present in the initial report and remain pending — they require a running gateway to observe timing behavior. No regressions were found.

---

_Verified: 2026-03-14T13:20:00Z_
_Verifier: Claude (gsd-verifier)_
