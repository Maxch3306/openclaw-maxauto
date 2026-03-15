# Architecture Patterns: Multi-Bot Telegram

**Domain:** Multi-account Telegram bot management in a Tauri desktop app
**Researched:** 2026-03-15

## Recommended Architecture

### Overview

Restructure from a single-bot flat config UI (`IMChannelsSection.tsx`) to a multi-account list/detail pattern that maps directly onto OpenClaw's `channels.telegram.accounts.<id>` config structure. Each account gets its own bot token, access control, agent binding, and connection status.

### Config Structure Mapping

OpenClaw's native multi-account config (`TelegramConfig` in `types.telegram.ts`):

```typescript
// channels.telegram (TelegramConfig = TelegramAccountConfig & { accounts, defaultAccount })
{
  channels: {
    telegram: {
      // Top-level fields serve as defaults inherited by all accounts
      enabled: true,
      dmPolicy: "pairing",

      // Per-account overrides
      accounts: {
        "bot-one": {
          botToken: "123:abc",
          name: "Support Bot",
          dmPolicy: "allowlist",
          allowFrom: ["12345"],
          groups: { "-100123": { requireMention: true } },
        },
        "bot-two": {
          botToken: "456:def",
          name: "Dev Bot",
          dmPolicy: "open",
          allowFrom: ["*"],
        },
      },
      defaultAccount: "bot-one",
    },
  },
  // Bindings use accountId to route channel+account -> agent
  bindings: [
    { agentId: "support", match: { channel: "telegram", accountId: "bot-one" } },
    { agentId: "coder",   match: { channel: "telegram", accountId: "bot-two" } },
  ],
}
```

**Key insight from OpenClaw source code:** `TelegramConfig` is literally `TelegramAccountConfig & { accounts, defaultAccount }`. Top-level fields are inherited by accounts unless overridden. In multi-account setups, `groups` is explicitly NOT inherited (see `mergeTelegramAccountConfig` in `accounts.ts` line 132) to prevent cross-bot group membership conflicts.

### Component Boundaries

| Component | Responsibility | Communicates With | Status |
|-----------|---------------|-------------------|--------|
| `IMChannelsSection` | Top-level Channels page: renders bot account list + "Add Bot" button | `BotAccountCard`, gateway (`config.get`, `channels.status`) | **Modify** (strip single-bot form, add account list) |
| `BotAccountCard` | Summary card for one bot: name, @username, status dot, bound agent, expand/collapse | `IMChannelsSection` (parent state), `BotAccountEditor` | **New** |
| `BotAccountEditor` | Detail form for one bot: token, access control, agent binding, groups | Gateway (`config.get`), `patchConfig`, `validateBotToken` | **New** (extracts form logic from current `IMChannelsSection`) |
| `AddBotDialog` | Modal: enter account ID + bot token, validate, create account entry | `patchConfig`, Telegram `getMe` API | **New** |
| `TagInput` | Reusable tag input for allowlists | Parent components | **Keep** (already exists) |
| `PairingRequestsPanel` | Pairing request list (already exists inline) | Tauri IPC (`listPairingRequests`, `approvePairingRequest`) | **Extract** from `IMChannelsSection`, scope to account |

### Data Flow

**Loading (mount):**

```
IMChannelsSection mounts
  |
  +-> gateway.request("config.get") -> extract channels.telegram.accounts
  |     Each account ID -> BotAccountCard with merged config
  |
  +-> gateway.request("channels.status", { probe: true })
  |     -> result.channelAccounts.telegram (Record<accountId, ChannelAccountSnapshot>)
  |     Each account ID -> status mapped to card
  |
  +-> Extract bindings[] where match.channel === "telegram"
        Group by match.accountId -> agent assignment per card
```

**Saving (per-account):**

