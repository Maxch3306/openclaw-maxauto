# Phase 11: Bot Account Management - Research

**Researched:** 2026-03-15
**Domain:** React UI (card-based CRUD, multi-account Telegram config)
**Confidence:** HIGH

## Summary

Phase 11 transforms the single-bot Telegram form in `IMChannelsSection.tsx` into a multi-bot card-based UI with full lifecycle management (add, remove, enable/disable) and 1:1 agent binding enforcement. The implementation builds entirely on Phase 10's `telegram-accounts.ts` utility module which already provides account config read/write, binding helpers, and lazy migration.

The primary challenge is UI refactoring: the current `IMChannelsSection.tsx` is a 785-line monolithic component with inline state for a single bot. It needs to be decomposed into a card list with per-card expand/collapse, an "Add Bot" modal dialog, and a "Remove Bot" confirmation dialog. The `SkillsSection.tsx` provides a proven expand-on-click card pattern with `useState<string | null>(null)` for tracking expanded card.

**Primary recommendation:** Decompose IMChannelsSection into BotCardList (container) + BotCard (compact/expanded) + AddBotDialog (modal) + RemoveBotDialog (confirmation). Reuse all Phase 10 helpers. No new libraries needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Compact card per bot showing: @username, status indicator, bound agent name, enable/disable toggle
- Status shown as colored dots + text labels: green "Connected", orange "Disconnected", red "Error", gray "Disabled"
- Click card to expand -- expanded view shows full settings (token, DM/group policy, access lists, agent binding dropdown)
- Cards stacked vertically in the Channels section, replacing the current single-form layout
- Modal dialog triggered by "Add Bot" button with steps: token input -> validate via getMe -> show @username -> required agent dropdown (unbound only) -> Save
- Agent binding is required in the dialog -- cannot add a bot without selecting an agent
- Token validation must succeed before agent dropdown appears
- 1:1 enforcement: dropdown filters out agents already bound to other bots, showing why unavailable
- Detailed confirmation dialog for removal showing: bot @username, bound agent name, configured access lists summary
- Explicit "Remove" button (not just "OK")
- Removing the last/only bot is allowed -- section returns to empty state with "Add Bot" prompt
- Remove atomically deletes account config entry AND its binding in a single patchConfig call

### Claude's Discretion
- Exact card component structure and styling
- Enable/disable toggle placement on compact card
- Empty state design when no bots configured
- Animation/transition for card expand/collapse

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MBOT-01 | User can add a new Telegram bot by entering its token (validated via getMe API) | AddBotDialog with validateBotToken (existing pattern), botUsernameToAccountId for account ID derivation |
| MBOT-02 | User can remove a Telegram bot account and its associated binding | RemoveBotDialog + atomic patchConfig setting account to null + buildUpdatedBindings with null agentId |
| MBOT-03 | User can enable/disable individual bot accounts without removing them | Toggle on compact card, patchConfig to accounts.<id>.enabled = true/false |
| MBOT-04 | User can see per-bot connection status (connected/disconnected/error) | channels.status with probe:true returns channelAccounts.telegram keyed by accountId |
| MBOT-06 | UI enforces 1:1 binding -- same agent cannot be bound to two bots | Filter agents dropdown by checking allBindings for existing telegram bindings per agent |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | Component framework | Project standard |
| Zustand | 5 | State management (chat-store for agents) | Project standard |
| Tailwind CSS | 3.4 | Styling | Project standard |
| lucide-react | latest | Icons (Send, ChevronDown, Trash2, Plus, Power, etc.) | Project standard |

### Supporting (already in project)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| telegram-accounts.ts | Account config helpers, binding helpers, migration | All config operations |
| config-helpers.ts | patchConfig + waitForReconnect | All config writes |
| gateway-client.ts | WebSocket gateway communication | config.get, channels.status |

### No New Dependencies Required
This phase is pure UI refactoring using existing project libraries. No new packages needed.

## Architecture Patterns

### Recommended Component Structure
```
src/components/settings/
  IMChannelsSection.tsx         # Refactored: thin shell, renders BotCardList + AddBotDialog
  BotCardList.tsx               # Container: loads config, maps accounts to BotCard components
  BotCard.tsx                   # Compact card + expandable detail view
  AddBotDialog.tsx              # Modal: token input -> validate -> agent select -> save
  RemoveBotDialog.tsx           # Confirmation modal with summary of what will be lost
```

