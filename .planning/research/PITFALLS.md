# Pitfalls Research

**Domain:** Multi-bot Telegram support with 1:1 agent binding in a Tauri v2 desktop app wrapping OpenClaw
**Researched:** 2026-03-15
**Confidence:** HIGH (based on OpenClaw source code, config types, and existing MaxAuto codebase)

## Critical Pitfalls

### Pitfall 1: Config Migration Destroys Single-Bot Setup on Upgrade

**What goes wrong:**
The current config stores Telegram settings as flat fields directly on `channels.telegram` (e.g., `channels.telegram.botToken`, `channels.telegram.dmPolicy`). OpenClaw's multi-account model uses `channels.telegram.accounts.<id>` for per-account config. If the migration from single-bot to multi-bot is not handled atomically, the user's working single-bot setup breaks: either the flat fields remain (ignored by multi-account code) or the migration runs partially, leaving the config in an inconsistent state where neither single nor multi-account paths work.

**Why it happens:**
OpenClaw's `TelegramConfig` type is a union: `{ accounts?: Record<string, TelegramAccountConfig> } & TelegramAccountConfig`. Flat fields (botToken, dmPolicy, etc.) are inherited by accounts as defaults, but `mergeTelegramAccountConfig()` in `openclaw/src/telegram/accounts.ts` has special logic: in multi-account setups, channel-level `groups` are NOT inherited by named accounts (to prevent one bot from claiming another bot's groups -- see OpenClaw issue #30673). A naive migration that copies flat fields into `accounts.default` without understanding this inheritance breaks group config.

**How to avoid:**
1. Build a migration function that runs exactly once on first multi-bot save: read current flat config, create `accounts.default` with only the fields that differ from inheritance defaults (botToken, name), and preserve flat fields as fallback defaults.
2. Migration must be atomic: read config, compute new shape, write as single `config.patch` call. Never write partial migrations.
3. Do NOT migrate eagerly on app update. Migrate lazily when the user first adds a second bot, so single-bot users never hit migration code.
4. Add a `__migrated_multi_bot` marker or version field to track whether migration has run. Check this before every multi-bot operation.

**Warning signs:**
- After adding a second bot, the first bot stops receiving messages or loses its group config.
- `openclaw doctor` warns about missing default account after migration.
- Single-bot users who never add a second bot start seeing "accounts.default" in their config unexpectedly.

**Phase to address:**
Phase 1 (Config Layer) -- must be the first thing built. All subsequent multi-bot features depend on correct config shape.

---

### Pitfall 2: Binding Array Corruption When Adding/Removing Bots

**What goes wrong:**
The current code manages bindings by filtering `allBindings` to remove the Telegram entry and appending a new one: `otherBindings.filter(b => b.match?.channel !== 'telegram')` then push the new binding. With multi-bot, this "filter all telegram + append one" pattern destroys bindings for other bots. If bot A is bound to agent-1 and the user edits bot B's binding, the filter removes bot A's binding too.

**Why it happens:**
The existing `IMChannelsSection.saveTelegramConfig()` uses `channel === "telegram"` as the filter predicate, which matches ALL telegram bindings regardless of accountId. OpenClaw bindings support `match.accountId` to distinguish per-account bindings, but the current code does not use this field.

**How to avoid:**
1. Filter bindings by BOTH `match.channel === "telegram"` AND `match.accountId === currentAccountId` when updating a specific bot's binding.
2. When adding a new bot binding, check that no other binding already claims the target agent (1:1 enforcement).
3. When removing a bot, remove only that bot's binding entry, not all Telegram bindings.
4. Write the bindings array as a single atomic `config.patch` -- never read-modify-write with stale data.

**Warning signs:**
- After editing bot B's settings, bot A stops routing to its agent.
- `bindings` array in config has fewer entries than expected after a save.
- Two bots end up with the same agent binding (violates 1:1).

**Phase to address:**
Phase 1 (Config Layer) -- binding management is the foundation of 1:1 enforcement.

---

### Pitfall 3: 1:1 Enforcement Only in UI Leaves Config Backdoor

**What goes wrong:**
If 1:1 binding (one bot per agent, one agent per bot) is enforced only in the UI's dropdown/select logic (e.g., filtering out already-bound agents), users can bypass it by: (a) editing `openclaw.json` directly, (b) using OpenClaw's CLI, or (c) a config.patch from another client. The UI then shows an inconsistent state, and two bots send messages to the same agent, causing interleaved conversations.

**Why it happens:**
OpenClaw itself does not enforce 1:1 channel-agent bindings. The binding system is N:1 by design (multiple channels can route to one agent). MaxAuto's 1:1 constraint is a UI/product-level decision, not an upstream constraint.

