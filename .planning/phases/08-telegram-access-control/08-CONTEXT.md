# Phase 8: Telegram Access Control - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can configure DM and group allow-lists for the Telegram bot. This enhances the existing IMChannelsSection.tsx access control fields. Agent binding is Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Allow-list input UX
- Tag/chip-style inputs: each entry is a removable chip, with a text input to add new ones
- Replaces current comma-separated text inputs
- Batch save with explicit Save button — collect all changes, user clicks Save to apply
- Three separate fields matching OpenClaw's config:
  1. `allowFrom` — Telegram usernames allowed to DM the bot
  2. `groups` — Telegram group chat IDs the bot serves
  3. `groupAllowFrom` — Telegram usernames allowed to talk to the bot in groups

### Field labels & guidance
- Clear labels for each field + short inline help text below explaining what it controls
- Help text should clarify the distinction between the three fields

### Claude's Discretion
- Exact chip/tag component design (custom or pattern from existing UI)
- Help text wording
- How to handle invalid entries (empty strings, duplicates)
- Whether to show the DM policy / group policy dropdowns alongside or integrate them

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IMChannelsSection.tsx`: already has `allowFrom`, `groups`, `dmPolicy`, `groupPolicy` state + basic inputs
- `saveTelegramConfig()`: existing save function using `patchConfig()`
- `loadTelegramConfig()`: reads config on mount
- `TelegramConfig` interface: `allowFrom?: string[], groups?: string[]`
- Research flagged: `groupAllowFrom` field exists in OpenClaw but is NOT in the current UI

### Established Patterns
- Config save via `patchConfig()` + `waitForReconnect()` (Phase 1)
- Tag/chip pattern not yet established in the codebase — new for this phase
- Existing policy dropdowns (`dmPolicy`, `groupPolicy`) should remain

### Integration Points
- `IMChannelsSection.tsx`: replace text inputs with tag chip components
- Config path: `channels.telegram.accounts.default.allowFrom`, `.groups`, `.groupAllowFrom`
- `patchConfig()` for saving changes
- Research note: changes should take effect without gateway restart (config.patch handles auto-restart)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-telegram-access-control*
*Context gathered: 2026-03-14*
