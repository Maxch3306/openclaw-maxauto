# Phase 10: Multi-Bot Config Foundation - Research

**Researched:** 2026-03-15
**Domain:** Multi-account Telegram config layer (OpenClaw config types, binding system, migration)
**Confidence:** HIGH

## Summary

Phase 10 is a pure config-layer phase: no new UI components, only restructuring how Telegram config is read, written, and bound. The core work is (1) fixing the binding filter bug that would destroy other bots' bindings, (2) writing config to `channels.telegram.accounts.<id>` instead of flat top-level fields, and (3) implementing lazy migration from flat to accounts structure when a second bot is added.

OpenClaw's config and routing system already fully supports multi-account Telegram. The `TelegramConfig` type is `TelegramAccountConfig & { accounts?: Record<string, TelegramAccountConfig>, defaultAccount?: string }`. The routing engine resolves bindings by `match.accountId` with tiered fallback. All the plumbing exists upstream -- MaxAuto just needs to write config in the correct shape and fix the binding filter.

**Primary recommendation:** Fix the binding filter to scope by `accountId`, refactor `IMChannelsSection` config read/write to use the accounts structure, and add a migration function that restructures flat config into `accounts.default` atomically via a single `patchConfig` call.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Lazy migration: only triggers when user adds a second bot
- Show brief notification after migration: "Migrated existing bot to multi-bot config"
- Migration moves flat `channels.telegram.*` fields into `channels.telegram.accounts.default.*`
- Must preserve all existing settings (token, dmPolicy, groupPolicy, allowFrom, groups, etc.)
- Use the bot's @username from getMe validation as the account ID
- Normalized to lowercase (matching OpenClaw's `normalizeAccountId`)
- Existing single-bot becomes account ID "default" during migration
- New bots get their username as ID (e.g. "kimi_tgbot")

### Claude's Discretion
- Exact migration implementation (read full config, restructure, write atomically)
- Error handling for migration failures
- Whether to set `defaultAccount` field when multiple accounts exist
- Notification component/mechanism for migration message

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MBOT-05 | User can bind each bot to a specific agent via per-bot dropdown with match.accountId | Binding system fully supports `match.accountId` (see AgentBindingMatch type). Current bug: filter uses `channel === "telegram"` only, must add `accountId` scoping. |
| MBOT-07 | Existing single-bot config migrates to accounts.default structure when adding second bot | OpenClaw's TelegramConfig type supports both flat and accounts structures simultaneously. Migration reads flat fields, writes into `accounts.default`, clears top-level token in single atomic patchConfig call. |
</phase_requirements>

## Standard Stack

### Core (existing -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI framework | Already in project |
| Zustand | 5 | State management (chat-store for agents list) | Already in project |
| gateway-client | n/a | WebSocket to OpenClaw gateway | Already in project |
| config-helpers | n/a | patchConfig + waitForReconnect | Already in project |

### No New Libraries Needed
This phase is pure refactoring of existing config read/write patterns. No new npm packages required.

## Architecture Patterns

### Pattern 1: Account-Scoped Config Read

**What:** When loading Telegram config, detect whether `channels.telegram.accounts` exists and iterate over accounts instead of reading flat top-level fields.

**When:** Every config load in IMChannelsSection.

**Example:**
```typescript
// Source: OpenClaw types.telegram.ts line 258-263
// TelegramConfig = TelegramAccountConfig & { accounts?, defaultAccount? }

async function loadTelegramConfig() {
  const result = await gateway.request<{ config: Record<string, unknown> }>("config.get", {});
  const cfg = result.config as { channels?: { telegram?: TelegramConfig }; bindings?: BindingEntry[] };
  const tg = cfg.channels?.telegram ?? {};

  // Detect multi-account vs flat
  const accounts = tg.accounts ?? {};
  const hasAccounts = Object.keys(accounts).length > 0;

  if (hasAccounts) {
    // Multi-account: iterate accounts
    for (const [accountId, accountCfg] of Object.entries(accounts)) {
      // Each account has its own botToken, dmPolicy, groups, etc.
    }
  } else if (tg.botToken) {
    // Legacy flat: treat top-level as single implicit "default" account
    // No migration needed until second bot is added
  }

  // Load bindings with accountId awareness
  const bindings = cfg.bindings ?? [];
  // Group telegram bindings by accountId
}
```

### Pattern 2: Account-Scoped Binding Filter (THE BUG FIX)

**What:** When saving one bot's binding, filter existing bindings by BOTH `channel` AND `accountId`, not just `channel`.

**Current buggy code (line 287 of IMChannelsSection.tsx):**
```typescript
// BUG: This removes ALL telegram bindings when saving one bot
const otherBindings = allBindings.filter((b) => b.match?.channel !== "telegram");
```

**Fixed code:**
```typescript
// CORRECT: Only remove THIS bot's telegram binding, preserve others
const otherBindings = allBindings.filter((b) =>
  !(b.match?.channel === "telegram" && b.match?.accountId === currentAccountId)
);
const updatedBindings = boundAgentId
  ? [...otherBindings, { agentId: boundAgentId, match: { channel: "telegram", accountId: currentAccountId } }]
  : otherBindings;
```

**Critical detail:** For legacy single-bot bindings that have `{ match: { channel: "telegram" } }` (no accountId), the filter must also handle the `undefined` accountId case during migration.

### Pattern 3: Atomic Config Migration

**What:** When user adds a second bot, migrate flat config to `accounts.default` in a single `patchConfig` call.

**When:** Only when `channels.telegram.botToken` exists at top level AND user is adding a second bot AND `channels.telegram.accounts` does not yet exist.

```typescript
async function migrateToMultiAccount(
  existingConfig: TelegramConfig,
  existingBindings: BindingEntry[]
): Promise<void> {
  // Extract flat fields that belong in the account
  const { accounts, defaultAccount, ...flatFields } = existingConfig;

  // Build migration patch
  const patch = {
    channels: {
      telegram: {
        // Move flat fields into accounts.default
        accounts: {
          default: {
            botToken: flatFields.botToken,
            dmPolicy: flatFields.dmPolicy,
            groupPolicy: flatFields.groupPolicy,
            allowFrom: flatFields.allowFrom,
            groupAllowFrom: flatFields.groupAllowFrom,
            groups: flatFields.groups,
            enabled: flatFields.enabled,
            // ... all TelegramAccountConfig fields
          }
        },
        defaultAccount: "default",
        // Clear top-level token (set null for merge-patch delete)
        botToken: null,
      }
    },
    // Migrate binding: add accountId to existing telegram binding
    bindings: existingBindings.map(b =>
      b.match?.channel === "telegram" && !b.match?.accountId
        ? { ...b, match: { ...b.match, accountId: "default" } }
        : b
    ),
  };

  await patchConfig(patch);
  await waitForReconnect();
}
```

### Pattern 4: Account ID Normalization

**What:** Apply the same normalization OpenClaw uses for account IDs.

**Source: `openclaw/src/routing/account-id.ts` lines 14-24:**
```typescript
// OpenClaw's canonicalizeAccountId:
// 1. If matches /^[a-z0-9][a-z0-9_-]{0,63}$/i -> lowercase
// 2. Otherwise: lowercase, replace invalid chars with "-", strip leading/trailing dashes, max 64 chars
// 3. Empty/blocked keys -> undefined (falls back to "default")

// For MaxAuto: normalize bot username to account ID
function botUsernameToAccountId(username: string): string {
  // Remove leading @ if present
  const cleaned = username.replace(/^@/, '');
  // Apply same rules as OpenClaw
  return cleaned.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+/, '').replace(/-+$/, '').slice(0, 64) || 'default';
}

// Examples:
// "@My_Helper_Bot" -> "my_helper_bot"
// "@kimi-tgbot" -> "kimi-tgbot"
// "Bot123" -> "bot123"
```

**Key insight:** OpenClaw's `normalizeAccountId("")` returns `"default"`. Empty or undefined account IDs always resolve to "default". This is important for backward compatibility -- existing bindings without accountId route to the "default" account.

### Pattern 5: Merge-Patch Config Writes

**What:** Use `patchConfig()` for all config changes. Setting a key to `null` deletes it via RFC 7396 merge-patch semantics.

**Established pattern from config-helpers.ts.** Always include both `channels.telegram.accounts.<id>` and `bindings` in a single patchConfig call to avoid split-write inconsistency.

### Anti-Patterns to Avoid

- **Separate writes for account and binding:** Two patchConfig calls = two gateway restarts + potential inconsistency. Always combine.
- **Writing botToken at both top-level and account level:** Creates ambiguity. After migration, top-level botToken should be `null` (deleted).
- **Using `match: { channel: "telegram" }` without accountId:** This is a wildcard that matches ALL telegram accounts. Always include `accountId` for multi-bot bindings.
- **Storing migration state in localStorage:** Config file is the single source of truth. Detect migration need by checking config shape (flat vs accounts), not a separate flag.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Account ID normalization | Custom regex | Copy OpenClaw's `canonicalizeAccountId` logic exactly | Must match upstream normalization or bindings won't resolve |
| Config merge semantics | Custom deep-merge | `patchConfig()` (gateway handles RFC 7396 merge-patch) | Gateway validates, writes atomically, handles restart |
| Binding resolution | Custom binding matcher | Write bindings in the shape OpenClaw expects; let gateway route | OpenClaw's tiered resolution is complex (peer > guild > team > account > channel) |
| Multi-account detection | Check a flag | Check `Object.keys(tg.accounts ?? {}).length > 0` | Config shape IS the state; no separate tracking needed |

## Common Pitfalls

### Pitfall 1: Binding Filter Destroys Other Bots' Bindings
**What goes wrong:** Current `allBindings.filter(b => b.match?.channel !== "telegram")` removes ALL telegram bindings when saving one bot.
**Why it happens:** Single-bot code assumed only one telegram binding exists.
**How to avoid:** Filter by both `channel === "telegram"` AND `accountId === currentAccountId`. Test by saving bot B and verifying bot A's binding survives.
**Warning signs:** After saving bot B's config, bot A stops receiving messages.

### Pitfall 2: Migration Leaves Top-Level botToken
**What goes wrong:** After migration to accounts.default, the top-level `channels.telegram.botToken` still exists. OpenClaw's `mergeTelegramAccountConfig` merges top-level into each account as base, so this token becomes a fallback for ALL accounts.
**Why it happens:** Migration copies fields to accounts.default but forgets to null-delete top-level fields.
**How to avoid:** In the migration patchConfig call, explicitly set `botToken: null` at the top level to delete it via merge-patch.
**Warning signs:** Adding a second bot without its own token causes it to inherit the first bot's token.

### Pitfall 3: Groups Config Not Inherited in Multi-Account Mode
**What goes wrong:** After migration, the first bot's groups stop working.
**Why it happens:** OpenClaw's `mergeTelegramAccountConfig` (line 132) explicitly does NOT inherit channel-level `groups` when `configuredAccountIds.length > 1`. This prevents cross-bot group membership conflicts.
**How to avoid:** Migration MUST copy `groups` into `accounts.default` explicitly. It cannot rely on top-level inheritance.
**Warning signs:** Bot in groups stops responding after adding a second bot.

### Pitfall 4: Legacy Binding Without accountId During Migration
**What goes wrong:** Existing binding `{ match: { channel: "telegram" } }` (no accountId) continues to act as a wildcard matching ALL accounts after migration.
**Why it happens:** OpenClaw's routing treats empty/missing accountId bindings as `"default"` for `listBoundAccountIds` but as wildcard `"*"` in some resolution paths.
**How to avoid:** Migration must update the existing binding to include `accountId: "default"`. The new binding for the second bot must include its specific accountId.
**Warning signs:** Both bots route to the same agent after adding a second bot.

### Pitfall 5: Account ID Case Sensitivity Mismatch
**What goes wrong:** MaxAuto generates account ID "MyBot" but OpenClaw normalizes to "mybot". Binding with `accountId: "MyBot"` doesn't match.
**Why it happens:** OpenClaw calls `normalizeAccountId()` which lowercases everything.
**How to avoid:** Always lowercase account IDs before writing to config. Apply the same normalization as OpenClaw.
**Warning signs:** Bot shows as "Connected" but messages don't route to the bound agent.

## Code Examples

### Detecting Config Shape (Flat vs Multi-Account)
```typescript
// Source: OpenClaw types.telegram.ts
// TelegramConfig = TelegramAccountConfig & { accounts?, defaultAccount? }

function isMultiAccountConfig(tg: TelegramConfig): boolean {
  return Object.keys(tg.accounts ?? {}).length > 0;
}

function needsMigration(tg: TelegramConfig): boolean {
  // Has a flat botToken but no accounts structure yet
  return !!tg.botToken && !isMultiAccountConfig(tg);
}
```

### Reading Per-Account Config
```typescript
function getAccountConfigs(tg: TelegramConfig): Map<string, TelegramAccountConfig> {
  const result = new Map<string, TelegramAccountConfig>();
  if (isMultiAccountConfig(tg)) {
    for (const [id, cfg] of Object.entries(tg.accounts!)) {
      result.set(id, cfg);
    }
  } else if (tg.botToken) {
    // Legacy flat: expose as "default" account
    const { accounts, defaultAccount, ...flat } = tg;
    result.set("default", flat as TelegramAccountConfig);
  }
  return result;
}
```

### Scoped Binding Read
```typescript
function getTelegramBindingForAccount(
  bindings: BindingEntry[],
  accountId: string
): BindingEntry | undefined {
  return bindings.find(b =>
    b.match?.channel === "telegram" &&
    (b.match?.accountId === accountId ||
     // Legacy: binding without accountId matches "default"
     (!b.match?.accountId && accountId === "default"))
  );
}
```

### Scoped Binding Write
```typescript
function buildUpdatedBindings(
  allBindings: BindingEntry[],
  accountId: string,
  agentId: string | null
): BindingEntry[] {
  // Remove only THIS account's telegram binding
  const others = allBindings.filter(b =>
    !(b.match?.channel === "telegram" &&
      (b.match?.accountId === accountId ||
       (!b.match?.accountId && accountId === "default")))
  );

  if (!agentId) return others;

  return [
    ...others,
    { agentId, match: { channel: "telegram", accountId } }
  ];
}
```

### Writing Per-Account Config
```typescript
async function saveAccountConfig(
  accountId: string,
  config: Partial<TelegramAccountConfig>,
  agentId: string | null,
  allBindings: BindingEntry[]
): Promise<void> {
  const updatedBindings = buildUpdatedBindings(allBindings, accountId, agentId);

  await patchConfig({
    channels: {
      telegram: {
        accounts: {
          [accountId]: config
        }
      }
    },
    bindings: updatedBindings,
  });

  await waitForReconnect();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat `channels.telegram.botToken` | `channels.telegram.accounts.<id>.botToken` | OpenClaw multi-account support (existing) | Must migrate existing configs |
| `match: { channel: "telegram" }` (wildcard) | `match: { channel: "telegram", accountId: "<id>" }` | OpenClaw binding system (existing) | Must add accountId to all telegram bindings |
| Single `channelStatus.telegram` | `channelAccounts.telegram` (per-account snapshots) | OpenClaw channels.status response (existing) | Already handled in current code but only reads first entry |

## Open Questions

1. **Should `defaultAccount` be set during migration?**
   - What we know: OpenClaw warns if `defaultAccount` is missing when multiple accounts exist. The warning says to set it explicitly.
   - What's unclear: Whether the warning is just noise or causes actual issues.
   - Recommendation: Set `defaultAccount: "default"` during migration. Low cost, prevents warning. User decision says "Claude's discretion."

2. **Should top-level shared defaults be preserved after migration?**
   - What we know: `mergeTelegramAccountConfig` merges top-level (minus accounts/defaultAccount/groups) into each account as base. Shared dmPolicy at top level could serve as a default for new accounts.
   - What's unclear: Whether users expect shared defaults or per-account isolation.
   - Recommendation: Keep it simple -- copy all flat fields into `accounts.default` and null-delete the top-level `botToken`. Leave other top-level fields (dmPolicy, groupPolicy) as-is since they serve as defaults for future accounts.

3. **Pairing backend account scoping**
   - What we know: `pairing.rs` line 17 has `allow_from_file_path(account_id: Option<&str>)` but line 140 always calls with `None`.
   - What's unclear: Whether to fix this in Phase 10 (config foundation) or defer to Phase 12 (per-bot access control).
   - Recommendation: Defer to Phase 12. Phase 10 scope is config layer only. The pairing backend works for the single "default" account case.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual testing via dev mode |
| Config file | none -- no automated test framework in MaxAuto frontend |
| Quick run command | `pnpm dev` (manual verification) |
| Full suite command | `pnpm build` (TypeScript type check + Vite build) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MBOT-05 | Binding uses match.accountId for correct routing | manual | Verify in dev: save bot A binding, check bot B binding preserved in config | No |
| MBOT-07 | Single-bot config migrates to accounts.default | manual | Verify in dev: start with flat config, add second bot, check config shape | No |

### Sampling Rate
- **Per task commit:** `pnpm build` (type check catches interface mismatches)
- **Per wave merge:** Manual verification in dev mode
- **Phase gate:** `pnpm build` clean + manual multi-bot test scenario

### Wave 0 Gaps
- [ ] No automated test infrastructure for frontend components
- [ ] Manual test plan needed: create single-bot config, add second bot, verify migration, verify binding isolation

## Sources

### Primary (HIGH confidence)
- `openclaw/src/config/types.telegram.ts` -- TelegramConfig type definition (line 258-263): `TelegramAccountConfig & { accounts?, defaultAccount? }`
- `openclaw/src/config/types.agents.ts` -- AgentRouteBinding and AgentBindingMatch types (lines 28-44): `match.accountId` field
- `openclaw/src/routing/account-id.ts` -- `normalizeAccountId` and `canonicalizeAccountId` (lines 1-70): lowercase, alphanumeric+hyphen, max 64 chars
- `openclaw/src/telegram/accounts.ts` -- `mergeTelegramAccountConfig` (lines 108-135): groups NOT inherited in multi-account mode
- `openclaw/src/telegram/accounts.ts` -- `listTelegramAccountIds` (lines 56-65): combines config account IDs + bound account IDs
- `openclaw/src/routing/bindings.ts` -- `listBoundAccountIds` (lines 48-62): binding resolution ignores empty/wildcard accountId
- `openclaw/src/routing/resolve-route.ts` -- route resolution tiers: peer > guild > team > account > channel (lines 723-781)
- `src/components/settings/IMChannelsSection.tsx` -- current binding filter bug at line 287
- `src/api/config-helpers.ts` -- patchConfig with RFC 7396 merge-patch semantics

### Secondary (MEDIUM confidence)
- `src-tauri/src/commands/pairing.rs` -- `allow_from_file_path(account_id)` exists but unused (line 17, 140)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all existing code
- Architecture: HIGH - OpenClaw source code directly examined, types verified
- Pitfalls: HIGH - bugs identified in actual source code with line numbers

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable domain, OpenClaw types unlikely to change)