### Pattern 1: Expand-on-Click Card (from SkillsSection)
**What:** Single expanded card tracked via `useState<string | null>(null)`, clicking toggles expansion.
**When to use:** BotCard compact/expanded view.
**Example:**
```typescript
// Proven pattern from SkillsSection.tsx (line 330)
const [expandedId, setExpandedId] = useState<string | null>(null);
// Toggle: click card header
onClick={() => setExpandedId(expandedId === accountId ? null : accountId)}
// Render: conditionally show expanded content
{expandedId === accountId && <div className="border-t ...">...</div>}
```

### Pattern 2: Modal Dialog (from CreateAgentDialog / EditAgentDialog)
**What:** Overlay dialog with backdrop, form content, action buttons.
**When to use:** AddBotDialog, RemoveBotDialog.
**Example:**
```typescript
// Standard modal pattern used across the project
{showDialog && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-[var(--color-surface)] rounded-xl border ...">
      {/* Form content */}
      <div className="flex gap-2">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm} disabled={!isValid}>Save</button>
      </div>
    </div>
  </div>
)}
```

### Pattern 3: Token Validation (existing in IMChannelsSection)
**What:** Async getMe API call with format regex pre-check, loading/success/error states.
**When to use:** AddBotDialog token input step.
**Example:**
```typescript
// Existing validateBotToken function (IMChannelsSection.tsx line 217-249)
// 1. Regex check: /^\d+:[A-Za-z0-9_-]{30,}$/
// 2. fetch(`https://api.telegram.org/bot${token}/getMe`)
// 3. Return { valid, botUsername, error }
```

### Pattern 4: Status Display (existing in IMChannelsSection)
**What:** Colored dot + text label based on ChannelAccountSnapshot fields.
**When to use:** Compact BotCard status indicator.
**Example:**
```typescript
// Existing getStatusDisplay function (IMChannelsSection.tsx line 335-352)
// Maps: connected/linked/running -> green "Connected"
//       lastError -> red "Error"
//       configured + enabled but not connected -> orange "Disconnected"
//       not enabled -> gray "Disabled"
```

### Pattern 5: 1:1 Binding Enforcement
**What:** Filter agent dropdown to exclude agents already bound to other bots.
**When to use:** AddBotDialog agent dropdown, BotCard expanded agent dropdown.
**Example:**
```typescript
// Given allBindings from config.get response:
const telegramBindings = allBindings.filter(b => b.match?.channel === "telegram");
const boundAgentIds = new Set(
  telegramBindings
    .filter(b => b.match.accountId !== currentAccountId) // exclude current bot
    .map(b => b.agentId)
);
// In dropdown:
agents.map(a => (
  <option key={a.agentId} value={a.agentId} disabled={boundAgentIds.has(a.agentId)}>
    {a.name} {boundAgentIds.has(a.agentId) ? "(bound to another bot)" : ""}
  </option>
))
```

### Pattern 6: Atomic Remove via patchConfig
**What:** Delete account config + its binding in a single patchConfig call.
**When to use:** RemoveBotDialog confirm action.
**Example:**
```typescript
// Merge-patch null deletes the key (RFC 7396 semantics)
const updatedBindings = buildUpdatedBindings(allBindings, accountId, null); // removes binding
await patchConfig({
  channels: {
    telegram: {
      accounts: { [accountId]: null },  // delete account
    },
  },
  bindings: updatedBindings,
});
await waitForReconnect();
```

### Anti-Patterns to Avoid
- **Keeping all state in IMChannelsSection:** The current 785-line component will become unmanageable with multi-bot state. Decompose into child components that receive props/callbacks.
- **Separate config writes for account and binding:** Always use a single patchConfig call for atomicity. Never delete account in one call and binding in another.
- **Polling channels.status per-card:** Load status once at the list level, pass snapshots down to cards. Refresh all on a single button click.
- **Allowing empty agent binding on add:** The CONTEXT.md explicitly locks this -- agent binding is required during add flow.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Account ID from username | Custom normalization | `botUsernameToAccountId()` from telegram-accounts.ts | Matches OpenClaw's canonicalization |
| Binding array manipulation | Manual filter/push | `buildUpdatedBindings()` from telegram-accounts.ts | Handles accountId scoping correctly |
| Config read (legacy/multi) | Shape detection logic | `getAccountConfigs()` from telegram-accounts.ts | Handles both flat and accounts shapes |
| Token validation | New validation function | Extract `validateBotToken()` from current IMChannelsSection | Already tested, handles regex + API + error states |
| Status color mapping | New status logic | Extract `getStatusDisplay()` from current IMChannelsSection | Already handles all states correctly |

**Key insight:** Phase 10 built all the data helpers. Phase 11 is purely a UI refactor -- extracting existing logic into reusable functions and building new card components.

## Common Pitfalls

### Pitfall 1: Stale Bindings After Add/Remove
**What goes wrong:** After adding or removing a bot, the bindings array in memory is stale, causing 1:1 enforcement to allow duplicates or block valid selections.
**Why it happens:** Binding state is loaded on mount but not refreshed after patchConfig calls.
**How to avoid:** After every patchConfig + waitForReconnect, reload config via config.get to refresh both account configs AND bindings.
**Warning signs:** Agent shows as "available" in dropdown after being bound to another bot.

### Pitfall 2: Merge-Patch Null vs Undefined Confusion
**What goes wrong:** Using `undefined` to delete a key does nothing (JSON.stringify strips it). Using `null` incorrectly on a non-leaf key deletes the entire subtree.
**Why it happens:** RFC 7396 merge-patch semantics: `null` = delete, `undefined` = skip.
**How to avoid:** For account removal, set `accounts.<id>: null`. Never set `accounts: null` (deletes ALL accounts).
**Warning signs:** Config still has the "removed" account after save, or ALL accounts disappear.

### Pitfall 3: Migration Trigger on First Add
**What goes wrong:** Adding the first bot to a legacy flat config doesn't trigger migration, causing the new account to be written alongside old flat fields.
**Why it happens:** Migration is only needed when going from 1 bot to 2+ bots. First bot into an empty config should just write to `accounts.<id>` directly.
**How to avoid:** Check `needsMigration()` before adding a second bot. For adding to an empty config, write directly to `accounts.<id>`. Only call `migrateToMultiAccount()` when existing flat config has a botToken AND a new bot is being added.
**Warning signs:** Both `channels.telegram.botToken` and `channels.telegram.accounts.<id>.botToken` exist simultaneously.

### Pitfall 4: Per-Account Status Mapping
**What goes wrong:** Status shows as "Unknown" for all bots because the channelAccounts response isn't keyed by the expected account ID.
**Why it happens:** The `channelAccounts.telegram` response may use different key format than the config account IDs.
**How to avoid:** Load status via `channels.status` with `probe: true`, and match by iterating `channelAccounts.telegram` entries. If it's an array, match by label or probe.bot.username. If it's a Record, match by key.
**Warning signs:** Status shows "Unknown" even though bot is clearly connected.

### Pitfall 5: Enable/Disable Without Full Save
**What goes wrong:** Toggle writes only `enabled: false` but the config still has stale values.
**Why it happens:** Merge-patch is additive -- setting `enabled: false` only changes that one field, which is correct behavior.
**How to avoid:** Enable/disable toggle should only write `{ channels: { telegram: { accounts: { [id]: { enabled: false } } } } }`. This is actually the correct approach -- keep it minimal.
**Warning signs:** None -- this is the correct pattern (existing `disableTelegram()` already does this).

## Code Examples

### Loading Multi-Account Status
```typescript
// Load all account statuses in one call
async function loadAllAccountStatuses(): Promise<Map<string, ChannelAccountSnapshot>> {
  const result = await gateway.request<{
    channelAccounts?: Record<string, ChannelAccountSnapshot[] | Record<string, ChannelAccountSnapshot>>;
  }>("channels.status", { probe: true });

  const statusMap = new Map<string, ChannelAccountSnapshot>();
  const tgAccounts = result.channelAccounts?.telegram;
  if (tgAccounts) {
    if (Array.isArray(tgAccounts)) {
      // Array shape -- match by label or probe.bot.username
      for (const snap of tgAccounts) {
        const key = snap.label ?? snap.probe?.bot?.username?.toLowerCase() ?? "default";
        statusMap.set(key, snap);
      }
    } else {
      // Record shape -- keys are account IDs
      for (const [id, snap] of Object.entries(tgAccounts)) {
        statusMap.set(id, snap);
      }
    }
  }
  return statusMap;
}
```

### Adding a New Bot (Full Flow)
```typescript
async function addBot(token: string, botUsername: string, agentId: string) {
  const accountId = botUsernameToAccountId(botUsername);

  // Check if migration needed (existing flat config -> multi-account)
  const { config } = await gateway.request<{ config: Record<string, unknown> }>("config.get", {});
  const tg = (config as any).channels?.telegram ?? {};
  const existingBindings = ((config as any).bindings ?? []) as BindingEntry[];

  if (needsMigration(tg)) {
    await migrateToMultiAccount(tg, existingBindings);
    // Re-fetch after migration
    const refreshed = await gateway.request<{ config: Record<string, unknown> }>("config.get", {});
    // Continue with fresh state...
  }

  const updatedBindings = buildUpdatedBindings(existingBindings, accountId, agentId);
  await patchConfig({
    channels: {
      telegram: {
        accounts: {
          [accountId]: {
            enabled: true,
            botToken: token.trim(),
            dmPolicy: "open",
            groupPolicy: "disabled",
          },
        },
      },
    },
    bindings: updatedBindings,
  });
  await waitForReconnect();
}
```

### Removing a Bot (Atomic)
```typescript
async function removeBot(accountId: string, allBindings: BindingEntry[]) {
  const updatedBindings = buildUpdatedBindings(allBindings, accountId, null);
  await patchConfig({
    channels: {
      telegram: {
        accounts: { [accountId]: null },  // merge-patch delete
      },
    },
    bindings: updatedBindings,
  });
  await waitForReconnect();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat telegram config (botToken at top level) | Multi-account `accounts.<id>` structure | Phase 10 (2026-03-15) | All writes must target accounts.<id> |
| Single ChannelAccountSnapshot | Per-account snapshots in channelAccounts.telegram | Phase 10 | Status must be loaded and mapped per-account |
| Unscoped binding filter | Account-scoped via buildUpdatedBindings | Phase 10 | Prevents binding corruption |

## Open Questions

1. **channelAccounts.telegram response shape**
   - What we know: Code handles both array and Record shapes (IMChannelsSection line 166-168)
   - What's unclear: Exact key format in Record shape -- is it the account ID from config?
   - Recommendation: Handle both shapes defensively. Test with actual multi-bot config.

2. **Pairing section placement in multi-bot UI**
   - What we know: Current pairing section is shown at Channels section level, not per-bot
   - What's unclear: Should pairing requests be shown per-bot or globally?
   - Recommendation: Keep pairing section as-is (global) for Phase 11. Per-bot pairing is a Phase 12 concern if needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project uses `pnpm build` for TypeScript checks) |
