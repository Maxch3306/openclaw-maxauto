# Phase 11: Bot Account Management - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can manage multiple Telegram bots through a card-based UI with full lifecycle control (add, remove, enable/disable) and strict 1:1 agent binding enforcement. Builds on Phase 10's account-scoped config layer. Per-bot access control settings (DM/group policies, allow-lists) are configured within the expanded card view.

</domain>

<decisions>
## Implementation Decisions

### Bot card layout & density
- Compact card per bot showing: @username, status indicator, bound agent name, enable/disable toggle
- Status shown as colored dots + text labels: green "Connected", orange "Disconnected", red "Error", gray "Disabled"
- Click card to expand — expanded view shows full settings (token, DM/group policy, access lists, agent binding dropdown)
- Cards stacked vertically in the Channels section, replacing the current single-form layout

### Add bot flow
- Modal dialog triggered by "Add Bot" button
- Dialog steps: token input → validate via getMe API → show bot @username → required agent dropdown (only unbound agents available) → Save
- Agent binding is required in the dialog — cannot add a bot without selecting an agent
- Token validation must succeed before agent dropdown appears
- 1:1 enforcement: dropdown filters out agents already bound to other bots, showing why they're unavailable

### Remove bot experience
- Detailed confirmation dialog showing: bot @username, bound agent name, configured access lists summary
- Explicit "Remove" button (not just "OK")
- Removing the last/only bot is allowed — Telegram section returns to empty state with "Add Bot" prompt
- Remove atomically deletes the account config entry AND its binding in a single patchConfig call

### Claude's Discretion
- Exact card component structure and styling
- Enable/disable toggle placement on compact card
- Empty state design when no bots configured
- Animation/transition for card expand/collapse

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `telegram-accounts.ts`: 7 helpers — getAccountConfigs, buildAccountConfig, buildUpdatedBindings, migrateToMultiAccount, normalizeAccountId, etc.
- `patchConfig()` + `waitForReconnect()` from config-helpers.ts
- `TagInput.tsx`: reusable chip-style input for access lists (Phase 8)
- Token validation via Telegram getMe API (Phase 7 pattern)
- `channels.status` response already returns per-account snapshots in `channelAccounts.telegram[]`

### Established Patterns
- Atomic config + binding writes via single `patchConfig` call
- Account IDs derived from bot @username (normalized lowercase)
- Existing IMChannelsSection.tsx has single-bot form — needs refactoring to card list
- Skills section uses expand-on-click card pattern (Phase 2-4) — similar UX target

### Integration Points
- `IMChannelsSection.tsx`: major refactor from single-form to multi-card
- `useChatStore` agents list: source for agent binding dropdown
- `channels.status` with `probe: true`: per-account connection status
- Config path: `channels.telegram.accounts.<id>` for per-bot settings

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-bot-account-management*
*Context gathered: 2026-03-15*
