# Phase 6: Per-Agent Workspace - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can assign different workspace directories to individual agents. This extends the Phase 5 Workspace section and the existing agent edit dialog. Workspace must persist across gateway restarts.

</domain>

<decisions>
## Implementation Decisions

### Where to set per-agent workspace
- Available in both locations:
  1. Agent edit dialog — add workspace field alongside name/emoji/model
  2. Workspace settings section — list agents with per-agent override controls
- Both locations use the same native folder picker and config write pattern

### Default vs custom indicator
- In the Workspace settings section, list all agents below the default workspace path
- Each agent row shows: agent name, current workspace (default or custom path), change/reset action
- Users can see at a glance which agents use the default vs a custom workspace

### Claude's Discretion
- Agent list layout in Workspace section (table vs card list)
- How to show "reset to default" for agents with custom workspace
- Workspace field design in the edit agent dialog
- Whether to show workspace path in sidebar agent list

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkspaceSection.tsx` (Phase 5): default workspace display with folder picker and open button
- `EditAgentDialog.tsx`: existing dialog for agent name/emoji/model editing
- `@tauri-apps/plugin-dialog` `open({ directory: true })`: already installed
- `patchConfig()` + `waitForReconnect()`: config write pattern
- `useChatStore`: agents state, agent CRUD actions

### Established Patterns
- Agent config in openclaw.json: `agents.list[].workspace` or `agents.perAgent.{agentId}.workspace`
- CONCERNS.md flagged: per-agent workspace not persisted to config (only runtime state)
- Chat store `setAgentModel()` writes to `config.agents.defaults.model` — similar pattern needed for workspace

### Integration Points
- `WorkspaceSection.tsx`: add agent workspace list below default section
- `EditAgentDialog.tsx`: add workspace field
- Config path: needs research on exact OpenClaw config structure for per-agent workspace
- `agents.update` or `patchConfig` for persisting per-agent workspace

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-per-agent-workspace*
*Context gathered: 2026-03-14*