| Config file | vite.config.ts (Vitest config likely embedded or separate) |
| Quick run command | `npx tsc --noEmit` |
| Full suite command | `pnpm build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MBOT-01 | Add bot via token + getMe validation | manual-only | Manual: enter token in AddBotDialog | N/A -- UI interaction |
| MBOT-02 | Remove bot + binding atomically | manual-only | Manual: click remove, verify config | N/A -- UI interaction |
| MBOT-03 | Enable/disable toggle without data loss | manual-only | Manual: toggle, verify config preserved | N/A -- UI interaction |
| MBOT-04 | Per-bot connection status display | manual-only | Manual: verify status dots match gateway state | N/A -- UI interaction |
| MBOT-06 | 1:1 binding enforcement in dropdown | unit | `npx tsc --noEmit` (type safety for binding logic) | Partial -- type checks only |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `pnpm build`
- **Phase gate:** Full build green + manual verification of all 5 requirements

### Wave 0 Gaps
None -- existing build infrastructure covers TypeScript validation. All requirements are UI-centric and require manual verification. The binding enforcement logic uses existing tested helpers from telegram-accounts.ts.

## Sources

### Primary (HIGH confidence)
- `src/components/settings/IMChannelsSection.tsx` -- current implementation, 785 lines
- `src/api/telegram-accounts.ts` -- Phase 10 helpers, all 7 functions reviewed
- `src/api/config-helpers.ts` -- patchConfig + waitForReconnect
- `src/components/settings/SkillsSection.tsx` -- expand-on-click card pattern
- `src/stores/chat-store.ts` -- Agent interface and agents list

### Secondary (MEDIUM confidence)
- `.planning/phases/10-multi-bot-config-foundation/10-01-SUMMARY.md` -- Phase 10 completion context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing project libraries
- Architecture: HIGH -- patterns proven in SkillsSection (cards), CreateAgentDialog (modals), existing IMChannelsSection (status/validation)
- Pitfalls: HIGH -- based on direct code review of merge-patch semantics and binding helpers

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- internal UI refactoring, no external dependencies)
