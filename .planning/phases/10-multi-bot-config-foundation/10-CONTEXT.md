# Phase 10: Multi-Bot Config Foundation - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Config layer correctly supports multiple Telegram bot accounts with account-scoped bindings, lazy migration from single-bot, and no data corruption. This is pure infrastructure — no new UI components. Phase 11 builds the multi-bot UI on top of this foundation.

</domain>

<decisions>
## Implementation Decisions

### Migration UX
- Lazy migration: only triggers when user adds a second bot
- Show brief notification after migration: "Migrated existing bot to multi-bot config"
- Migration moves flat `channels.telegram.*` fields into `channels.telegram.accounts.default.*`
- Must preserve all existing settings (token, dmPolicy, groupPolicy, allowFrom, groups, etc.)

### Account ID naming
- Use the bot's @username from getMe validation as the account ID
- Normalized to lowercase (matching OpenClaw's `normalizeAccountId`)
- Existing single-bot becomes account ID "default" during migration
- New bots get their username as ID (e.g. "kimi_tgbot")

### Claude's Discretion
- Exact migration implementation (read full config, restructure, write atomically)
- Error handling for migration failures
- Whether to set `defaultAccount` field when multiple accounts exist
- Notification component/mechanism for migration message

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `patchConfig()` + `waitForReconnect()` from config-helpers.ts
- `IMChannelsSection.tsx`: current single-bot config read/write patterns
- `gateway.request("config.get")`: reads full config including bindings
- Token validation via `fetch()` to Telegram getMe API (Phase 7)

### Established Patterns
- Binding at config root: `bindings: [{ agentId, match: { channel: "telegram" } }]`
- Config save: atomic `patchConfig({ channels: { telegram: ... }, bindings: [...] })`
- Current binding filter: `allBindings.filter(b => b.match?.channel !== "telegram")` — THIS IS THE BUG to fix

### Integration Points
- `IMChannelsSection.tsx`: refactor config read/write to use `channels.telegram.accounts.<id>` structure
- `channels.status` response: already returns `channelAccounts.telegram` as array with per-account snapshots
- OpenClaw `TelegramConfig` type: `TelegramAccountConfig & { accounts?: Record<string, TelegramAccountConfig>, defaultAccount?: string }`
- Binding with accountId: `{ agentId, match: { channel: "telegram", accountId: "<id>" } }`

### Critical Bug
- Current binding save filters ALL telegram bindings when saving one bot
- Must change to filter by BOTH `channel === "telegram"` AND `accountId === currentAccountId`
- Without this fix, adding a second bot would destroy the first bot's binding

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-multi-bot-config-foundation*
*Context gathered: 2026-03-15*