**How to avoid:**
1. Enforce 1:1 in the UI (disable already-bound agents in dropdowns) AND validate on every config load.
2. On config load, detect violations: scan all telegram bindings and flag any agent bound to multiple bots or any bot bound to multiple agents. Show a warning banner with a "Fix" button.
3. Do NOT silently auto-fix violations. The user may have intentionally configured this via CLI. Show the conflict and let the user resolve it.
4. Accept that 1:1 is a MaxAuto UI constraint, not an invariant. Design the data layer to tolerate violations gracefully.

**Warning signs:**
- Two Telegram bot cards show the same agent name.
- After manual config edit, the UI crashes or shows duplicate entries.
- Agent receives messages from two different bots in the same session.

**Phase to address:**
Phase 2 (UI) -- validation runs on config load, enforcement in UI controls.

---

### Pitfall 4: Multi-Account Token Storage Leaks Between Accounts

**What goes wrong:**
The current `pairing.rs` uses a single `telegram-pairing.json` and `telegram-allowFrom.json` file for all pairing state. The `allow_from_file_path()` function already accepts an optional `account_id` parameter (producing `telegram-{id}-allowFrom.json`), but `approve_pairing_request()` always calls it with `None`, writing to the shared file. With multiple bots, pairing approvals for bot A leak into bot B's allow list, granting unintended access.

**Why it happens:**
The pairing backend was built for single-bot. The `account_id` parameter exists in the file path function but is never wired through the approve/reject flow. OpenClaw itself separates pairing stores per account, but MaxAuto's Rust wrapper does not propagate account context.

**How to avoid:**
1. Thread `account_id` through all pairing commands: `list_pairing_requests(account_id)`, `approve_pairing_request(code, account_id)`, `reject_pairing_request(code, account_id)`.
2. Each bot gets its own pairing file: `telegram-{accountId}-pairing.json` and `telegram-{accountId}-allowFrom.json`.
3. Migration: if upgrading from single-bot, rename existing files to `telegram-default-*` pattern on first multi-bot activation.
4. The UI must pass the current bot's account ID when calling pairing commands, not rely on a global default.

**Warning signs:**
- Approving a pairing request on bot A also allows that user on bot B.
- After adding a second bot, the pairing list shows requests from both bots mixed together with no way to tell which is which.

**Phase to address:**
Phase 1 (Config Layer) -- pairing backend must be account-aware before UI can manage per-bot pairing.

---

### Pitfall 5: Gateway Restart Kills ALL Bots When Saving ONE Bot's Config

**What goes wrong:**
Config changes trigger a full gateway restart via `config.patch` + `waitForReconnect()`. With multiple bots running, saving settings for bot B takes bot A offline for 6+ seconds. If the user is actively chatting through bot A, the conversation is interrupted. Repeated saves during setup (common when configuring access control iteratively) cause repeated outages for all bots.

**Why it happens:**
OpenClaw's gateway process manages all Telegram accounts in a single process. There is no hot-reload for individual channel accounts. The existing `config.apply` with `restartDelayMs` controls the delay but still restarts everything.

**How to avoid:**
1. Batch config changes: collect all edits in the UI and write them as a single `config.patch` call on explicit "Save All" rather than save-per-field.
2. Show a warning before saving: "Saving will restart the gateway. All connected bots will briefly go offline."
3. Use `config.patch` with `restartDelayMs: 2000` (the coalescing feature) so rapid saves within 2 seconds merge into a single restart.
4. After restart, poll `channels.status` for ALL configured bots and show per-bot reconnection status so the user knows when each bot is back online.

**Warning signs:**
- User adds a second bot, saves, and the first bot's "Connected" status flickers to "Disconnected" then back.
- Chat messages sent during the restart window are lost (Telegram long-polling gap).

**Phase to address:**
Phase 2 (UI) -- the save flow must account for multi-bot restart impact.

---

### Pitfall 6: Account ID Normalization Mismatch Between MaxAuto and OpenClaw

**What goes wrong:**
OpenClaw normalizes account IDs via `normalizeAccountId()` (lowercased, trimmed). If MaxAuto generates account IDs with different casing or format (e.g., using the bot username as the ID), the binding `match.accountId` will not match OpenClaw's internal account resolution. The bot will start but routing fails silently -- messages arrive but no agent handles them because the binding lookup finds no match.

**Why it happens:**
MaxAuto has no visibility into OpenClaw's normalization rules. The `DEFAULT_ACCOUNT_ID` is "default" (lowercase). If MaxAuto creates an account with ID "Default" or "my-bot", it might work for config but fail for binding resolution.

**How to avoid:**
1. Always use lowercase, alphanumeric-plus-hyphen account IDs. Never use the bot username or token as the account ID.
2. Use "default" as the ID for the first/migrated bot. Use descriptive names like "support-bot", "alerts-bot" for additional bots.
3. When writing bindings, use the exact same account ID string that appears as the key in `channels.telegram.accounts`.
4. On config load, validate that every binding's `match.accountId` corresponds to an existing account in `channels.telegram.accounts`.

