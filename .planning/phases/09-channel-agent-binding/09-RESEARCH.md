# Phase 9: Channel-Agent Binding - Research

**Researched:** 2026-03-15
**Domain:** OpenClaw config bindings, Telegram agent routing, React UI integration
**Confidence:** HIGH

## Summary

Channel-agent binding connects a Telegram bot to a specific agent by writing entries to the `bindings[]` array at the root of `openclaw.json`. OpenClaw's routing system (`resolveAgentRoute`) reads this array on every inbound message to determine which agent handles it. The simplest binding for a Telegram channel-level match is `{ agentId: "some-agent", match: { channel: "telegram" } }` -- no `type` field needed (defaults to "route").

The existing `IMChannelsSection.tsx` already has the patterns needed: it reads config via `gateway.request("config.get")`, writes via `patchConfig()`, and uses `select` dropdowns for policy fields. The agent list is available from `useChatStore(s => s.agents)`. The implementation is straightforward: add a dropdown after the status section, read the current binding from the config's `bindings[]` array, and write back the full array when the user selects an agent.

**Primary recommendation:** Read `bindings[]` from `config.get`, find the entry with `match.channel === "telegram"`, display the bound `agentId` in a dropdown, and on change write the full `bindings` array back via `patchConfig({ bindings: [...] })`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Agent binding dropdown placed after the bot token/status section, before access control lists
- Simple dropdown populated from the agent list
- Selecting an agent immediately creates/updates the binding in config
- No binding: require selecting an agent before the bot can work -- don't fall back to a default
- Deleted agent: show warning that the bound agent no longer exists, prompt user to rebind
- Binding is 1:1 -- one Telegram bot maps to exactly one agent

### Claude's Discretion
- Dropdown vs select component styling
- Warning message design for deleted/missing agent
- Whether binding change requires Save button or auto-saves on selection
- How to handle the `bindings[]` config array (add/update/remove entries)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TELE-04 | User can bind a Telegram bot to a specific agent (1:1 mapping) | Binding type structure confirmed (`AgentRouteBinding`), config path confirmed (`bindings[]` at root), routing flow verified (`resolveAgentRoute` matches `binding.channel`), patchConfig can write full array |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI framework | Already in project |
| Zustand | 5 | State (agent list access) | Already in project via `useChatStore` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (installed) | Icons | Warning icon for deleted agent |

No new libraries needed. Everything required is already available in the project.

## Architecture Patterns

### OpenClaw Binding Data Model (verified from source)

The `AgentBinding` type is a union of `AgentRouteBinding | AgentAcpBinding`. For our 1:1 Telegram binding, we use `AgentRouteBinding`:

```typescript
// Source: openclaw/src/config/types.agents.ts
type AgentRouteBinding = {
  type?: "route";  // Optional -- missing type defaults to "route"
  agentId: string;
  comment?: string;
  match: {
    channel: string;       // "telegram"
    accountId?: string;    // Optional -- omit for single-account
    peer?: { kind: ChatType; id: string };  // Optional -- omit for channel-level
    guildId?: string;
    teamId?: string;
    roles?: string[];
  };
};
```

The minimal binding for a single Telegram bot:
```json
{
  "agentId": "my-agent",
  "match": { "channel": "telegram" }
}
```

### Config Structure

The `bindings` field is at the root of `OpenClawConfig`:
```typescript
// Source: openclaw/src/config/types.openclaw.ts line 101
bindings?: AgentBinding[];
```

### Routing Resolution Flow (verified from source)

1. Telegram message arrives -> `resolveTelegramConversationRoute()` in `telegram/conversation-route.ts`
2. Calls `resolveAgentRoute()` in `routing/resolve-route.ts` with `channel: "telegram"`
3. `resolveAgentRoute` iterates binding tiers in priority order:
   - `binding.peer` (specific peer match)
   - `binding.peer.parent` (thread parent)
   - `binding.guild+roles` (Discord-specific)
   - `binding.guild` (Discord-specific)
   - `binding.team` (Teams-specific)
   - `binding.account` (specific account)
   - `binding.channel` (channel-level, our case)
4. If no binding matches, falls back to default agent
5. The binding's `agentId` is resolved via `pickFirstExistingAgentId()` which validates the agent exists

**Key insight for TELE-04:** A binding with `match: { channel: "telegram" }` and no `accountId` matches at the `binding.channel` tier -- the broadest match. This is correct for single-Telegram-bot setups.