```
BotAccountEditor "Save" clicked
  |
  +-> Validate bot token (if changed) via Telegram getMe
  |
  +-> Build patch object:
  |     {
  |       channels: {
  |         telegram: {
  |           accounts: {
  |             [accountId]: { botToken, dmPolicy, allowFrom, groups, ... }
  |           }
  |         }
  |       },
  |       bindings: [...otherBindings, { agentId, match: { channel: "telegram", accountId } }]
  |     }
  |
  +-> patchConfig(patch)
  +-> waitForReconnect()
  +-> Reload config + status
```

**Adding a new bot:**

```
User clicks "Add Bot"
  |
  +-> AddBotDialog opens
  +-> User enters bot token
  +-> Validate token via getMe -> extract @username
  +-> Auto-generate accountId from bot username (e.g., @my_helper_bot -> my-helper-bot)
  +-> User selects agent to bind
  +-> patchConfig({
  |     channels: { telegram: { accounts: { [accountId]: { botToken, enabled: true } } } },
  |     bindings: [...existingBindings, { agentId, match: { channel: "telegram", accountId } }]
  |   })
  +-> waitForReconnect()
  +-> Parent reloads, new card appears
```

**Removing a bot:**

```
User clicks "Remove" on BotAccountCard
  |
  +-> Confirm dialog
  +-> patchConfig({
  |     channels: { telegram: { accounts: { [accountId]: null } } },  // merge-patch delete
  |     bindings: existingBindings.filter(b =>
  |       !(b.match.channel === "telegram" && b.match.accountId === accountId))
  |   })
  +-> waitForReconnect()
  +-> Card removed from list
```

**1:1 Binding Enforcement:**

```
Agent dropdown in BotAccountEditor
  |
  +-> Filter available agents:
  |     allAgents.filter(a => !otherBotBindings.some(b => b.agentId === a.agentId))
  |
  +-> Disabled agents shown grayed with "(bound to @other-bot)"
  +-> Each agent can only appear once across all telegram bindings
  +-> Each bot account can only bind to one agent
```

### State Management

**No new Zustand store needed.** The `IMChannelsSection` component manages local state for the account list, similar to how it currently manages single-bot state. Rationale: this is page-local UI state, not cross-component shared state.

```typescript
// IMChannelsSection local state
const [accounts, setAccounts] = useState<Map<string, TelegramAccountState>>();
const [accountStatuses, setAccountStatuses] = useState<Map<string, ChannelAccountSnapshot>>();
const [allBindings, setAllBindings] = useState<BindingEntry[]>([]);
const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);

// Per-account state (inside BotAccountEditor)
interface TelegramAccountState {
  accountId: string;
  botToken: string;
  name?: string;
  dmPolicy: string;
  groupPolicy: string;
  allowFrom: string[];
  groupAllowFrom: string[];
  groups: string[];
  boundAgentId: string | null;
}
```

### Account ID Convention

OpenClaw normalizes account IDs via `normalizeAccountId()`: lowercase, alphanumeric + hyphens. The special ID `"default"` is used for backward compatibility with single-bot setups.

**Migration from single-bot:** When upgrading from the current flat config (`channels.telegram.botToken`) to multi-account, the existing config already works because `TelegramConfig` extends `TelegramAccountConfig`. The top-level fields act as the implicit `"default"` account. No migration step needed -- OpenClaw handles this transparently.

**For new bots added via UI:** Generate account ID from the bot username (e.g., `@my_helper_bot` -> `my-helper-bot`). If the user has no existing accounts entry, the first bot can remain as top-level config (backward compat) or be moved into `accounts.default`.

## Patterns to Follow

### Pattern 1: List/Detail with Expand-in-Place

**What:** Show bot accounts as a vertical card list. Clicking a card expands it inline to show the full editor form. Only one card expanded at a time.

**When:** Always -- this is the primary interaction pattern.

**Why:** Avoids page navigation for a settings sub-page. Users can see all bots at a glance and edit one at a time. Matches the existing settings UI pattern (card-based sections).