**Warning signs:**
- Bot shows as "Connected" in channel status but never routes messages to the bound agent.
- `openclaw doctor` warns about unmatched bindings.
- Adding a second bot causes the first bot to stop routing (the default fallback shifts).

**Phase to address:**
Phase 1 (Config Layer) -- account ID generation must follow OpenClaw's normalization rules from day one.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store all bot tokens in flat config (no tokenFile/keyring) | Simple implementation, matches current single-bot approach | Tokens in plaintext JSON readable by any process; grows worse with multiple tokens | MVP only -- move to tokenFile or keyring before v1.2 |
| Use "default" as account ID for migrated single-bot | Zero-migration path, backward compatible | If user later wants meaningful names, renaming "default" requires config migration | Always acceptable -- "default" is OpenClaw's canonical first-account ID |
| Filter already-bound agents in dropdown only (no server validation) | Fast UI-only enforcement of 1:1 | CLI/manual edits bypass the constraint; UI shows stale state after external changes | MVP -- add config-load validation in the same phase |
| Single gateway restart for all config changes | Matches current behavior, no new complexity | Multi-bot users lose all connections on every save | Acceptable for v1.1 -- optimize in v1.2 with change-specific restart hints |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenClaw `channels.telegram.accounts` | Putting `botToken` at both account level AND channel level, causing token confusion | Put token only inside `accounts.<id>.botToken`. Channel-level `botToken` is for single-account backward compat only |
| OpenClaw bindings array | Using `match: { channel: "telegram" }` without `accountId`, which matches ALL telegram accounts | Always include `match: { channel: "telegram", accountId: "<id>" }` for multi-account bindings |
| OpenClaw `channels.status` | Expecting `channels.telegram` to return per-account status | Use `channelAccounts.telegram` (returns Record or array of per-account snapshots). The `channels.telegram` path returns aggregate status only |
| Telegram Bot API `getMe` | Validating token via frontend `fetch()` which exposes the token to browser context | Validate via Tauri IPC command (Rust-side HTTP call) or via gateway's `channels.status` probe. Current frontend fetch is a security concern with multiple tokens |
| OpenClaw group config inheritance | Assuming channel-level `groups` config applies to all accounts | In multi-account mode, channel-level `groups` is NOT inherited (OpenClaw issue #30673). Each account must define its own `groups` if needed |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all bot statuses sequentially on page mount | Channels page takes N * probe_time seconds to load for N bots | Load config-only status first (fast), then probe in parallel on explicit refresh | 3+ bots with slow network (>10s page load) |
| Re-rendering entire bot list on single bot status change | UI flickers, dropdown selections reset, input fields lose focus | Use per-bot component state isolation; memoize bot cards; use Zustand selectors per account ID | 3+ bots with 10-second status polling |
| Full config reload after every bot save | Each save triggers config.get + full re-parse + full UI re-render for all bots | After config.patch, update only the changed bot's local state; do full reload only on mount or explicit refresh | 5+ bots with frequent config tweaks |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Displaying all bot tokens in a shared settings page | One bot's token visible while editing another; shoulder-surfing or screenshot captures multiple tokens | Show tokens only in per-bot detail view, always masked, with explicit "reveal" toggle that auto-hides after 30 seconds |
| Frontend-side token validation via `fetch('https://api.telegram.org/bot<TOKEN>/getMe')` | Token passes through browser/renderer context; potentially logged in devtools network tab | Move token validation to Rust backend via Tauri IPC command; token never touches frontend JavaScript |
| Using bot token as account ID or in file paths | Token appears in config keys, file names, and log messages | Generate opaque account IDs (slug from bot username or sequential: "bot-1", "bot-2"); never derive IDs from secrets |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing all bots in a flat list with identical card layouts | Users cannot quickly identify which bot is which, especially during setup when names are not yet configured | Show bot username (@bot_name) prominently from getMe validation; use distinct colors or icons per bot; show "New" badge for unconfigured bots |
| Agent binding dropdown shows all agents including already-bound ones | User accidentally binds two bots to the same agent, breaking 1:1; confusing error after save | Disable already-bound agents in dropdown with "(bound to @other_bot)" label; show current binding prominently at top of bot card |
| Requiring full form completion before first save | User must fill token + agent + DM policy + group policy before anything works; high abandonment during setup | Allow saving with just token + agent (minimum viable config); default dmPolicy to "pairing" and groupPolicy to "disabled"; show "optional" labels on advanced fields |
| No confirmation when removing a bot | Accidental deletion loses bot token (if not saved elsewhere), pairing approvals, and access control config | Show confirmation dialog listing what will be lost: "Remove @bot_name? This will disconnect the bot and remove its access control settings." |
| Hiding connection errors behind a generic "Disconnected" status | User cannot diagnose why a bot is not working; calls it "broken" | Show last error message inline (from `channelStatus.lastError`); link to common fixes (token revoked, network issue, privacy mode) |

## "Looks Done But Isn't" Checklist

- [ ] **Multi-bot config save:** Often missing atomic binding update -- verify that saving bot B's config does not remove bot A's binding from the bindings array
- [ ] **1:1 enforcement:** Often missing reverse check -- verify that the UI prevents binding agent X to bot B when agent X is already bound to bot A (not just preventing bot B from selecting an already-used agent)
- [ ] **Config migration:** Often missing rollback path -- verify that if migration fails mid-write, the original single-bot config is preserved (not corrupted)
- [ ] **Per-bot status:** Often missing account-scoped status -- verify that `channels.status` response is parsed per-account (via `channelAccounts.telegram`), not as single aggregate (`channels.telegram`)
- [ ] **Bot removal:** Often missing binding cleanup -- verify that removing a bot also removes its entry from the `bindings[]` array, not just from `channels.telegram.accounts`
- [ ] **Pairing per-bot:** Often missing account context -- verify that pairing approvals write to the correct per-account allowFrom file, not the shared default file
- [ ] **Token validation:** Often missing for second+ bot -- verify that adding a second bot validates the token via getMe before saving, same as the first bot
- [ ] **Default account fallback:** Often missing explicit `defaultAccount` -- verify that after adding a second bot, `channels.telegram.defaultAccount` is set (OpenClaw warns if missing)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Config migration corrupts single-bot setup | LOW | OpenClaw keeps config backups; restore from `~/.openclaw-maxauto/config/openclaw.json.bak` or re-enter bot token manually |
| Binding array corruption (lost bindings) | LOW | Re-select agent for each bot in the UI; bindings are regenerated on save |
| 1:1 violation (two bots sharing agent) | LOW | Unbind one bot in UI, select a different agent; no data loss, just routing confusion |
| Pairing leak across accounts | MEDIUM | Audit allowFrom files per account; remove unauthorized user IDs manually from `~/.openclaw-maxauto/credentials/telegram-{id}-allowFrom.json` |
| Token stored in plaintext config | MEDIUM | Revoke compromised token via @BotFather `/revoke`; generate new token; update config; all sessions continue with new token |
| Account ID normalization mismatch | HIGH | Must edit `openclaw.json` manually to fix account IDs and bindings; no UI repair path if IDs are wrong |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Config migration (Pitfall 1) | Phase 1 - Config Layer | Add second bot to single-bot setup; verify first bot still works; check config shape matches `accounts.<id>` pattern |
| Binding corruption (Pitfall 2) | Phase 1 - Config Layer | Edit bot B's agent binding; verify bot A's binding unchanged in config file |
| 1:1 backdoor (Pitfall 3) | Phase 2 - UI | Manually edit config to create 1:1 violation; reload UI; verify warning banner appears |
| Pairing leak (Pitfall 4) | Phase 1 - Config Layer | Approve pairing on bot A; check that bot B's allowFrom file is unmodified |
| Restart kills all bots (Pitfall 5) | Phase 2 - UI | Save bot B config while bot A is connected; measure bot A's downtime; verify reconnection status shown |
| Account ID mismatch (Pitfall 6) | Phase 1 - Config Layer | Create account with mixed-case ID; verify binding resolution works; check `openclaw doctor` output |

## Sources

- OpenClaw Telegram config types: `openclaw/src/config/types.telegram.ts` -- defines `TelegramConfig` union type with `accounts` and flat fields (HIGH confidence -- source code)
- OpenClaw account resolution: `openclaw/src/telegram/accounts.ts` -- `mergeTelegramAccountConfig()` inheritance rules, multi-account group config non-inheritance (HIGH confidence -- source code, references issue #30673)
- OpenClaw channel routing: `openclaw/docs/channels/channel-routing.md` -- binding resolution order, accountId matching (HIGH confidence -- official docs)
- OpenClaw Telegram docs: `openclaw/docs/channels/telegram.md` -- multi-account precedence rules, defaultAccount requirement (HIGH confidence -- official docs)
- MaxAuto existing Telegram UI: `src/components/settings/IMChannelsSection.tsx` -- current single-bot binding logic using channel-level filter (HIGH confidence -- project source)
- MaxAuto pairing backend: `src-tauri/src/commands/pairing.rs` -- `allow_from_file_path(account_id)` already accepts account parameter but unused (HIGH confidence -- project source)
- MaxAuto known concerns: `.planning/codebase/CONCERNS.md` -- config write races, restart timing (HIGH confidence -- project audit)

---
*Pitfalls research for: Multi-bot Telegram with 1:1 binding in MaxAuto*
*Researched: 2026-03-15*
