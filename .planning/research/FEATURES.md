# Feature Research

**Domain:** Multi-bot Telegram management with 1:1 agent binding (desktop GUI for OpenClaw)
**Researched:** 2026-03-15
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Add multiple Telegram bots | Core premise of the milestone; single-bot is already shipped | MEDIUM | OpenClaw config uses `channels.telegram.accounts` Record keyed by accountId. Each entry holds its own `botToken`, `dmPolicy`, `groups`, etc. The existing single-bot config maps to the implicit `default` account. Migration path: move top-level telegram fields into `accounts.default` entry. |
| Remove a bot | Any "add" action needs a corresponding "remove" | LOW | Set `accounts.<id>` to `null` via merge-patch. Must also remove the matching binding entry and clean up `channelAccounts` status cache. |
| Per-bot token validation | Already exists for single bot; users expect same for each | LOW | Reuse existing `validateBotToken()` (calls `getMe`). Run per-account on save. Show @username next to each bot entry. |
| Per-bot connection status | Users need to see which bots are online | LOW | `channels.status` already returns `channelAccounts.telegram` as `Record<accountId, ChannelAccountSnapshot>`. Existing code already tries this path (line 164 of IMChannelsSection). Just iterate all accounts instead of taking the first. |
| Per-bot agent binding dropdown | Each bot must be assignable to exactly one agent | MEDIUM | Write one `AgentRouteBinding` per bot: `{ type: "route", agentId, match: { channel: "telegram", accountId } }`. The binding `match.accountId` field is how OpenClaw routes inbound messages to the correct agent. |
| Strict 1:1 enforcement (bot side) | One bot cannot serve two agents -- confusing UX, undefined routing | LOW | UI validation: when user selects an agent for bot B, check if that agent is already bound to bot A. If so, show error. OpenClaw's `applyAgentBindings` already detects conflicts. |
| Strict 1:1 enforcement (agent side) | One agent should not receive messages from two Telegram bots | LOW | UI validation: filter the agent dropdown to exclude agents already bound to other Telegram bots. Gray out with "Already bound to @bot_name" tooltip. |
| Per-bot enable/disable toggle | Users may want to temporarily silence a bot without deleting it | LOW | Set `accounts.<id>.enabled = false` via merge-patch. OpenClaw's `resolveTelegramAccount` respects per-account `enabled` flag independently of the channel-level flag. |
| Per-bot access control (DM policy + allowlists) | Already exists at channel level; multi-bot needs it per account | MEDIUM | Each `TelegramAccountConfig` has its own `dmPolicy`, `allowFrom`, `groupPolicy`, `groupAllowFrom`, `groups`. OpenClaw's `mergeTelegramAccountConfig` merges channel-level defaults with account-level overrides. In multi-account setups, channel-level `groups` is NOT inherited (see issue #30673 comment in accounts.ts). UI must show per-bot forms. |
| Bot display name / label | Users need to distinguish bots at a glance beyond @username | LOW | `TelegramAccountConfig.name` field. Show in bot list header alongside @username from `getMe`. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Visual bot-agent binding map | At-a-glance view showing which bot talks to which agent, with status dots | MEDIUM | A small diagram or card grid: Bot card <--> Agent card, with connection lines or paired layout. Much clearer than dropdown-only UX. Could be a summary panel at top of Channels page. |
| One-click "Add Bot" wizard | Step-by-step: paste token, validate, name it, pick agent, set DM policy -- all in one flow | MEDIUM | Modal dialog with 3-4 steps. Reduces cognitive load vs. showing all fields at once. Existing `validateBotToken` and agent list are reusable. |
| Duplicate token detection | Prevent adding the same bot token twice (different accountId, same bot) | LOW | After `getMe` returns bot ID, check against all existing accounts' bot IDs. OpenClaw does not enforce this at config level -- it would create two pollers fighting for the same update offset. |
| Bot health dashboard | Aggregate view: N bots, N connected, N errors, last message times | LOW | Read from `channels.status` response. Compact summary bar above bot list. |
| Bulk bot import | Paste multiple tokens separated by newlines, validate all, auto-assign names | LOW | Power-user feature. Validate in parallel, show results table, let user assign agents. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Many-to-one binding (multiple bots per agent) | "I want my coding agent on both my personal and work bot" | Breaks 1:1 mental model, creates routing ambiguity for replies, complicates session management (which bot should the agent reply through?), OpenClaw's binding system supports it but the UX is confusing | Keep 1:1 strict. If users want the same agent behavior, clone the agent. |
| Auto-create agent per bot | "When I add a bot, create a matching agent automatically" | Pollutes the agent list with potentially unwanted entries, users may not realize they need to configure the auto-created agent (model, workspace, etc.) | Show "Create New Agent" as an option in the agent dropdown, but don't auto-create. |
| Per-bot model override | "This bot should use GPT-5 but that bot should use Kimi" | Model is an agent-level concern, not a channel concern. Mixing channel and agent config creates confusion. | Set per-agent model in agent settings. The 1:1 binding means per-bot effectively equals per-agent. |
| Webhook mode toggle in UI | "Let me switch between polling and webhook" | Webhooks require public URL, SSL cert, port forwarding -- all desktop-hostile. The app runs locally. | Always use polling (OpenClaw default). Document webhook as advanced/manual config. |
| Cross-channel agent sharing UI | "Show me all channels (Telegram, Discord, etc.) bound to this agent" | Premature -- only Telegram is implemented. Building a cross-channel binding UI now creates dead weight and confusing empty states for unimplemented channels. | Show bindings only in the channel-specific section. Revisit when 2+ channels are active. |

