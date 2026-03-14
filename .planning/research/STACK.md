# Technology Stack

**Project:** MaxAuto - Telegram, Skills, and Workspace Features
**Researched:** 2026-03-14

## Stack Assessment: No New Dependencies Required

The existing stack already contains everything needed for these features. The work is purely UI components + gateway API integration using established patterns.

**Rationale:** All three features (Telegram channel management, skills management, workspace configuration) operate through the same two communication channels already in place:

1. **OpenClaw Gateway WebSocket** -- `gateway.request()` for `config.get`, `config.set`, `config.patch`, `skills.status`, `skills.update`, `skills.install`, `channels.status`, `agents.update`
2. **Tauri IPC** -- `readConfig()` / `writeConfig()` for direct file access as fallback

No new protocols, libraries, or backend capabilities are needed.

## Existing Stack (Validated, No Changes)

### Core Framework
| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| React 19 | 19.0 | Frontend UI | Keep as-is |
| TypeScript | 5.6 | Type safety | Keep as-is |
| Zustand 5 | 5.0 | State management | Extend with new store slices |
| Tailwind CSS | 3.4 | Styling | Keep as-is |
| Vite | 6 | Build tool | Keep as-is |
| Tauri v2 | 2.x | Desktop shell | Keep as-is |
| lucide-react | 0.577 | Icons | Keep as-is |

### Backend (Rust)
| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| tokio | 1 | Async runtime | Keep as-is |
| reqwest | 0.12 | HTTP client | Keep as-is |
| serde / serde_json | 1 | Config serialization | Keep as-is |
| dirs | 6 | Path resolution | Keep as-is |

**Confidence: HIGH** -- These are all verified from the existing `package.json`, `Cargo.toml`, and working codebase.

## OpenClaw Gateway API Endpoints (Already Available)

These are the gateway WebSocket methods that the new features will consume. All are already implemented in the OpenClaw gateway -- no backend changes needed.

### Telegram Channel Management
| Method | Purpose | Params | Notes |
|--------|---------|--------|-------|
| `config.get` | Read current Telegram config | `{}` | Returns `channels.telegram.*` with hash |
| `config.set` | Write full config (replaces) | `{ baseHash, raw }` | Requires base hash for conflict detection |
| `config.patch` | Merge patch config | `{ baseHash, raw }` | Better for incremental changes; auto-restarts gateway via SIGUSR1 |
| `channels.status` | Get Telegram connection status | `{ probe?: boolean }` | Returns per-account snapshots with `configured`, `linked`, `status` |
| `channels.logout` | Disconnect Telegram account | `{ channel: "telegram" }` | Clears session state |

**Key finding:** The existing `IMChannelsSection.tsx` already uses `config.set` + manual gateway restart. The gateway supports `config.patch` which triggers automatic SIGUSR1 restart -- this is the preferred approach and should replace the current manual restart pattern.

**Confidence: HIGH** -- Verified from `openclaw/src/gateway/server-methods/config.ts` and `channels.ts`.

### Telegram Config Schema (from OpenClaw docs)
```typescript
interface TelegramChannelConfig {
  enabled: boolean;
  botToken: string;
  dmPolicy: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom?: string[];              // numeric Telegram user IDs
  groupPolicy?: "open" | "allowlist" | "disabled";
  groupAllowFrom?: string[];         // numeric Telegram user IDs
  groups?: Record<string, {
    requireMention?: boolean;
    groupPolicy?: "open" | "allowlist" | "disabled";
    allowFrom?: string[];
    skills?: string[];
    systemPrompt?: string;
    enabled?: boolean;
    topics?: Record<string, {
      agentId?: string;
      requireMention?: boolean;
      // inherits group fields
    }>;
  }>;
  streaming?: "off" | "partial" | "block" | "progress";
  customCommands?: Array<{ command: string; description: string }>;
  // Many more optional fields -- see OpenClaw docs
}
```

**Confidence: HIGH** -- Verified from `openclaw/docs/channels/telegram.md`.

### Skills Management
| Method | Purpose | Params | Notes |
|--------|---------|--------|-------|
| `skills.status` | List all skills with eligibility | `{ agentId?: string }` | Returns `SkillStatusReport` with per-skill metadata |
| `skills.update` | Toggle skill / set API key | `{ skillKey, enabled?, apiKey?, env? }` | Writes to `skills.entries` in config |
| `skills.install` | Install a skill dependency | `{ name, installId, timeoutMs? }` | Runs installer (brew/node/go/uv/download) |
| `skills.bins` | List required binaries | `{}` | Returns binary names across all workspaces |

