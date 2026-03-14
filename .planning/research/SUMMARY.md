# Project Research Summary

**Project:** MaxAuto v1.1 — Multi-Bot Telegram Support
**Domain:** Multi-account Telegram bot management with 1:1 agent binding in a Tauri desktop app
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

MaxAuto v1.1 adds multi-bot Telegram support to an existing desktop wrapper for OpenClaw. The critical research finding is that **OpenClaw already fully supports multi-account Telegram** via its `channels.telegram.accounts` config structure — the entire feature is a frontend-only refactor of `IMChannelsSection.tsx`. No new stack additions, no new Rust commands, and no new dependencies are required. The effort is a UI restructure from a single flat-form to a list/detail card pattern that maps directly onto OpenClaw's native data model.

The recommended approach is to build in two phases: first the config layer (data model migration, account-scoped bindings, account-scoped pairing), then the UI layer (card list, add/remove flows, 1:1 enforcement UX, save flow improvements). This order is mandatory — the config layer correctness is the foundation for every UI feature. Getting the binding array update logic wrong will silently corrupt routing for all bots, so atomic patch semantics must be established in Phase 1 before any UI work begins.

The key risks concentrate around three areas: (1) atomic config migration from single-bot flat config to multi-account structure — must happen lazily and atomically; (2) binding array corruption when saving one bot's settings while multiple bots exist — the existing channel-level filter pattern destroys other bots' bindings; (3) pairing backend is not account-scoped — approvals from one bot leak into another bot's allow list without wiring `account_id` through the Rust commands. All three are well-understood and preventable with targeted fixes in Phase 1.

## Key Findings

### Recommended Stack

No changes to the existing stack are needed. OpenClaw's gateway protocol, config system, and Telegram multi-account infrastructure are already in place and verified from source code. The work is entirely in the React frontend layer.

**Core technologies (unchanged):**
- React 19 + TypeScript + Tailwind CSS 3.4 — frontend UI layer, no additions needed
- Zustand 5 — existing stores are sufficient; no new store required (page-local state only)
- Tauri v2 (Rust) — existing commands handle all config I/O via raw JSON pass-through
- OpenClaw gateway WebSocket — `config.patch`, `channels.status`, `agents.list` are the only gateway methods needed

**Libraries explicitly NOT needed:** Telegram SDK (token validation uses direct `fetch` to `getMe`), form libraries, state machines, UUID generation (account IDs are user-chosen slugs).

See `.planning/research/STACK.md` for full details.

### Expected Features

**Must have (table stakes — v1.1):**
- Multi-bot data model + migration from single-bot flat config — foundation for everything
- Add bot flow (token input, validate via getMe, assign accountId, set name) — core CRUD
- Remove bot with binding cleanup — core CRUD
- Per-bot agent binding with strict 1:1 enforcement — the milestone's defining feature
- Per-bot connection status display — users must see what's working
- Per-bot enable/disable toggle — non-destructive control
- Per-bot DM policy and allowlists — access control is safety-critical
- Config migration from single-bot to multi-bot structure — backward compatibility

**Should have (post-validation, v1.1.x):**
- Visual bot-agent binding map — when users have 3+ bots, list view gets crowded
- Add Bot wizard (guided modal) — when onboarding feedback shows friction
- Duplicate token detection — prevent two account IDs pointing to the same Telegram bot
- Bot health dashboard summary bar — aggregate view above bot list

**Defer (v2+):**
- Bulk bot import — power-user only
- Per-bot group configuration UI — complex, deferred until demand is clear
- Telegram webhook mode — requires public URL/SSL; polling is correct for desktop

**Anti-features to avoid:** Many-to-one binding (multiple bots per agent), auto-create agent per bot, per-bot model override UI, cross-channel binding UI.

See `.planning/research/FEATURES.md` for full details.

### Architecture Approach

The architecture is a refactor of one existing component (`IMChannelsSection.tsx`) into a list/detail card pattern. OpenClaw's `TelegramConfig` type is literally `TelegramAccountConfig & { accounts?: Record<string, TelegramAccountConfig>, defaultAccount?: string }`, meaning the existing flat config fields are already valid as channel-level defaults. The UI restructure maps one-to-one onto this native shape.

