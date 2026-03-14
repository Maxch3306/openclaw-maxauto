# Technology Stack

**Project:** MaxAuto v1.1 - Multi-Bot Telegram Support
**Researched:** 2026-03-15
**Confidence:** HIGH (verified from OpenClaw source code)

## Key Finding: No Stack Additions Needed

OpenClaw already has full multi-account Telegram support built into its config system and gateway protocol. The entire multi-bot feature is a **frontend-only refactor** of `IMChannelsSection.tsx` plus config shape changes. No new libraries, no new Rust commands, no new dependencies.

## What OpenClaw Already Provides

### Multi-Account Config Structure (HIGH confidence - verified from source)

OpenClaw's `TelegramConfig` type (`src/config/types.telegram.ts:258-263`) is:

```typescript
type TelegramConfig = {
  accounts?: Record<string, TelegramAccountConfig>;  // <-- multi-account
  defaultAccount?: string;                            // <-- default picker
} & TelegramAccountConfig;                            // <-- base/channel-level
```

Each account in `accounts` is a full `TelegramAccountConfig` with its own `botToken`, `dmPolicy`, `groupPolicy`, `allowFrom`, `groups`, `enabled`, etc.

**Config shape for multi-bot (openclaw.json):**

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "accounts": {
        "support-bot": {
          "botToken": "123:AAA...",
          "dmPolicy": "open",
          "allowFrom": ["12345"]
        },
        "sales-bot": {
          "botToken": "456:BBB...",
          "dmPolicy": "pairing",
          "groupPolicy": "disabled"
        }
      },
      "defaultAccount": "support-bot"
    }
  },
  "bindings": [
    { "agentId": "agent-1", "match": { "channel": "telegram", "accountId": "support-bot" } },
    { "agentId": "agent-2", "match": { "channel": "telegram", "accountId": "sales-bot" } }
  ]
}
```

### Account Resolution (`src/telegram/accounts.ts`) - HIGH confidence

- `listTelegramAccountIds(cfg)` -- returns all configured account IDs
- `resolveTelegramAccount({ cfg, accountId })` -- resolves token, enabled state, merged config
- `listEnabledTelegramAccounts(cfg)` -- returns all enabled accounts
- `mergeTelegramAccountConfig(cfg, accountId)` -- merges base telegram config with per-account overrides; **deliberately does NOT inherit channel-level `groups` in multi-account setups** (issue #30673)

### Token Resolution (`src/telegram/token.ts`) - HIGH confidence

Tokens resolve per-account via: `accounts.<id>.tokenFile` > `accounts.<id>.botToken` > channel-level `tokenFile` > channel-level `botToken` > `TELEGRAM_BOT_TOKEN` env (default account only).

For MaxAuto, the relevant path is `accounts.<id>.botToken` in config JSON.

### Bindings (`src/config/types.agents.ts`, `src/routing/bindings.ts`) - HIGH confidence

Agent-to-channel binding uses `AgentRouteBinding`:

```typescript
type AgentRouteBinding = {
  type?: "route";
  agentId: string;
  match: {
    channel: string;       // "telegram"
    accountId?: string;    // "support-bot" -- THIS is the multi-account key
  };
};
```

`listBoundAccountIds(cfg, "telegram")` returns all account IDs that appear in bindings. The binding `match.accountId` links a specific bot account to a specific agent.

### Gateway Status API (`channels.status`) - HIGH confidence

Response shape already returns **per-account arrays**:

```typescript
{
  channelAccounts: {
    telegram: ChannelAccountSnapshot[]  // one entry per account
  },
  channelDefaultAccountId: {
    telegram: string  // the default account ID
  }
}
```

Each `ChannelAccountSnapshot` includes: `accountId`, `name`, `enabled`, `configured`, `connected`, `running`, `lastError`, `probe` (with bot username/id), `tokenSource`, `dmPolicy`, `allowFrom`, etc.

## Recommended Stack (No Changes)

### Existing Stack (Keep As-Is)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| React 19 | 19.x | Frontend framework | Keep |
| TypeScript | 5.x | Type safety | Keep |
| Tailwind CSS | 3.4 | Styling | Keep |
| Zustand 5 | 5.x | State management | Keep |
| Vite 6 | 6.x | Build tool | Keep |
| Tauri v2 | 2.x | Desktop backend (Rust) | Keep |
| lucide-react | latest | Icons | Keep |

### Libraries NOT Needed

| Library | Why Not Needed |
|---------|---------------|
| Any Telegram SDK | Token validation uses raw `fetch` to Telegram getMe API -- already works |
| Any form library | Existing pattern of useState + patchConfig is sufficient |
| Any state machine lib | 1:1 binding enforcement is simple conditional logic |
| UUID/nanoid | Account IDs are user-chosen strings (e.g., "support-bot") |

### Rust Backend: No Changes

| Command | Status | Notes |
|---------|--------|-------|
| `config.rs` (read/write) | Keep as-is | Raw JSON pass-through; multi-account is just deeper nesting |
| `pairing.rs` | Keep as-is | Pairing is per-gateway, not per-account (credentials stored centrally) |
| `gateway.rs` | Keep as-is | Gateway handles multi-account internally |

The Rust backend does not need changes because:
1. `read_config` / `write_config` are raw JSON -- they pass through any shape
2. `patchConfig()` on the frontend uses the gateway's `config.patch` method which handles deep merge
3. The gateway process already starts all configured accounts automatically

## What Must Change (Frontend Only)

### 1. Config Shape in `IMChannelsSection.tsx`

**Current:** Reads/writes `channels.telegram.botToken`, `channels.telegram.dmPolicy`, etc. (single bot at channel level)

**Needed:** Read/write `channels.telegram.accounts.<id>.botToken`, `channels.telegram.accounts.<id>.dmPolicy`, etc.

### 2. Bindings Array

**Current:** One binding with `match: { channel: "telegram" }` (no accountId)

**Needed:** Per-account bindings with `match: { channel: "telegram", accountId: "<id>" }`

### 3. Status Polling

**Current:** `loadChannelStatus()` reads first entry from `channelAccounts.telegram`

**Needed:** Map over all entries in `channelAccounts.telegram` array, keyed by `accountId`

### 4. 1:1 Enforcement (Pure Frontend Logic)

- When selecting an agent for a bot: filter out agents already bound to another bot
- When a bot is bound to an agent: show that agent as unavailable in other bot dropdowns
- Validation: prevent saving if duplicate agent-bot pairs exist

## Config Patch Examples

### Adding a new bot account

```typescript
await patchConfig({
  channels: {
    telegram: {
      enabled: true,
      accounts: {
        "my-new-bot": {
          botToken: "123:AAA...",
          enabled: true,
          dmPolicy: "open",
        }
      }
    }
  },
  bindings: [
    ...existingBindings,
    { agentId: "agent-1", match: { channel: "telegram", accountId: "my-new-bot" } }
  ]
});
```

### Removing a bot account

```typescript
await patchConfig({
  channels: {
    telegram: {
      accounts: {
        "old-bot": null  // merge-patch deletion
      }
    }
  },
  bindings: existingBindings.filter(b =>
    !(b.match.channel === "telegram" && b.match.accountId === "old-bot")
  )
});
```

### Migration: single-bot to multi-account

If user already has `channels.telegram.botToken` set (current single-bot setup), migration to `accounts` structure requires moving the token:

```typescript
// Read current config
const currentToken = cfg.channels.telegram.botToken;
const currentBinding = bindings.find(b => b.match.channel === "telegram");