### patchConfig and bindings[] Array Semantics

**CRITICAL:** `patchConfig` uses RFC 7396 merge-patch semantics. For arrays, merge-patch replaces the entire array -- it does NOT merge individual array elements. This means:

```typescript
// This REPLACES the entire bindings array (correct behavior for our use case)
await patchConfig({
  bindings: [{ agentId: "new-agent", match: { channel: "telegram" } }]
});
```

We must read the current `bindings[]`, modify the relevant entry, and write the full array back.

### Pattern: Reading and Modifying Bindings

```typescript
// 1. Read current config
const { config } = await gateway.request<{
  config: { bindings?: Array<{ agentId: string; match: { channel: string }; [key: string]: unknown }> };
}>("config.get", {});

// 2. Find existing telegram binding
const bindings = config.bindings ?? [];
const existingIdx = bindings.findIndex(b => b.match?.channel === "telegram");

// 3. Update or add
const newBinding = { agentId: selectedAgentId, match: { channel: "telegram" } };
const updated = [...bindings];
if (existingIdx >= 0) {
  updated[existingIdx] = newBinding;
} else {
  updated.push(newBinding);
}

// 4. Write back full array
await patchConfig({ bindings: updated });
```

### Pattern: Detecting Deleted/Missing Agent

```typescript
const agents = useChatStore(s => s.agents);
const currentBinding = bindings.find(b => b.match?.channel === "telegram");
const boundAgentId = currentBinding?.agentId;
const boundAgentExists = boundAgentId ? agents.some(a => a.agentId === boundAgentId) : true;
// If !boundAgentExists && boundAgentId, show warning
```

### UI Placement in IMChannelsSection

The dropdown goes after the Status Detail section and before the Config Form fields. Looking at the component structure (lines 375-395 for status detail, lines 396+ for config form), the binding dropdown should be placed as the first field inside the config form `<div>`, before the Bot Token field.

Wait -- the CONTEXT.md says "after the bot token/status section, before access control lists." So the order is:
1. Header (status dot, bot username, refresh)
2. Status Detail (connected since, last message)
3. Bot Token field
4. **Agent Binding dropdown** <-- here
5. DM Policy
6. DM Allow-List
7. Group Policy
8. Group Allow-Lists
9. Actions (Save/Disable)

### Anti-Patterns to Avoid
- **Don't modify the binding on every dropdown change without saving:** The CONTEXT.md says "selecting an agent immediately creates/updates the binding" but also gives discretion on save-vs-auto-save. Given the existing pattern uses a Save button, binding should be included in the save flow for consistency.
- **Don't write partial binding objects:** Always write the full `bindings` array since merge-patch replaces arrays wholesale.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config writing | Custom fetch/file write | `patchConfig()` from `config-helpers.ts` | Handles hash-based optimistic locking, gateway restart |
| Agent list | Custom gateway call | `useChatStore(s => s.agents)` | Already loaded and cached |
| Reconnect wait | Manual polling | `waitForReconnect()` | Existing helper with timeout |

## Common Pitfalls

### Pitfall 1: Array merge-patch replaces, doesn't merge
**What goes wrong:** Writing `{ bindings: [telegramBinding] }` when other non-telegram bindings exist would delete them.
**Why it happens:** RFC 7396 merge-patch replaces arrays entirely.
**How to avoid:** Always read the full `bindings[]` array first, modify only the telegram entry, write the complete array back.
**Warning signs:** Other channel bindings disappearing after saving telegram binding.

### Pitfall 2: Agent list not loaded when IMChannelsSection mounts
**What goes wrong:** Dropdown shows empty or "No agents" when agents haven't loaded yet.
**Why it happens:** `useChatStore` loads agents on app mount, but timing isn't guaranteed.
**How to avoid:** Call `loadAgents()` if `agents.length === 0` on mount, or show loading state.
**Warning signs:** Empty dropdown on first render.

### Pitfall 3: Binding agentId doesn't match any existing agent
**What goes wrong:** Config has `agentId: "deleted-agent"` but that agent no longer exists.
**Why it happens:** User deleted the agent after binding it.
**How to avoid:** Cross-check binding's `agentId` against the agent list, show warning.
**Warning signs:** OpenClaw falls back to default agent silently (via `pickFirstExistingAgentId`).

