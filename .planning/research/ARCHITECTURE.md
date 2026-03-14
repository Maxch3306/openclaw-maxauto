# Architecture Patterns

**Domain:** Desktop app feature integration (Telegram channels, skills, workspace config)
**Researched:** 2026-03-14

## Recommended Architecture

All three features follow the same integration pattern: they read/write sections of `openclaw.json` (the OpenClaw gateway config file at `~/.openclaw-maxauto/config/openclaw.json`) and use gateway WebSocket methods for runtime operations. No new Rust backend commands are needed -- the existing `config.rs` (read/write) and gateway WebSocket protocol provide everything.

### High-Level Data Flow

```
User Action (React UI)
  |
  v
Zustand Store Action (settings-store.ts)
  |
  +--[config read]--> gateway.request("config.get") --> WebSocket --> OpenClaw Gateway
  |
  +--[config write]--> readConfig() (Tauri IPC) --> merge changes --> writeConfig() (Tauri IPC)
  |                     --> stopGateway() --> startGateway() --> gateway.reconnect()
  |
  +--[runtime query]--> gateway.request("skills.status"|"channels.status") --> WebSocket
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `IMChannelsSection.tsx` (existing) | Telegram bot token, DM/group policy, pairing UI | gateway WebSocket (`config.get`, `config.set`, `channels.status`), Tauri IPC (pairing commands) |
| `SkillsSection.tsx` (new) | List skills, toggle enabled/disabled, install skills, configure API keys | gateway WebSocket (`skills.status`, `skills.install`, `skills.update`) |
| `WorkspaceSection.tsx` (new) | Per-agent workspace directory, default workspace | gateway WebSocket (`config.get`), Tauri IPC (`readConfig`, `writeConfig`), Tauri dialog (folder picker) |
| `settings-store.ts` (extended) | State for channels config, skills list, workspace path | gateway WebSocket, Tauri IPC |
| `tauri-commands.ts` (extended) | Folder picker dialog wrapper | Tauri `dialog` plugin |
| `SettingsPage.tsx` (modified) | Route to new section components | Zustand store |

## Feature 1: Telegram Channel Management

### Current State

`IMChannelsSection.tsx` already implements:
- Bot token entry and save
- DM policy selection (open/allowlist/pairing/disabled)
- Group policy selection (open/allowlist/disabled)
- AllowFrom user IDs
- Pairing request approval/rejection (via Rust `pairing.rs`)
- Channel status display (via `channels.status` gateway method)
- Config persistence via `config.set` gateway method (NOT Tauri IPC `writeConfig`)

### What Needs to Change

The existing implementation is already functional. Enhancements needed:

1. **Channel-agent binding** -- Map a Telegram bot to a specific agent using OpenClaw's `bindings` config array. The binding structure from `types.agents.ts`:
```typescript
{
  type: "route",
  agentId: "my-agent",
  match: {
    channel: "telegram",
    accountId?: "default",  // for multi-account
    peer?: { kind: "dm" | "group", id: "123456" }
  }
}
```
This goes into `config.bindings[]` (top-level array in openclaw.json).

2. **Multi-account support** -- OpenClaw's `TelegramConfig` supports `accounts?: Record<string, TelegramAccountConfig>` for multiple bots. Current UI assumes single account. For v1, keep single account but structure the config to be forward-compatible.

3. **Streaming mode toggle** -- Expose `streaming` option ("off" | "partial" | "block") which controls how the bot sends responses in Telegram.

### Data Flow: Save Telegram Config with Binding

```
User clicks "Save" in IMChannelsSection
  |
  v
1. gateway.request("config.get") --> get current config + hash
2. Merge channels.telegram section with new values
3. Merge bindings[] array: upsert binding for selected agent
4. gateway.request("config.set", { raw, baseHash }) --> atomic write with optimistic locking
5. Restart gateway (stop -> start -> reconnect)
6. Reload config + channel status
```

**Key observation:** `IMChannelsSection` uses `config.set` (gateway WebSocket) for writes, while `settings-store.ts` model actions use `readConfig`/`writeConfig` (Tauri IPC). Both approaches work. Use the gateway `config.set` approach for channels because it supports `baseHash` optimistic locking, preventing concurrent write conflicts.

### OpenClaw Config Shape (Telegram)

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "123:ABC...",
      "dmPolicy": "pairing",
      "groupPolicy": "disabled",
      "allowFrom": ["123456"],
      "streaming": "partial"
    }
  },
  "bindings": [
    {
      "type": "route",
      "agentId": "main",
      "match": { "channel": "telegram" }
    }
  ]
}
```