## Feature Dependencies

```
[Bot Token Validation]
    └──requires──> [Telegram API access (getMe)]

[Per-Bot Connection Status]
    └──requires──> [channels.status gateway call with accountId iteration]

[Per-Bot Agent Binding]
    └──requires──> [Agent List (agents.list)]
    └──requires──> [Bindings data model (accountId in match)]

[Strict 1:1 Enforcement]
    └──requires──> [Per-Bot Agent Binding]
    └──requires──> [Agent List to cross-check]

[Per-Bot Access Control]
    └──requires──> [Per-Bot config structure (accounts Record)]

[Add Bot Wizard]
    └──requires──> [Bot Token Validation]
    └──requires──> [Per-Bot Agent Binding]
    └──requires──> [Per-Bot Access Control]

[Remove Bot]
    └──requires──> [Per-Bot config structure]
    └──enhances──> [Binding cleanup]

[Visual Binding Map]
    └──enhances──> [Per-Bot Agent Binding]
    └──requires──> [Per-Bot Connection Status]

[Duplicate Token Detection]
    └──enhances──> [Bot Token Validation]
```

### Dependency Notes

- **Per-Bot Agent Binding requires Agent List:** Binding dropdown must show available agents and filter out already-bound ones.
- **Strict 1:1 Enforcement requires Per-Bot Agent Binding:** Cannot enforce uniqueness without knowing all current bindings.
- **Add Bot Wizard requires Token Validation + Binding + Access Control:** The wizard is a composition of the table-stakes features into a guided flow.
- **Remove Bot requires Binding cleanup:** Removing a bot must also remove its binding entry from the `bindings` array, not just the `accounts` entry.

## MVP Definition

### Launch With (v1.1)

Minimum viable multi-bot -- what validates the 1:1 multi-bot concept.

- [ ] Multi-bot account data model (`channels.telegram.accounts` Record) -- foundation for everything
- [ ] Add bot flow (token input, validate via getMe, assign accountId, set name) -- core CRUD
- [ ] Remove bot (with binding cleanup) -- core CRUD
- [ ] Per-bot agent binding with strict 1:1 enforcement -- the milestone's raison d'etre
- [ ] Per-bot connection status display -- users must see what's working
- [ ] Per-bot enable/disable toggle -- non-destructive control
- [ ] Per-bot DM policy and allowlists -- access control is safety-critical
- [ ] Migration from single-bot config to multi-bot structure -- backward compatibility

### Add After Validation (v1.1.x)

Features to add once multi-bot core is working.

- [ ] Visual bot-agent binding map -- when users have 3+ bots, list view gets crowded
- [ ] Add Bot wizard (guided modal) -- when onboarding feedback shows confusion
- [ ] Duplicate token detection -- when users report "bot not responding" due to double-registration
- [ ] Bot health dashboard summary bar -- when monitoring becomes a pain point

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Bulk bot import -- only relevant for power users with many bots
- [ ] Per-bot group configuration UI -- groups are complex (topics, per-group policies); defer until demand is clear
- [ ] Telegram webhook mode -- requires networking knowledge; polling works for desktop use case

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Multi-bot data model + migration | HIGH | MEDIUM | P1 |
| Add/remove bot | HIGH | MEDIUM | P1 |
| Per-bot agent binding (1:1) | HIGH | MEDIUM | P1 |
| Strict 1:1 enforcement | HIGH | LOW | P1 |
| Per-bot connection status | HIGH | LOW | P1 |
| Per-bot enable/disable | MEDIUM | LOW | P1 |
| Per-bot access control | HIGH | MEDIUM | P1 |
| Config migration (single to multi) | HIGH | MEDIUM | P1 |
| Bot display name/label | MEDIUM | LOW | P1 |
| Visual binding map | MEDIUM | MEDIUM | P2 |
| Add Bot wizard | MEDIUM | MEDIUM | P2 |
| Duplicate token detection | MEDIUM | LOW | P2 |
| Bot health dashboard | LOW | LOW | P3 |
| Bulk import | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## OpenClaw Config Data Model Reference