### Pitfall 4: Writing binding before bot token is set
**What goes wrong:** Binding exists but Telegram channel isn't configured, confusing state.
**Why it happens:** User selects agent before entering bot token.
**How to avoid:** Only show binding dropdown when `isConfigured` (bot token exists). Or include binding in the same save flow.

## Code Examples

### Reading current telegram binding from config
```typescript
// Source: verified against openclaw/src/config/types.openclaw.ts and config-helpers.ts
interface BindingEntry {
  type?: string;
  agentId: string;
  comment?: string;
  match: { channel: string; accountId?: string; [key: string]: unknown };
}

async function loadCurrentBinding(): Promise<string | null> {
  const { config } = await gateway.request<{
    config: { bindings?: BindingEntry[] };
  }>("config.get", {});
  const binding = (config.bindings ?? []).find(
    b => b.match?.channel === "telegram"
  );
  return binding?.agentId ?? null;
}
```

### Writing telegram binding via patchConfig
```typescript
// Source: verified pattern from config-helpers.ts and existing saveTelegramConfig
async function saveTelegramBinding(agentId: string, currentBindings: BindingEntry[]) {
  const otherBindings = currentBindings.filter(b => b.match?.channel !== "telegram");
  const updated = [
    ...otherBindings,
    { agentId, match: { channel: "telegram" } },
  ];
  await patchConfig({ bindings: updated });
  await waitForReconnect();
}
```

### Dropdown component pattern (matches existing select style)
```tsx
// Source: follows IMChannelsSection.tsx select pattern (lines 451-461)
<div>
  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
    Agent
  </label>
  <select
    value={boundAgentId ?? ""}
    onChange={(e) => setBoundAgentId(e.target.value || null)}
    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
  >
    <option value="">Select an agent...</option>
    {agents.map((a) => (
      <option key={a.agentId} value={a.agentId}>
        {a.emoji ? `${a.emoji} ` : ""}{a.name}
      </option>
    ))}
  </select>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | `bindings[]` at config root | Current OpenClaw | Standard routing mechanism |
| `type: "route"` required | `type` field optional (defaults to "route") | Current | Simpler binding objects |

## Open Questions

1. **Should binding auto-save or use the existing Save button?**
   - What we know: CONTEXT.md gives discretion. Existing pattern uses Save button for all telegram config.
   - Recommendation: Include binding in the existing Save flow for consistency. User clicks "Validate & Save" to persist both token + binding.

2. **Should we preserve non-telegram bindings when writing?**
   - What we know: merge-patch replaces arrays. Other bindings could exist.
   - Recommendation: YES -- always read full array, filter telegram, append updated telegram binding, write back.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None -- MaxAuto has no test infrastructure |
| Config file | none |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TELE-04 | Binding dropdown shows agents, saves binding to config | manual-only | Manual verification: select agent, check config, verify routing | N/A |

**Justification for manual-only:** MaxAuto has zero test infrastructure. Setting up a test framework is out of scope for this final phase. The binding is a simple UI-to-config write that can be verified by inspecting the config after save.

### Sampling Rate
- **Per task commit:** Manual: open Settings > Channels, verify dropdown appears with agents
- **Per wave merge:** Manual: select agent, save, verify `bindings` in config via gateway
- **Phase gate:** Verify binding persists and new Telegram messages route to selected agent

### Wave 0 Gaps
None -- manual verification only for this phase.

## Sources

### Primary (HIGH confidence)
- `openclaw/src/config/types.agents.ts` -- AgentBinding, AgentRouteBinding, AgentBindingMatch types
- `openclaw/src/config/types.openclaw.ts` -- `bindings?: AgentBinding[]` at root of OpenClawConfig
- `openclaw/src/config/bindings.ts` -- listConfiguredBindings, listRouteBindings helpers
- `openclaw/src/routing/resolve-route.ts` -- Full routing resolution with tier-based matching
- `openclaw/src/telegram/conversation-route.ts` -- Telegram-specific routing calling resolveAgentRoute
- `src/components/settings/IMChannelsSection.tsx` -- Existing UI patterns, config read/write
- `src/stores/chat-store.ts` -- Agent interface, loadAgents, agents state
- `src/api/config-helpers.ts` -- patchConfig and waitForReconnect helpers

### Secondary (MEDIUM confidence)
- None needed -- all findings from primary source code inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, verified all existing code
- Architecture: HIGH -- read OpenClaw routing source directly, confirmed binding structure and resolution
- Pitfalls: HIGH -- derived from actual merge-patch semantics and code patterns

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- config structure unlikely to change)