```typescript
// IMChannelsSection render structure
<div className="max-w-2xl mx-auto p-6">
  <header>
    <h1>Channels</h1>
    <button onClick={openAddBotDialog}>+ Add Telegram Bot</button>
  </header>

  {accounts.map(account => (
    <BotAccountCard
      key={account.accountId}
      account={account}
      status={accountStatuses.get(account.accountId)}
      boundAgentId={getBindingForAccount(account.accountId)}
      expanded={expandedAccountId === account.accountId}
      onToggle={() => setExpandedAccountId(
        expandedAccountId === account.accountId ? null : account.accountId
      )}
    >
      {expandedAccountId === account.accountId && (
        <BotAccountEditor
          account={account}
          allBindings={allBindings}
          agents={agents}
          onSave={handleSaveAccount}
          onRemove={handleRemoveAccount}
        />
      )}
    </BotAccountCard>
  ))}

  {/* Other Channels - Coming Soon (unchanged) */}
</div>
```

### Pattern 2: Merge-Patch Config Updates

**What:** Use `patchConfig()` with deep merge-patch semantics for all config writes. Setting a key to `null` deletes it.

**When:** Every save/remove operation.

**Why:** Already established pattern in the codebase. Gateway handles validation, file write, and auto-restart. Avoids read-modify-write race conditions.

```typescript
// Add account
await patchConfig({
  channels: {
    telegram: {
      accounts: {
        [accountId]: { botToken, enabled: true, dmPolicy: "pairing" }
      }
    }
  },
  bindings: updatedBindings,
});

// Remove account (null = delete via merge-patch)
await patchConfig({
  channels: {
    telegram: {
      accounts: {
        [accountId]: null
      }
    }
  },
  bindings: filteredBindings,
});
```

### Pattern 3: Bindings with accountId Scoping

**What:** Each bot-agent binding includes `match.accountId` to scope to a specific Telegram account.

**When:** Always for multi-bot. The current binding `{ match: { channel: "telegram" } }` (no accountId) routes ALL telegram accounts to one agent -- this must change.

**Why:** OpenClaw's routing system uses `bindings[].match.accountId` to route inbound messages from a specific bot to the correct agent. Without accountId, all bots route to the same agent.

```typescript
// Current single-bot binding (backward compat, routes all accounts)
{ agentId: "main", match: { channel: "telegram" } }

// Multi-bot binding (explicit per-account routing)
{ agentId: "support", match: { channel: "telegram", accountId: "support-bot" } }
{ agentId: "coder",   match: { channel: "telegram", accountId: "dev-bot" } }
```

**Migration concern:** When the first bot is added through multi-bot UI, the existing binding `{ match: { channel: "telegram" } }` (no accountId) must be replaced with `{ match: { channel: "telegram", accountId: "<id>" } }`. Otherwise the old wildcard binding would catch messages intended for the new bot too.

### Pattern 4: Status from channelAccounts (not channels)

**What:** Use `result.channelAccounts.telegram` from `channels.status` response, which returns per-account snapshots.

**When:** Loading status for each bot card.

**Why:** The existing code already handles this -- see `loadChannelStatus()` in `IMChannelsSection.tsx` lines 157-181. It reads `channelAccounts.telegram` which is a `Record<accountId, ChannelAccountSnapshot>` or array. For multi-bot, iterate over all entries instead of taking only the first.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate Config Writes for Account and Binding

**What:** Writing account config in one `patchConfig` call and binding in another.

**Why bad:** Two sequential restarts. Second restart may fail if first produced invalid state. Race condition between writes.

**Instead:** Always include both `channels.telegram.accounts` and `bindings` in a single `patchConfig` call.

### Anti-Pattern 2: Top-Level Telegram Config for Multi-Bot

**What:** Continuing to write `channels.telegram.botToken` (top-level) alongside `channels.telegram.accounts`.

