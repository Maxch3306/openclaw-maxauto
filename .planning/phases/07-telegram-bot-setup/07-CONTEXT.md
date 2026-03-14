# Phase 7: Telegram Bot Setup - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can enter a Telegram bot token and see connection status. This enhances the existing IMChannelsSection.tsx with token validation and better status display. Access control (allow-lists) is Phase 8, agent binding is Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Token validation
- Validate token via Telegram Bot API probe (getMe) before saving
- On success: show bot username + auto-save the token
- On failure: show error explaining invalid token, don't save
- Validation happens client-side or via gateway — Claude decides implementation

### Connection status display
- Load-time check only (not live/real-time), with manual refresh option
- Detailed status: connected/disconnected/error color + bot username + last connected time
- Status fetched from `channels.status` gateway API on page load

### Relationship to existing UI
- Enhance the existing IMChannelsSection.tsx — don't rewrite from scratch
- Improve the token input UX (add validation feedback)
- Add/improve the status display section
- Keep existing DM/group policy and pairing functionality intact

### Claude's Discretion
- Whether to use gateway or direct Telegram API for token validation
- Status indicator styling (dot, badge, icon)
- Layout of bot info display after validation
- Refresh button placement and style

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IMChannelsSection.tsx` (~250 lines): already has bot token input, DM/group policies, allow-from, pairing
- `channelStatus` state: already loads from `channels.status` gateway API
- `TelegramConfig` interface: botToken, dmPolicy, groupPolicy, allowFrom, groups
- `ChannelAccountSnapshot` interface: enabled, configured, linked, status, label
- `patchConfig()` from config-helpers.ts: for config writes (Phase 1)
- `loadTelegramConfig()` and `loadChannelStatus()`: existing data loading functions

### Established Patterns
- IMChannelsSection reads config via `gateway.request("config.get")` and status via `channels.status`
- Token saved to `channels.telegram.accounts.default.botToken` in config
- Uses `patchConfig()` for config writes (already migrated in Phase 1)

### Integration Points
- `IMChannelsSection.tsx`: enhance token input section + add status display
- `channels.status` gateway API: returns per-channel connection info
- Telegram Bot API `getMe`: for token validation (returns bot info if valid)
- SettingsPage.tsx already wires `"im-channels"` tab to IMChannelsSection

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-telegram-bot-setup*
*Context gathered: 2026-03-14*
