# Phase 9: Channel-Agent Binding - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can bind a Telegram bot to a specific agent (1:1 mapping) so messages route to the correct agent. This is the final phase — converges Workspace (Phase 6) and Telegram (Phase 8) tracks.

</domain>

<decisions>
## Implementation Decisions

### Binding UI placement
- Agent binding dropdown placed after the bot token/status section, before access control lists
- Simple dropdown populated from the agent list
- Selecting an agent immediately creates/updates the binding in config

### Edge cases & display
- No binding: require selecting an agent before the bot can work — don't fall back to a default
- Deleted agent: show warning that the bound agent no longer exists, prompt user to rebind
- Binding is 1:1 — one Telegram bot maps to exactly one agent (decided at project level)

### Claude's Discretion
- Dropdown vs select component styling
- Warning message design for deleted/missing agent
- Whether binding change requires Save button or auto-saves on selection
- How to handle the `bindings[]` config array (add/update/remove entries)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IMChannelsSection.tsx`: Telegram settings with token, status, access control
- `useChatStore`: `agents` array with agent list
- `patchConfig()`: for config writes
- OpenClaw `bindings[]` config: `AgentBinding` with `match.channel: "telegram"` and `agentId`
- Research confirmed: `bindings` array in openclaw.json at root level

### Established Patterns
- Dropdown/select patterns exist in IMChannelsSection (dmPolicy, groupPolicy dropdowns)
- Agent list loaded from `useChatStore(s => s.agents)`
- Config changes via `patchConfig()` + `waitForReconnect()`

### Integration Points
- `IMChannelsSection.tsx`: add binding dropdown after status section
- Config path: `bindings[]` array at root of openclaw.json
- `AgentBinding` type: `{ match: { channel: "telegram" }, agentId: string }`
- Agent list from `useChatStore`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-channel-agent-binding*
*Context gathered: 2026-03-14*