**Why bad:** Creates ambiguity about which bot is "default". OpenClaw warns when multiple accounts exist without explicit `defaultAccount`. Top-level fields are inherited by all accounts, which may not be intended.

**Instead:** For new multi-bot setups, put everything under `accounts.<id>`. Leave top-level fields only as shared defaults (dmPolicy, groupPolicy) if desired.

### Anti-Pattern 3: Storing Bot State in Zustand

**What:** Creating a new Zustand store for telegram account state.

**Why bad:** This state is only used on the Channels settings page. Adding a store adds complexity, subscription overhead, and stale-data risk since the config is the single source of truth (gateway config file).

**Instead:** Use React local state in `IMChannelsSection`. Reload from gateway on mount and after saves.

### Anti-Pattern 4: Editing Top-Level Token in Multi-Account Mode

**What:** Allowing users to set `channels.telegram.botToken` when `channels.telegram.accounts` has entries.

**Why bad:** The top-level `botToken` creates an implicit "default" account that interacts confusingly with explicit accounts. OpenClaw's `mergeTelegramAccountConfig` merges top-level into each account as base, so a top-level token becomes every account's fallback token.

**Instead:** When transitioning to multi-account, move the existing top-level token into `accounts.default` or a named account. The UI should never write top-level `botToken` once `accounts` exists.

## Build Order

Build these components in dependency order:

1. **BotAccountCard** (display-only) -- Renders account summary: name, @username, status dot, bound agent badge. No editing. This validates the data loading pipeline works.

2. **BotAccountEditor** -- Extract the existing form fields from `IMChannelsSection` into a standalone component. Parameterize by `accountId`. Add `accountId` to binding match. This is the bulk of the work.

3. **Refactor IMChannelsSection** -- Replace the single-bot inline form with an account list that renders `BotAccountCard` + `BotAccountEditor`. Handle multi-account config loading and per-account status mapping.

4. **AddBotDialog** -- Modal for creating a new account: enter token, validate, auto-generate account ID from bot username, select agent, save.

5. **Remove flow** -- Add remove button to `BotAccountEditor` with confirmation. Implements merge-patch deletion.

6. **1:1 binding enforcement** -- Filter agent dropdown to exclude agents already bound to other bots. Show warning if bound agent is deleted.

7. **PairingRequestsPanel extraction** -- Move pairing UI into a sub-component scoped to account (future: pairing is per-account when dmPolicy is "pairing").

## Scalability Considerations

| Concern | 1 bot | 3 bots | 10+ bots |
|---------|-------|--------|----------|
| Config complexity | Flat, simple | Manageable with cards | May need search/filter |
| Status polling | Single probe | 3 probes (single API call) | Still one `channels.status` call |
| Gateway restart | ~2s | ~2s (same process) | ~2s (same process) |
| Binding management | Trivial | Manual but clear | Needs bulk operations |

**Realistic scope:** Most users will have 1-3 bots. The card list pattern handles this well. 10+ bots is an edge case that does not need special UI treatment in v1.1.

## Sources

- `openclaw/src/config/types.telegram.ts` -- TelegramConfig, TelegramAccountConfig type definitions (HIGH confidence)
- `openclaw/src/config/types.agents.ts` -- AgentRouteBinding, AgentBindingMatch types with accountId field (HIGH confidence)
- `openclaw/src/telegram/accounts.ts` -- Account resolution, multi-account merge logic, inheritance rules, groups non-inheritance (HIGH confidence)
- `openclaw/src/routing/bindings.ts` -- Binding resolution, accountId extraction, default routing (HIGH confidence)
- `openclaw/docs/channels/telegram.md` -- Multi-account precedence docs, config reference (HIGH confidence)
- `src/components/settings/IMChannelsSection.tsx` -- Current single-bot implementation, channelAccounts handling (HIGH confidence)
- `src/api/config-helpers.ts` -- patchConfig merge-patch semantics (HIGH confidence)

---

*Architecture analysis: 2026-03-15*