**Confidence: HIGH** -- Verified from `openclaw/src/gateway/server-methods/skills.ts`.

### Skills Status Report Shape
```typescript
interface SkillStatusReport {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
}

interface SkillStatusEntry {
  name: string;
  description: string;
  source: string;            // "bundled" | "managed" | "workspace"
  bundled: boolean;
  filePath: string;
  baseDir: string;
  skillKey: string;
  primaryEnv?: string;       // env var name for API key
  emoji?: string;
  homepage?: string;
  always: boolean;           // always-on skill
  disabled: boolean;         // explicitly disabled in config
  blockedByAllowlist: boolean;
  eligible: boolean;         // passes all gating checks
  requirements: Requirements;
  missing: Requirements;     // what's missing (bins, env, config)
  configChecks: Array<{ path: string; met: boolean }>;
  install: Array<{
    id: string;
    kind: "brew" | "node" | "go" | "uv" | "download";
    label: string;
    bins: string[];
  }>;
}
```

**Confidence: HIGH** -- Verified from `openclaw/src/agents/skills-status.ts`.

### Workspace Configuration
| Method | Purpose | Params | Notes |
|--------|---------|--------|-------|
| `agents.list` | Get all agents with workspace paths | `{}` | Returns agent entries with workspace dirs |
| `agents.update` | Update agent workspace path | `{ agentId, workspace? }` | Also accepts `name`, `model`, `avatar` |
| `agents.files.list` | List workspace files | `{ agentId }` | Returns IDENTITY.md, SOUL.md, TOOLS.md, etc. |
| `agents.files.get` | Read workspace file content | `{ agentId, name }` | Safe path resolution with escape guards |
| `agents.files.set` | Write workspace file | `{ agentId, name, content }` | Validates path stays within workspace |

**Confidence: HIGH** -- Verified from `openclaw/src/gateway/server-methods/agents.ts`.

## What to Add (Frontend Only)

### New Zustand Store Slices

No new stores needed. Extend existing stores:

| Store | New State/Actions | Purpose |
|-------|-------------------|---------|
| `settings-store.ts` | `skillsReport`, `skillsLoading`, `loadSkills()`, `toggleSkill()`, `saveSkillApiKey()`, `installSkillDep()` | Skills management state |
| `settings-store.ts` | `telegramStatus`, `loadTelegramStatus()` | Richer Telegram status |
| `chat-store.ts` | Extend `agents` type with `workspace` field | Workspace path per agent |