## Feature 2: Skills Management

### OpenClaw Skills Architecture

Skills in OpenClaw are markdown files (`SKILL.md`) in specific directories. They define tool descriptions that get injected into the agent's system prompt. OpenClaw has three skill sources:

1. **Bundled skills** -- shipped with OpenClaw in `skills/` directory (50+ skills: weather, github, discord, slack, coding-agent, etc.)
2. **Managed skills** -- installed via `skills.install` into the workspace
3. **Workspace skills** -- user-created skills in the agent workspace

### Gateway API (Already Available)

| Method | Purpose | Response Shape |
|--------|---------|---------------|
| `skills.status` | List all skills with enabled/installed state | `{ skills: SkillEntry[], counts: {...} }` |
| `skills.install` | Install a skill by name + installId | `{ ok, message, ... }` |
| `skills.update` | Toggle enabled, set API key, set env vars | `{ ok, skillKey, config }` |
| `skills.bins` | List binary dependencies for all skills | `{ bins: string[] }` |

The `skills.status` response includes per-skill metadata:
- `name`, `description`, `emoji`
- `source` (bundled/managed/workspace)
- `enabled` (boolean)
- `requires.bins` (required system binaries)
- `install` specs (how to install dependencies)
- `apiKey` requirement

### Config Shape (Skills)

```json
{
  "skills": {
    "allowBundled": ["weather", "github", "coding-agent"],
    "entries": {
      "weather": { "enabled": true },
      "github": { "enabled": true, "apiKey": "ghp_..." },
      "openai-whisper": { "enabled": false }
    },
    "install": { "nodeManager": "pnpm" },
    "load": { "extraDirs": [], "watch": true }
  }
}
```

Per-agent skill allowlists are set on `agents.list[].skills: string[]` or `agents.defaults.skills`.

### Recommended UI Components

```
SkillsSection.tsx
  |
  +-- SkillCard.tsx (individual skill: name, emoji, description, toggle, config)
  |
  +-- SkillConfigDialog.tsx (API key entry, env vars)
  |
  +-- InstallSkillDialog.tsx (install progress for managed skills)
```

### Data Flow: Toggle Skill

```
User toggles skill switch
  |
  v
1. gateway.request("skills.update", { skillKey: "weather", enabled: true })
   --> OpenClaw writes to openclaw.json internally, responds { ok: true }
2. No gateway restart needed! skills.update writes config directly.
3. Refresh UI: gateway.request("skills.status") --> update store
```

**Critical insight:** `skills.update` writes config AND responds without requiring a gateway restart. This is different from Telegram config changes which require restart. Skills can be toggled live.

### Data Flow: Install Skill

```
User clicks "Install" on a skill
  |
  v
1. gateway.request("skills.install", { name: "spotify-player", installId: "brew-spotify-player" })
   --> OpenClaw runs installation (may take 30-60s)
   --> Responds with { ok, message }
2. Refresh: gateway.request("skills.status") --> update store
```

## Feature 3: Workspace Configuration

### OpenClaw Workspace Concept

The workspace is the working directory for agent code execution. It determines:
- Where the agent's `AGENTS.md`, `BOOTSTRAP.md`, `HEARTBEAT.md` files live
- The cwd for tool execution (bash commands, file operations)
- Where workspace-local skills are discovered

### Config Shape

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw-maxauto/workspace"
    },
    "list": [
      {
        "id": "main",
        "name": "Main",
        "workspace": "/path/to/specific/project"
      }
    ]
  }
}
```

- `agents.defaults.workspace` -- default for all agents
- `agents.list[].workspace` -- per-agent override

### Recommended UI

```
WorkspaceSection.tsx
  |
  +-- Default workspace path (folder picker via Tauri dialog)
  |
  +-- Per-agent workspace list (shows each agent with its workspace)
  |
  +-- "Open in Explorer/Finder" button
```

### Data Flow: Change Workspace

```
User clicks folder picker --> selects directory
  |
  v