Understanding the underlying data model is critical for implementation. Key findings from source analysis:

### Multi-Account Config Structure

```jsonc
{
  "channels": {
    "telegram": {
      // Channel-level defaults (inherited by accounts unless overridden)
      "enabled": true,
      "dmPolicy": "pairing",
      "defaultAccount": "main-bot",

      // Per-account configs
      "accounts": {
        "main-bot": {
          "name": "Main Bot",
          "botToken": "123:ABC...",
          "dmPolicy": "allowlist",
          "allowFrom": [12345],
          "groups": { "-100123": {} }
        },
        "support-bot": {
          "name": "Support Bot",
          "botToken": "456:DEF...",
          "dmPolicy": "open"
        }
      }
    }
  },
  "bindings": [
    { "type": "route", "agentId": "agent-1", "match": { "channel": "telegram", "accountId": "main-bot" } },
    { "type": "route", "agentId": "agent-2", "match": { "channel": "telegram", "accountId": "support-bot" } }
  ]
}
```

### Key Behaviors (from OpenClaw source, HIGH confidence)

1. **Account ID normalization:** `normalizeAccountId()` trims and lowercases. The implicit single-bot account uses `DEFAULT_ACCOUNT_ID` (likely `"default"`).
2. **Config inheritance:** `mergeTelegramAccountConfig()` merges channel-level fields with account-level overrides. In multi-account setups, `groups` is NOT inherited to prevent cross-bot group routing failures (issue #30673).
3. **Binding match:** `AgentRouteBinding.match.accountId` is how OpenClaw routes inbound Telegram messages to the correct agent. Without `accountId`, the binding applies to the default account.
4. **Account listing:** `listTelegramAccountIds()` combines configured account IDs from `accounts` Record with bound account IDs from bindings. Returns `[DEFAULT_ACCOUNT_ID]` if empty.
5. **Status endpoint:** `channels.status` returns `channelAccounts.telegram` as `Record<accountId, ChannelAccountSnapshot>` -- the existing UI code already handles this shape.

## Competitor Feature Analysis

| Feature | AutoClaw (Zhipu) | MaxAuto Current | MaxAuto v1.1 Plan |
|---------|-----------------|-----------------|-------------------|
| Single Telegram bot | Yes | Yes (shipped) | Yes (preserved) |
| Multiple Telegram bots | Unknown (likely no -- focused on Feishu) | No | Yes (this milestone) |
| 1:1 agent binding | Unknown | Yes (single bot) | Yes (per bot) |
| Per-bot access control | Unknown | Yes (single bot) | Yes (per bot) |
| Bot validation (getMe) | Unknown | Yes | Yes (per bot) |
| Connection status | Unknown | Yes (single) | Yes (per bot) |
| Visual binding map | No | No | P2 differentiator |

## Sources

- OpenClaw source reference: `openclaw/src/config/types.telegram.ts` -- TelegramConfig, TelegramAccountConfig types (HIGH confidence)
- OpenClaw source reference: `openclaw/src/config/types.agents.ts` -- AgentRouteBinding, AgentBindingMatch types (HIGH confidence)
- OpenClaw source reference: `openclaw/src/telegram/accounts.ts` -- multi-account resolution, listing, merging (HIGH confidence)
- OpenClaw source reference: `openclaw/src/commands/agents.bindings.ts` -- binding CRUD with conflict detection (HIGH confidence)
- OpenClaw source reference: `openclaw/src/telegram/account-inspect.ts` -- per-account credential inspection (HIGH confidence)
- Existing MaxAuto code: `src/components/settings/IMChannelsSection.tsx` -- current single-bot implementation (HIGH confidence)
- Existing MaxAuto code: `src/api/config-helpers.ts` -- patchConfig merge-patch semantics (HIGH confidence)
- OpenClaw gateway protocol: `docs/gateway-protocol.md` -- channels.status, config.patch methods (HIGH confidence)

---
*Feature research for: Multi-bot Telegram management with 1:1 agent binding*
*Researched: 2026-03-15*