**Alternative approach (recommended):** Create a dedicated `skills-store.ts` to keep settings-store from growing unwieldy. The existing settings-store is already 850+ lines. Follow the OpenClaw UI pattern from `openclaw/ui/src/ui/controllers/skills.ts`.

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SkillsSection.tsx` | `src/components/settings/` | Skills list with toggle switches, API key inputs, install buttons |
| `SkillCard.tsx` | `src/components/settings/` | Individual skill with status, requirements, actions |
| `WorkspaceSection.tsx` | `src/components/settings/` | Per-agent workspace directory picker + file browser |
| Enhanced `IMChannelsSection.tsx` | `src/components/settings/` | Extend existing with channel-agent binding, better status display |

### Tauri IPC Additions

| Command | Purpose | Why Tauri (not WebSocket) |
|---------|---------|--------------------------|
| `select_directory` | Native folder picker for workspace | Requires native OS dialog |
| `open_directory` | Open workspace in file explorer | Requires shell integration |

These two new Rust commands are the **only backend additions** needed. Both use the existing `tauri-plugin-shell` and Tauri's dialog API.

```rust
// select_directory: Use tauri::dialog::FileDialogBuilder
// open_directory: Use opener::open() or std::process::Command
```

**Note:** Tauri v2 has `@tauri-apps/plugin-dialog` for native file/folder dialogs. This should be added:

| Dependency | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `@tauri-apps/plugin-dialog` | 2.x | Native folder picker for workspace selection | HIGH |
| `tauri-plugin-dialog` | 2.x | Rust side of dialog plugin | HIGH |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Config updates | `config.patch` (gateway WS) | `config.set` (full replace) | `config.patch` is safer (merge semantics), triggers auto-restart via SIGUSR1 instead of manual restart |
| Config updates | `config.patch` (gateway WS) | Direct file write via Tauri IPC | Gateway validates config, handles restart. Direct write requires manual validation + restart |
| Skills state | New `skills-store.ts` | Extend `settings-store.ts` | Settings store is already 850+ lines. Separation of concerns. Follow OpenClaw UI pattern |
| Folder selection | `@tauri-apps/plugin-dialog` | Text input for path | Poor UX, error-prone, platform path differences |
| Telegram restart | `config.patch` auto-restart | Manual stop/start cycle | Current `IMChannelsSection` does manual restart with hardcoded delays. `config.patch` handles this properly |

## Config Update Strategy: Use `config.patch` Instead of `config.set`

**Current pattern (in IMChannelsSection.tsx):**
```typescript
// BAD: Full config replace + manual gateway restart
const fullConfig = await gateway.request("config.get", {});
const newConfig = { ...fullConfig.config, channels };
await gateway.request("config.set", { baseHash, raw: JSON.stringify(newConfig) });
// Then manually: disconnect WS -> stop gateway -> wait 1.5s -> start gateway -> wait 2s -> reconnect
```

**Recommended pattern:**
```typescript
// GOOD: Merge patch + auto-restart
const { hash } = await gateway.request("config.get", {});
await gateway.request("config.patch", {
  baseHash: hash,
  raw: JSON.stringify({ channels: { telegram: telegramConfig } }),
});
// Gateway auto-restarts via SIGUSR1, frontend reconnects on WS close event
```

**Why:** `config.patch` does merge semantics (won't clobber unrelated config), validates the result, and triggers a graceful SIGUSR1 restart. The current manual restart pattern has arbitrary delays and is fragile.

**Confidence: HIGH** -- Verified from `openclaw/src/gateway/server-methods/config.ts`. The `config.patch` handler calls `scheduleGatewaySigusr1Restart()` after writing.

**Caveat for Windows:** SIGUSR1 is a Unix signal. On Windows, the gateway restart mechanism may work differently. Need to verify that `config.patch` auto-restart works on Windows, or fall back to the manual restart pattern if not. The existing `writeConfigAndRestart()` pattern in settings-store does manual restart and works on Windows -- keep this as fallback.

**Confidence: MEDIUM** -- The SIGUSR1 restart path is verified in OpenClaw source, but Windows behavior needs runtime testing.

## Installation

No new npm packages needed beyond the dialog plugin:

```bash
# Only new dependency
pnpm add @tauri-apps/plugin-dialog

# Rust side (add to src-tauri/Cargo.toml)
# tauri-plugin-dialog = "2"
```

Everything else is already installed.

## Key Integration Points

### 1. Gateway Client (`gateway.request`)
All three features use the same `gateway.request<T>(method, params)` pattern already proven by chat and settings. No protocol changes.

### 2. Config Read/Write Pattern
The `readConfigFile()` -> modify -> `writeConfigAndRestart()` pattern in `settings-store.ts` is the proven approach. For the new features, prefer `config.patch` where possible, fall back to the existing Tauri IPC pattern for Windows compatibility.

### 3. Reconnection Handling
The `GatewayClient` already handles reconnection on WebSocket close. When using `config.patch`, the gateway restarts itself and the frontend will auto-reconnect. When using the manual pattern, the existing `writeConfigAndRestart()` helper handles the sequence.

## Sources

- `openclaw/src/gateway/server-methods/skills.ts` -- Skills gateway API implementation
- `openclaw/src/gateway/server-methods/channels.ts` -- Channels gateway API implementation
- `openclaw/src/gateway/server-methods/config.ts` -- Config gateway API with patch support
- `openclaw/src/gateway/server-methods/agents.ts` -- Agents gateway API with workspace management
- `openclaw/src/agents/skills-status.ts` -- SkillStatusReport type definition
- `openclaw/docs/channels/telegram.md` -- Telegram config reference
- `openclaw/docs/tools/skills.md` -- Skills format and gating docs
- `openclaw/docs/tools/skills-config.md` -- Skills config schema
- `openclaw/ui/src/ui/controllers/skills.ts` -- OpenClaw UI skills controller pattern
- `src/stores/settings-store.ts` -- Existing config update patterns
- `src/components/settings/IMChannelsSection.tsx` -- Existing Telegram UI (to extend)
- `src/api/tauri-commands.ts` -- Existing Tauri IPC wrappers
- `src/api/gateway-client.ts` -- WebSocket client

---

*Stack analysis: 2026-03-14*