1. readConfig() via Tauri IPC
2. Merge: config.agents.defaults.workspace = selectedPath
   OR config.agents.list[i].workspace = selectedPath (per-agent)
3. writeConfig() via Tauri IPC
4. Restart gateway (stop -> start -> reconnect)
5. Reload config
```

### Tauri Dialog Integration

Need to add a folder picker. Tauri v2 has `@tauri-apps/plugin-dialog`:
```typescript
import { open } from '@tauri-apps/plugin-dialog';
const selected = await open({ directory: true, title: "Select Workspace" });
```

This requires:
1. Adding `dialog` plugin to `src-tauri/Cargo.toml` and `tauri.conf.json`
2. Adding wrapper to `tauri-commands.ts`

## New vs Modified Components

### New Components (create)

| Component | Location | Purpose |
|-----------|----------|---------|
| `SkillsSection.tsx` | `src/components/settings/` | Skills management UI |
| `SkillCard.tsx` | `src/components/settings/` | Individual skill display + toggle |
| `SkillConfigDialog.tsx` | `src/components/settings/` | Skill API key / env config |
| `WorkspaceSection.tsx` | `src/components/settings/` | Workspace directory config |

### Modified Components (extend)

| Component | Changes |
|-----------|---------|
| `SettingsPage.tsx` | Import and render `SkillsSection`, `WorkspaceSection` |
| `settings-store.ts` | Add skills state + actions, workspace state + actions |
| `IMChannelsSection.tsx` | Add agent binding selector, streaming mode toggle |
| `tauri-commands.ts` | Add folder picker wrapper (if using Tauri dialog plugin) |

### No Changes Needed

| Component | Why |
|-----------|-----|
| `config.rs` (Rust) | Existing read/write is sufficient -- it handles any JSON |
| `pairing.rs` (Rust) | Already complete for Telegram pairing |
| `gateway-client.ts` | Already supports arbitrary `gateway.request()` calls |
| `chat-store.ts` | Chat functionality unaffected |
| `app-store.ts` | App lifecycle unaffected |
| `AppShell.tsx` | Gateway lifecycle already handled |

## Patterns to Follow

### Pattern 1: Config Read-Modify-Write with Gateway Locking

**What:** Use `config.get` to read config + hash, modify, then `config.set` with `baseHash` for atomic writes.
**When:** Writing channel config (where concurrent writes from gateway control UI are possible).
**Example:** Already implemented in `IMChannelsSection.saveTelegramConfig()`.

```typescript
const fullConfig = await gateway.request<{ config: Record<string, unknown>; hash: string }>("config.get", {});
// ... modify config ...
await gateway.request("config.set", { baseHash: fullConfig.hash, raw: JSON.stringify(newConfig, null, 2) });
```

### Pattern 2: Direct Gateway Method for Live Operations

**What:** Use dedicated gateway methods that handle config writes internally.
**When:** Skills management (toggle, install, update) where the gateway method handles the write.
**Example:**

```typescript
// No need to read/write config manually
await gateway.request("skills.update", { skillKey: "weather", enabled: true });
// Then just refresh the UI
const status = await gateway.request("skills.status", {});
```

### Pattern 3: Tauri IPC for File System Operations

**What:** Use Tauri IPC for operations that need OS-level access (file dialogs, path resolution).
**When:** Workspace folder selection.
**Example:**

```typescript
import { open } from '@tauri-apps/plugin-dialog';
const selected = await open({ directory: true });
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Duplicating Gateway Restart Logic

**What:** Each component implementing its own `restartGateway()` helper.
**Why bad:** Already exists in both `IMChannelsSection` and `settings-store.ts` with slightly different implementations (different sleep timings).
**Instead:** Extract a shared `restartGatewayAndReconnect()` utility, or add it as an action on `settings-store`.

### Anti-Pattern 2: Writing Config via Tauri IPC When Gateway Has a Method

**What:** Using `readConfig()`/`writeConfig()` Tauri IPC when a dedicated gateway method exists (e.g., `skills.update`).
**Why bad:** Bypasses gateway's internal state, may cause inconsistency if gateway has cached config.
**Instead:** Use gateway methods when they exist. Use Tauri IPC only when the gateway is not running or for operations without a gateway method.