// Migrate to accounts structure
await patchConfig({
  channels: {
    telegram: {
      botToken: null,  // remove channel-level token
      accounts: {
        "default": {
          botToken: currentToken,
          dmPolicy: cfg.channels.telegram.dmPolicy,
          // ... other per-account fields
        }
      },
      defaultAccount: "default"
    }
  },
  bindings: currentBinding
    ? [{ ...currentBinding, match: { ...currentBinding.match, accountId: "default" } }]
    : []
});
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Account ID scheme | User-chosen string | Auto-generated UUID | OpenClaw uses string IDs everywhere; user-friendly names like "support-bot" match the CLI UX |
| Config storage | OpenClaw's openclaw.json | Separate MaxAuto DB | OpenClaw owns multi-account lifecycle; storing elsewhere creates sync issues |
| Token validation | Direct fetch to Telegram API | Route through gateway | Current approach already works; gateway doesn't expose a token-test method |
| Binding management | Frontend builds full `bindings` array | Per-binding gateway method | Gateway only supports full `config.patch`; no incremental binding API |
| Account-level config | `channels.telegram.accounts.<id>.*` | Channel-level fields for "primary" bot | OpenClaw's `mergeTelegramAccountConfig` deliberately skips group inheritance in multi-account; using accounts is the intended path |

## Sources

All findings verified directly from OpenClaw source code at `openclaw/` reference directory:

- `openclaw/src/config/types.telegram.ts` -- TelegramConfig, TelegramAccountConfig types
- `openclaw/src/config/types.channels.ts` -- ChannelsConfig type
- `openclaw/src/config/types.agents.ts` -- AgentRouteBinding, AgentBindingMatch types
- `openclaw/src/config/bindings.ts` -- listConfiguredBindings, listRouteBindings
- `openclaw/src/telegram/accounts.ts` -- listTelegramAccountIds, resolveTelegramAccount, mergeTelegramAccountConfig
- `openclaw/src/telegram/token.ts` -- resolveTelegramToken per-account resolution
- `openclaw/src/routing/bindings.ts` -- listBoundAccountIds, buildChannelAccountBindings
- `openclaw/src/gateway/server-methods/channels.ts` -- channels.status handler (per-account snapshots)
- `openclaw/src/gateway/protocol/schema/channels.ts` -- ChannelAccountSnapshotSchema, ChannelsStatusResultSchema

---

*Stack analysis: 2026-03-15*