**Major components:**
1. `IMChannelsSection` (modify) — strip single-bot form, add account list + "Add Bot" button, own multi-account loading
2. `BotAccountCard` (new) — summary card per bot: name, @username, status dot, bound agent badge, expand/collapse
3. `BotAccountEditor` (new) — detail form extracted from current `IMChannelsSection`: token, DM policy, allowlists, agent binding dropdown
4. `AddBotDialog` (new) — modal for token input, getMe validation, accountId generation, initial agent selection
5. `PairingRequestsPanel` (extract) — move inline pairing UI into sub-component scoped to account

**Key patterns to follow:** single `patchConfig` call per operation (account + binding together); bindings always use `match.accountId`; status from `channelAccounts.telegram` (per-account), not `channels.telegram` (aggregate); local React state only (no new Zustand store).

See `.planning/research/ARCHITECTURE.md` for full details including build order.

### Critical Pitfalls

1. **Config migration destroys single-bot setup** — migrate lazily (only when user adds a second bot), atomically (single `config.patch`), and never eagerly on app update. The `groups` field is NOT inherited in multi-account mode (OpenClaw issue #30673), so naive copying corrupts group config.

2. **Binding array corruption when saving one bot** — the existing `filter(b => b.match?.channel !== 'telegram')` pattern removes ALL telegram bindings. Must filter by both `channel === "telegram"` AND `accountId === currentAccountId` to protect other bots' bindings.

3. **Pairing approvals leak across accounts** — `pairing.rs` `approve_pairing_request()` always calls `allow_from_file_path(None)`, writing to the shared file. Must thread `account_id` through all pairing Rust commands before multi-bot UI ships.

4. **1:1 enforcement is UI-only, config can diverge** — OpenClaw supports N:1 bindings natively. Validate on every config load and show a warning banner for violations rather than silently auto-fixing.

5. **Account ID normalization mismatch** — OpenClaw normalizes IDs to lowercase alphanumeric-plus-hyphen. Always generate IDs from bot usernames using this same normalization. ID mismatches cause silent routing failures (bot connects but messages never reach the agent).

See `.planning/research/PITFALLS.md` for full details including recovery strategies and a "looks done but isn't" checklist.

## Implications for Roadmap

Based on research, this feature maps cleanly to two phases with a clear mandatory dependency boundary.

### Phase 1: Config Layer

**Rationale:** All multi-bot UI features depend on correct config semantics. Binding corruption and pairing leaks (both critical pitfalls) are config-layer bugs that must be fixed before any UI ships. Building UI on top of broken binding logic guarantees hard-to-debug routing failures that only appear when the second bot is added.

**Delivers:** A correct, account-scoped config foundation that all UI can build on top of safely. A working multi-account config shape in `openclaw.json`, correct binding array management, account-scoped pairing files, and a migration path from single-bot.

**Addresses:** Multi-bot data model, config migration (single-to-multi), account-scoped bindings, account-scoped pairing backend, account ID normalization utility, atomic config patch helper

**Avoids:** Pitfall 1 (migration), Pitfall 2 (binding corruption), Pitfall 4 (pairing leak), Pitfall 6 (account ID mismatch)

**Specific work items:**
- Binding array logic refactored to use `accountId`-scoped filter/update
- Lazy migration function: detect single-bot config, migrate to `accounts.default` on first multi-bot add, set `defaultAccount`
- Pairing Rust commands (`list_pairing_requests`, `approve_pairing_request`, `reject_pairing_request`) updated to accept and propagate `account_id`
- Account ID normalization utility matching OpenClaw's `normalizeAccountId()` rules
- Atomic `patchConfig` helper that always writes account config + binding array in one call

### Phase 2: UI Layer

**Rationale:** With a correct config layer in place, the UI work is straightforward list/detail refactoring with well-understood React patterns. No research blockers remain after Phase 1.

**Delivers:** The complete multi-bot management interface — add, edit, remove, status, 1:1 enforcement UX, and save flow with restart awareness.

**Uses:** Existing stack unchanged — React, Tailwind, Zustand, lucide-react

**Implements:**
- `BotAccountCard` (display-only) built first to validate data loading pipeline
- `IMChannelsSection` refactored to account list + per-account status map
- `BotAccountEditor` (extracts and parameterizes existing form by accountId)
- `AddBotDialog` (token input, getMe validation, accountId generation from bot username, agent select)
- Remove flow with confirmation dialog listing what will be lost
- 1:1 enforcement: disabled agents in dropdown with "(bound to @other-bot)" tooltip
- Gateway restart warning before save; per-bot reconnection status after restart
- Config-load violation detection: warning banner if external edits created 1:1 violations

**Avoids:** Pitfall 3 (1:1 backdoor via UI-only enforcement), Pitfall 5 (restart impact UX)

### Phase Ordering Rationale

- Phase 1 before Phase 2 is mandatory: binding corruption is silent and only manifests when the second bot is added. UI built on broken binding logic will pass all single-bot tests and fail in production.
- Pairing backend changes require a Rust recompile and Tauri rebuild; doing this in Phase 1 avoids a second build cycle mid-UI work.
- Config migration logic must be tested in isolation before any UI save flows exist, because there is no UI repair path if migration corrupts the config.
- Within Phase 2, `BotAccountCard` (display-only) must be built first to validate that config loading, status mapping, and binding data are all correctly flowing before editing logic is added.

### Research Flags

Phases with well-documented patterns (no additional research needed):
- **Phase 1:** OpenClaw config types are fully verified from source code. Binding semantics, merge-patch deletion, account resolution — all confirmed HIGH confidence. Rust command changes are straightforward parameter threading. No unknowns.
- **Phase 2:** List/detail card pattern is an established React/Tailwind pattern. All gateway API calls are verified from source and the existing codebase. No API uncertainty.

No phases require `/gsd:research-phase` during planning. All required knowledge is captured in the four research files.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified from OpenClaw source + existing MaxAuto codebase. No speculation. No new deps needed. |
| Features | HIGH | Data model verified from OpenClaw types. Feature scope matches OpenClaw's built-in capabilities exactly. |
| Architecture | HIGH | Component boundaries derived directly from OpenClaw source types and existing component structure. |
| Pitfalls | HIGH | All critical pitfalls identified from reading actual source code (pairing.rs, IMChannelsSection.tsx, accounts.ts), not inferred. |

**Overall confidence:** HIGH

### Gaps to Address

- **Token validation security:** Currently `validateBotToken()` uses a frontend `fetch()` to `api.telegram.org`, exposing the token in the renderer context and devtools network tab. Research recommends moving this to a Tauri Rust IPC command. Not a blocker for v1.1, but should be a named task in Phase 2 and tracked for v1.2 hardening.
- **`groups` config in multi-account mode:** OpenClaw deliberately does not inherit channel-level `groups` in multi-account setups (issue #30673). Per-bot groups UI is deferred to v2+. The migration function must preserve any existing channel-level `groups` as the default-account's `groups` and document that they will not be shared to additional bots.
- **`defaultAccount` requirement:** OpenClaw warns if `accounts` exists without `defaultAccount` set. The migration function must set `defaultAccount` to "default" (or whatever ID the migrated single bot receives). This is a one-liner but must not be omitted.

## Sources

### Primary (HIGH confidence — verified from source code)
- `openclaw/src/config/types.telegram.ts` — TelegramConfig, TelegramAccountConfig type definitions
- `openclaw/src/config/types.agents.ts` — AgentRouteBinding, AgentBindingMatch with accountId field
- `openclaw/src/telegram/accounts.ts` — multi-account resolution, mergeTelegramAccountConfig, groups non-inheritance (issue #30673)
- `openclaw/src/routing/bindings.ts` — binding resolution, accountId extraction, default routing
- `openclaw/src/gateway/server-methods/channels.ts` — channels.status per-account snapshot handler
- `src/components/settings/IMChannelsSection.tsx` — existing single-bot implementation to be refactored
- `src-tauri/src/commands/pairing.rs` — allow_from_file_path(account_id) wiring gap identified
- `src/api/config-helpers.ts` — patchConfig merge-patch semantics

### Secondary (HIGH confidence — official docs)
- `openclaw/docs/channels/telegram.md` — multi-account precedence rules, defaultAccount requirement
- `openclaw/docs/channels/channel-routing.md` — binding resolution order, accountId matching
- `docs/gateway-protocol.md` — channels.status, config.patch methods

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