### Anti-Pattern 3: Hardcoding Config Paths

**What:** Building openclaw.json paths in TypeScript.
**Why bad:** Config path resolution is handled by Rust backend (`config_path()` in `config.rs`).
**Instead:** Always use `readConfig()`/`writeConfig()` Tauri commands or `config.get`/`config.set` gateway methods.

## Suggested Build Order

Based on dependencies between components:

### Phase 1: Skills Management (lowest risk, no new Rust code)

**Why first:**
- Gateway already has all needed methods (`skills.status`, `skills.install`, `skills.update`)
- No config restart needed for toggle operations (live update via `skills.update`)
- Self-contained -- no dependencies on other new features
- Most straightforward: list skills, toggle, configure

**Components:** `SkillsSection.tsx`, `SkillCard.tsx`, `SkillConfigDialog.tsx`, extend `settings-store.ts`

### Phase 2: Workspace Configuration (small scope, enables Phase 3)

**Why second:**
- Small feature -- just a folder picker + config write
- May need Tauri dialog plugin added (one-time setup)
- Per-agent workspace is needed for agent-channel binding to be meaningful

**Components:** `WorkspaceSection.tsx`, extend `settings-store.ts`, possibly extend `tauri-commands.ts`

### Phase 3: Telegram Channel Management Enhancement (builds on existing)

**Why third:**
- Existing `IMChannelsSection` already handles basic Telegram config
- Agent binding requires agents to exist and have workspaces (Phase 2)
- Most complex -- involves bindings array management, agent selection

**Components:** Enhance `IMChannelsSection.tsx`, extend `settings-store.ts`

## Integration Points with Existing Architecture

### Config Persistence Layer

All three features write to the same `openclaw.json` file. The merge strategy matters:
- Skills: use `skills.update` gateway method (it handles the merge internally)
- Channels: use `config.set` with `baseHash` (optimistic locking)
- Workspace: use Tauri IPC `readConfig`/`writeConfig` (same pattern as model provider management)

### Store Architecture

Extend `settings-store.ts` rather than creating new stores. The settings store already handles:
- Config loading from gateway and file fallback
- Config writing with gateway restart
- Section navigation state

New state to add:
```typescript
// Skills
skills: SkillEntry[];
skillsLoading: boolean;
loadSkills: () => Promise<void>;
toggleSkill: (skillKey: string, enabled: boolean) => Promise<void>;
installSkill: (name: string, installId: string) => Promise<void>;
updateSkillConfig: (skillKey: string, apiKey?: string, env?: Record<string, string>) => Promise<void>;

// Workspace
defaultWorkspace: string;
loadWorkspaceConfig: () => Promise<void>;
setDefaultWorkspace: (path: string) => Promise<void>;
setAgentWorkspace: (agentId: string, path: string) => Promise<void>;
```

### Gateway Client

No changes needed to `gateway-client.ts`. The `gateway.request<T>(method, params)` generic is already sufficient for all new method calls. The methods (`skills.status`, `skills.install`, `skills.update`, `channels.status`, `config.get`, `config.set`) are all standard request/response patterns.

## Sources

- OpenClaw source: `openclaw/src/config/types.telegram.ts` (TelegramAccountConfig, TelegramConfig)
- OpenClaw source: `openclaw/src/config/types.skills.ts` (SkillConfig, SkillsConfig)
- OpenClaw source: `openclaw/src/config/types.agents.ts` (AgentConfig, AgentBinding)
- OpenClaw source: `openclaw/src/config/types.openclaw.ts` (OpenClawConfig root type)
- OpenClaw source: `openclaw/src/gateway/server-methods/skills.ts` (skills.status, skills.install, skills.update handlers)
- OpenClaw source: `openclaw/src/gateway/server-methods/channels.ts` (channels.status, channels.logout handlers)
- OpenClaw source: `openclaw/src/config/bindings.ts` (AgentBinding management)
- Existing codebase: `src/components/settings/IMChannelsSection.tsx` (current Telegram UI)
- Existing codebase: `src/stores/settings-store.ts` (config management patterns)
- Existing codebase: `docs/gateway-protocol.md` (WebSocket protocol reference)
- Confidence: HIGH -- all findings based on direct source code analysis

---

*Architecture analysis: 2026-03-14*
