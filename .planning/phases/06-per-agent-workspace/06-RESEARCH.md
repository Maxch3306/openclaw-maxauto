# Phase 6: Per-Agent Workspace - Research

**Researched:** 2026-03-14
**Domain:** OpenClaw agent config structure, per-agent workspace persistence, UI patterns
**Confidence:** HIGH

## Summary

Phase 6 enables users to set per-agent workspace directories. The OpenClaw gateway already fully supports per-agent workspace via the `agents.list[].workspace` field in `openclaw.json` and the `agents.update` method accepts a `workspace` parameter. The `agents.create` flow in the frontend already auto-generates per-agent workspace paths. The main work is UI: adding workspace controls to the EditAgentDialog, adding an agent workspace overview to WorkspaceSection, and ensuring the workspace field round-trips correctly through `agents.update`.

A critical finding is that `agents.list` (the gateway response from `listAgentsForGateway`) does NOT return workspace in its `GatewayAgentRow` type -- it only returns `{id, name, identity}`. To display per-agent workspace paths, the UI must read them from `config.get` (the raw config's `agents.list[].workspace`) or call a separate method. The simplest approach is to read workspace from `config.get` response where `agents.list[]` entries include the `workspace` field directly.

**Primary recommendation:** Use `agents.update` with `workspace` param for writes; read per-agent workspace from `config.get` response's `agents.list[]`; reuse the existing folder picker from `@tauri-apps/plugin-dialog`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Available in both locations:
  1. Agent edit dialog -- add workspace field alongside name/emoji/model
  2. Workspace settings section -- list agents with per-agent override controls
- Both locations use the same native folder picker and config write pattern
- In the Workspace settings section, list all agents below the default workspace path
- Each agent row shows: agent name, current workspace (default or custom path), change/reset action
- Users can see at a glance which agents use the default vs a custom workspace

### Claude's Discretion
- Agent list layout in Workspace section (table vs card list)
- How to show "reset to default" for agents with custom workspace
- Workspace field design in the edit agent dialog
- Whether to show workspace path in sidebar agent list

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WORK-02 | User can set a different workspace directory per agent | `agents.update` accepts `workspace` param; config stores in `agents.list[].workspace`; folder picker already installed from Phase 5 |
</phase_requirements>

## Standard Stack

### Already Available (No Install Needed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@tauri-apps/plugin-dialog` | ^2 | Native folder picker | Installed in Phase 5 |
| `@tauri-apps/plugin-fs` | ^2 | Directory existence check | Installed in Phase 5 |
| `patchConfig()` + `waitForReconnect()` | -- | Config write pattern | Phase 1 infrastructure |
| `gateway.request("agents.update")` | -- | Agent update including workspace | Existing gateway method |
| `gateway.request("config.get")` | -- | Read full config including per-agent workspace | Existing gateway method |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `agents.update` for workspace write | `patchConfig()` to write `agents.list[]` directly | `agents.update` is cleaner -- it normalizes the agent ID, resolves workspace, ensures workspace dir, writes config atomically |
| `config.get` for reading workspace | Adding workspace to `agents.list` gateway response | Would require OpenClaw gateway changes; `config.get` is available now |

## Architecture Patterns

### Key Data Flow

**Config structure** (`openclaw.json`):
```json
{
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw-maxauto/workspace"
    },
    "list": [
      { "id": "main" },
      { "id": "my-agent", "name": "My Agent", "workspace": "/custom/path" }
    ]
  }
}
```

**How OpenClaw resolves workspace** (`resolveAgentWorkspaceDir`):
1. Check `agents.list[].workspace` for the specific agent -- if set, use it
2. If agent is the default agent, fall back to `agents.defaults.workspace`
3. Otherwise, fall back to `{stateDir}/workspace-{agentId}`

This means: if an agent has no explicit `workspace` in its list entry, it uses the default workspace (for the default agent) or an auto-generated path (for non-default agents).

### Pattern: Reading Per-Agent Workspace from Config
**What:** Get each agent's workspace path to display in UI
**Why not from `agents.list` response:** The `GatewayAgentRow` type returned by `agents.list` only includes `{id, name, identity}` -- no workspace field.
**Solution:** Read from `config.get` and resolve workspace per agent.

```typescript
// Read full config to get agents.list with workspace fields
const { config } = await gateway.request<{
  config: {
    agents?: {
      defaults?: { workspace?: string };
      list?: Array<{ id: string; name?: string; workspace?: string }>;
    };
  };
  hash: string;
}>("config.get", {});

const defaultWorkspace = config.agents?.defaults?.workspace ?? "~/.openclaw-maxauto/workspace";
const agentList = config.agents?.list ?? [];

// For each agent, determine effective workspace
function getAgentWorkspace(agentId: string): { path: string; isCustom: boolean } {
  const entry = agentList.find(a => a.id === agentId);
  if (entry?.workspace) {
    return { path: entry.workspace, isCustom: true };
  }
  return { path: defaultWorkspace, isCustom: false };
}
```

### Pattern: Writing Per-Agent Workspace via agents.update
**What:** Set or change workspace for a specific agent
**How:** The `agents.update` gateway method accepts `{ agentId, workspace }`. It:
1. Validates params (agentId required, workspace optional NonEmptyString)
2. Calls `resolveUserPath()` on workspace to expand `~` paths
3. Calls `applyAgentConfig()` which writes to `agents.list[].workspace`
4. Writes config via `writeConfigFile()`
5. If workspace was set, calls `ensureAgentWorkspace()` to create the directory

```typescript
// Set per-agent workspace
await gateway.request("agents.update", {
  agentId: "my-agent",
  workspace: "/Users/me/projects/my-workspace",
});
// After update, reload agents + config to reflect changes
await loadAgents();
```

### Pattern: Resetting to Default Workspace
**What:** Remove per-agent workspace override so agent falls back to default
**Important caveat:** The `agents.update` schema requires workspace to be a `NonEmptyString` if provided. You cannot send `workspace: ""` or `workspace: null` to clear it. To reset, you must use `patchConfig` to set the agent's workspace to `null` (merge-patch delete semantics).

```typescript
// Reset agent workspace to default via patchConfig
// Find the agent's index in the list, then null out workspace
const { config } = await gateway.request<{
  config: { agents?: { list?: Array<{ id: string; workspace?: string }> } };
  hash: string;
}>("config.get", {});

const list = config.agents?.list ?? [];
const updatedList = list.map(entry =>
  entry.id === agentId ? { ...entry, workspace: null } : entry
);

await patchConfig({ agents: { list: updatedList } });
await waitForReconnect();
```

**Alternative simpler approach:** Set workspace to the default workspace path explicitly rather than nulling it. This is semantically equivalent for the user but leaves an explicit value in config.

### Pattern: EditAgentDialog with Folder Picker
**What:** Add workspace field to existing edit dialog with folder picker button
**Current state:** EditAgentDialog already has a plain text input for workspace. Replace with folder picker.

```typescript
import { open } from "@tauri-apps/plugin-dialog";

// In EditAgentDialog, replace text input with path display + Change button
async function handlePickWorkspace() {
  const selected = await open({ directory: true, title: "Select Agent Workspace" });
  if (selected) {
    setWorkspace(selected);
  }
}
```

### Pattern: WorkspaceSection Agent List
**What:** Add agent workspace overview below the default workspace section.

```typescript
// Below the existing default workspace section in WorkspaceSection.tsx
<section className="mb-6">
  <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">
    Per-Agent Workspaces
  </h2>
  {agents.map(agent => (
    <div key={agent.agentId} className="...">
      <span>{agent.emoji} {agent.name}</span>
      <span className="font-mono text-sm">{workspace.path}</span>
      {workspace.isCustom ? (
        <button onClick={() => resetWorkspace(agent.agentId)}>Reset to Default</button>
      ) : (
        <span className="text-muted">Using default</span>
      )}
      <button onClick={() => changeWorkspace(agent.agentId)}>Change</button>
    </div>
  ))}
</section>
```

### Recommended File Changes
```
src/components/settings/WorkspaceSection.tsx  # Add agent workspace list
src/components/chat/EditAgentDialog.tsx        # Replace text input with folder picker
src/stores/chat-store.ts                       # Update Agent type, updateAgent to handle workspace
```

### Anti-Patterns to Avoid
- **Don't use `agents.update` to clear workspace:** The schema requires `NonEmptyString` for workspace. Use `patchConfig` with `null` to delete.
- **Don't assume `agents.list` response includes workspace:** `GatewayAgentRow` only has `{id, name, identity}`. Read workspace from `config.get`.
- **Don't modify the default workspace in this phase:** Phase 5 handles that. Phase 6 only sets per-agent overrides.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Folder picker | Custom input for typing paths | `@tauri-apps/plugin-dialog` `open({ directory: true })` | Already installed, native UX |
| Workspace directory creation | Manual mkdir after setting path | `agents.update` with workspace | Gateway calls `ensureAgentWorkspace()` automatically |
| Workspace resolution logic | Re-implement fallback logic in frontend | Read from `config.get` + gateway resolves at runtime | Gateway already has resolution logic |

## Common Pitfalls

### Pitfall 1: Assuming agents.list Returns Workspace
**What goes wrong:** Try to read workspace from `agents.list` gateway response, get `undefined` for all agents.
**Why it happens:** `GatewayAgentRow` type only includes `{id, name, identity}` -- no workspace field.
**How to avoid:** Read workspace paths from `config.get` response's `agents.list[]` entries, which DO include workspace.
**Warning signs:** All agents showing "no workspace" or default workspace even when custom is configured.

### Pitfall 2: Cannot Clear Workspace via agents.update
**What goes wrong:** Trying to reset per-agent workspace by sending empty/null workspace to `agents.update` fails validation.
**Why it happens:** `AgentsUpdateParamsSchema` defines workspace as `Type.Optional(NonEmptyString)` -- you can omit it, but can't send empty string.
**How to avoid:** Use `patchConfig` with merge-patch semantics to null out the workspace field, OR set it to the default workspace path explicitly.
**Warning signs:** Validation error when trying to reset workspace.

### Pitfall 3: Workspace Not Reflecting After agents.update
**What goes wrong:** UI shows old workspace after update.
**Why it happens:** `agents.update` calls `writeConfigFile()` which triggers gateway restart, but `agents.update` (unlike `patchConfig`) does NOT trigger the restart response pattern. Need to reload.
**How to avoid:** After `agents.update`, call `loadAgents()` (already done in current code) AND reload config to get updated workspace paths.
**Warning signs:** Stale workspace paths until manual refresh.

### Pitfall 4: Default Agent Workspace Resolution
**What goes wrong:** Default agent ("main") shows different workspace than expected.
**Why it happens:** Default agent has special fallback: `agents.list[].workspace` -> `agents.defaults.workspace` -> `resolveDefaultAgentWorkspaceDir()`. Non-default agents fall back differently: `agents.list[].workspace` -> `{stateDir}/workspace-{agentId}`.
**How to avoid:** For the default agent, if no per-agent workspace is set, display the `agents.defaults.workspace` value (from Phase 5). For non-default agents, note that the auto-generated path may differ.
**Warning signs:** Default agent showing `~/.openclaw-maxauto/workspace` while non-default agents show `~/.openclaw-maxauto/workspace-{id}`.

### Pitfall 5: EditAgentDialog Already Has Workspace Input
**What goes wrong:** Duplicate workspace UI or conflicting patterns.
**Why it happens:** `EditAgentDialog.tsx` already has a plain text `<input>` for workspace (line 103-110).
**How to avoid:** Replace the text input with a proper folder picker display + Change button, not add a second field.
**Warning signs:** Two workspace inputs visible in the dialog.

## Code Examples

### agents.update Protocol Schema (verified from OpenClaw source)
```typescript
// From openclaw/src/gateway/protocol/schema/agents-models-skills.ts
// AgentsUpdateParamsSchema:
// {
//   agentId: NonEmptyString (required),
//   name: Optional(NonEmptyString),
//   workspace: Optional(NonEmptyString),
//   model: Optional(NonEmptyString),
//   avatar: Optional(String),
// }
```

### agents.update Server Handler (verified from OpenClaw source)
```typescript
// From openclaw/src/gateway/server-methods/agents.ts
// Key behavior:
// 1. Validates params
// 2. Normalizes agentId
// 3. Resolves workspace via resolveUserPath() (expands ~)
// 4. Calls applyAgentConfig() which writes to agents.list[].workspace
// 5. Writes config via writeConfigFile()
// 6. If workspace provided, calls ensureAgentWorkspace() to create dir
```

### resolveAgentWorkspaceDir Logic (verified from OpenClaw source)
```typescript
// From openclaw/src/agents/agent-scope.ts
// 1. Check agents.list[].workspace for specific agent -> if set, use it
// 2. If agent is default agent: fall back to agents.defaults.workspace
// 3. If agent is non-default: fall back to {stateDir}/workspace-{agentId}
```

### Current createAgent Already Sets Workspace
```typescript
// From src/stores/chat-store.ts (current code)
createAgent: async (params) => {
  const agentId = params.name.trim().toLowerCase()
    .replace(/[^a-z0-9-]/g, "-").replace(/^-+/, "").replace(/-+$/, "").slice(0, 64) || "agent";
  const platform = await getPlatformInfo();
  const workspace = `${platform.maxauto_dir}/workspace-${agentId}`;
  await gateway.request("agents.create", { ...params, workspace });
  await get().loadAgents();
},
```

### Current updateAgent (already supports workspace)
```typescript
// From src/stores/chat-store.ts (current code)
updateAgent: async (params) => {
  // params: { agentId, name?, emoji?, workspace? }
  await gateway.request("agents.update", params);
  await get().loadAgents();
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-agent workspace as plain text input | Folder picker with path display | This phase | Better UX, prevents path typos |
| No workspace visibility in settings | Agent workspace list in WorkspaceSection | This phase | Users can see all agents' workspaces at a glance |
| Workspace only set at agent creation | Workspace changeable via edit dialog + settings | This phase | Full WORK-02 requirement |

## Open Questions

1. **Reset to default mechanism**
   - What we know: `agents.update` cannot accept empty workspace (NonEmptyString validation). `patchConfig` with null can delete the field.
   - What's unclear: Whether `patchConfig` correctly handles nulling a specific array entry's field.
   - Recommendation: For reset, use `patchConfig` to write the full `agents.list` array with the target agent's workspace removed. Alternatively, set workspace to the default path explicitly (simpler, no null semantics needed).

2. **Config.get response typing for agents.list workspace**
   - What we know: The raw config has `agents.list[].workspace` as a string field.
   - What's unclear: Whether `config.get` returns the raw config or a processed version.
   - Recommendation: Test with `config.get` in dev mode. The gateway returns the raw parsed config, so workspace should be present when set.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual testing (no automated test framework configured) |
| Config file | none |
| Quick run command | `pnpm build` |
| Full suite command | `pnpm build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORK-02 | Set per-agent workspace via folder picker in edit dialog | manual-only | N/A -- requires Tauri + gateway + native dialog | N/A |
| WORK-02 | View agent workspaces in settings section (default vs custom) | manual-only | N/A -- requires Tauri + gateway | N/A |
| WORK-02 | Per-agent workspace persists across gateway restarts | manual-only | N/A -- requires gateway restart cycle | N/A |

**Justification for manual-only:** All behaviors require running Tauri app with active gateway connection and native OS dialog interaction. `pnpm build` validates TypeScript correctness.

### Sampling Rate
- **Per task commit:** `pnpm build`
- **Per wave merge:** `pnpm build` + manual verification in dev mode
- **Phase gate:** Manual walkthrough: set workspace per agent, restart gateway, verify persistence

### Wave 0 Gaps
None -- no automated test infrastructure applicable for this UI/native integration phase.

## Sources

### Primary (HIGH confidence)
- OpenClaw source: `openclaw/src/gateway/server-methods/agents.ts` -- `agents.update` handler, workspace write logic
- OpenClaw source: `openclaw/src/agents/agent-scope.ts` -- `resolveAgentWorkspaceDir()`, `resolveAgentConfig()`, workspace resolution fallback chain
- OpenClaw source: `openclaw/src/commands/agents.config.ts` -- `applyAgentConfig()`, how workspace is stored in `agents.list[]`
- OpenClaw source: `openclaw/src/gateway/protocol/schema/agents-models-skills.ts` -- `AgentsUpdateParamsSchema` (workspace is `Optional(NonEmptyString)`)
- OpenClaw source: `openclaw/src/shared/session-types.ts` -- `GatewayAgentRow` type (no workspace field)
- OpenClaw source: `openclaw/src/gateway/session-utils.ts` -- `listAgentsForGateway()` (does not include workspace in response)
- Existing codebase: `EditAgentDialog.tsx`, `WorkspaceSection.tsx`, `chat-store.ts`, `config-helpers.ts`

### Secondary (MEDIUM confidence)
- Phase 5 research: `05-RESEARCH.md` -- folder picker patterns, config write patterns

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already installed from Phase 5, no new packages
- Architecture: HIGH -- verified exact OpenClaw config structure, gateway methods, and data types from source
- Pitfalls: HIGH -- verified from actual OpenClaw protocol schema that workspace cannot be empty-string cleared via agents.update

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable OpenClaw gateway protocol)
