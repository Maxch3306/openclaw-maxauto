# Feature Landscape

**Domain:** Desktop GUI for OpenClaw gateway management (Telegram channels, skills, workspace)
**Researched:** 2026-03-14
**Confidence:** HIGH (based on direct OpenClaw source code analysis)

## Table Stakes

Features users expect. Missing = product feels incomplete.

### Telegram Channel Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Bot token entry + save | Users cannot connect Telegram without it; already partially built in IMChannelsSection | Low | Already exists but needs polish (validation, token masking) |
| Enable/disable toggle | Basic on/off control; already implemented | Low | Already exists |
| DM policy selection (open/allowlist/pairing/disabled) | Core security control; already implemented | Low | Already exists |
| Group policy selection (open/allowlist/disabled) | Controls bot behavior in groups; already implemented | Low | Already exists |
| Connection status indicator | Users need to know if bot is actually running; partially built | Low | `channels.status` gateway method exists, UI shows basic status |
| Pairing request approve/reject | Core pairing workflow; already built in Rust backend + UI | Low | Already fully implemented |
| AllowFrom list management | Necessary for allowlist policies; currently a raw text input | Med | Needs upgrade from comma-separated input to proper list UI with add/remove |
| Gateway restart after config change | Config changes require restart to take effect; already implemented | Low | Already exists in saveTelegramConfig |

### Skills Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| View installed/available skills list | Users need to see what skills exist; gateway exposes `skills.status` | Med | Gateway returns rich `SkillStatusReport` with eligibility, requirements, install options |
| Enable/disable individual skills | Basic skill control; gateway has `skills.update` with `enabled` field | Low | Toggle in config via `skills.entries.<key>.enabled` |
| Skill API key entry | Many skills require API keys (e.g., Gemini); gateway supports `skills.update` with `apiKey` | Med | Must handle `primaryEnv` from skill metadata for key association |
| Skill eligibility display | Users need to know why a skill is unavailable (missing binary, missing env, wrong OS) | Med | Gateway returns `missing` requirements and `eligible` boolean per skill |

### Workspace Configuration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| View current workspace path | Users need to see where agent files live | Low | Available via `config.get` -> `agents.defaults.workspace` |
| Change default workspace path | Users may want workspace in a different location | Med | Requires config write + gateway restart; path validation needed |
| Per-agent workspace display | Each agent has its own workspace; shown in agent CRUD | Low | Already in `agents.create`/`agents.update` params and `EditAgentDialog` |

## Differentiators

Features that set product apart. Not expected, but valued.

### Telegram Channel Management

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Guided BotFather setup | Walk user through creating a Telegram bot step-by-step without leaving the app; AutoClaw (competitor) does this | Med | Link to BotFather, explain steps, validate token format before saving |
| Bot token validation (probe) | Validate token by calling Telegram API before saving; OpenClaw has `probeTelegram` | Med | Gateway's `channels.status` with `probe: true` tests the token against Telegram API, returns bot username |
| Channel-agent binding UI | Visually bind a Telegram bot to a specific agent (1:1); OpenClaw supports multi-account Telegram | High | OpenClaw's `channels.telegram.accounts` supports multiple bots; UI needs to map account to agent via routing config |
| Live connection health | Show real-time polling/webhook status, last message timestamps | Med | Gateway `channels.status` returns `lastInboundAt`, `lastOutboundAt`, `running` state |
| Group membership audit | Show which Telegram groups the bot is in and whether it has proper permissions | High | OpenClaw has `auditGroupMembership` for checking group access; complex to surface cleanly |

### Skills Management

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| One-click skill install | Install missing skill dependencies (binaries) from the UI; OpenClaw has `skills.install` gateway method | High | Gateway supports brew/node/go/uv/download installers; need to surface install options and show progress |
| Skill search + browse from ClawHub | Discover and install skills from the public registry without using CLI | High | Would require integrating ClawHub API; significant scope |
| Skill environment variable management | Configure per-skill env vars beyond just API keys | Med | Gateway `skills.update` accepts `env` map; UI needs key-value editor |
| Per-agent skill filtering | Show which skills are eligible for a specific agent based on workspace | Med | `skills.status` accepts `agentId` param; can show per-agent skill views |
| Bundled skill allowlist | Control which bundled skills are active via `skills.allowBundled` | Low | Simple multi-select from available bundled skills |

### Workspace Configuration

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Workspace file browser | View/edit AGENTS.md, SOUL.md, USER.md, TOOLS.md from the UI | High | Would need file read/write Tauri commands; significant scope |
| Workspace health check | Show if workspace is properly bootstrapped (has required files) | Med | Could check for AGENTS.md, SOUL.md, etc. via Tauri filesystem commands |
| Workspace git backup status | Show if workspace is git-initialized and has a remote | Med | Run git status in workspace dir via Tauri |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multi-channel management (WhatsApp/Discord/Slack) | Out of scope per PROJECT.md; Telegram-first strategy | Show "Coming Soon" placeholders (already done) |
| MCP service management UI | Explicitly deferred per PROJECT.md until skills management is solid | Keep placeholder in settings nav |
| N:M channel-agent binding | PROJECT.md specifies 1:1 for simplicity in v1; OpenClaw supports complex routing but it adds massive UI complexity | Keep 1:1 binding; route config is already complex enough |
| Skill creation/editing in-app | Skills are markdown files with specific formats; editing in-app adds huge complexity for low value | Link to docs on creating skills; users can edit files directly |
| ClawHub publishing from the app | Publishing skills is a developer workflow, not an end-user need | Link to ClawHub CLI docs |
| Direct workspace file editing | Opening a full file editor inside Tauri is a large effort and duplicates existing editors | Show workspace path with "Open in Explorer/Finder" button |
| Webhook mode configuration for Telegram | Requires external URL, SSL, port forwarding -- too complex for desktop app users | Default to polling mode; webhook is for server deployments |
| Per-skill custom config fields | `skills.entries.<key>.config` supports arbitrary fields but varies per skill | Only surface `enabled`, `apiKey`, and `env` -- the universal controls |

## Feature Dependencies

```
Bot token entry --> Connection status (need token before status makes sense)
Bot token entry --> Bot token validation (probe requires token)
Bot token entry --> Channel-agent binding (need working channel first)
DM policy "allowlist" --> AllowFrom list management
DM policy "pairing" --> Pairing request UI (already built)
Skills list view --> Enable/disable toggle (need to see skills first)
Skills list view --> Skill API key entry (need to see which skills need keys)
Skills list view --> One-click install (need to see what's missing)
View workspace path --> Change workspace path
Per-agent workspace --> agents.create/update (already in protocol)
```

## MVP Recommendation

### Phase 1: Complete Telegram Channel Management

Already 70% built. Priority is finishing what exists.

1. **Bot token validation** -- probe token on save, show bot username on success
2. **AllowFrom list UI upgrade** -- replace comma-separated text with add/remove list
3. **Live connection status** -- show running/stopped, last message timestamps
4. **Guided BotFather setup** -- step-by-step instructions panel within the Telegram card

### Phase 2: Skills Management

Gateway API is rich and ready. Build the UI layer.

1. **Skills list view** -- call `skills.status`, render each skill with name, description, emoji, eligibility
2. **Enable/disable toggle** -- call `skills.update` with `enabled` field
3. **Skill API key entry** -- for skills with `primaryEnv`, show API key input field
4. **Skill eligibility indicators** -- show why a skill is unavailable (missing binary, missing env var, wrong OS)

### Phase 3: Workspace Settings

Simpler scope, builds on existing per-agent workspace in agents CRUD.

1. **View/change default workspace path** -- read/write `agents.defaults.workspace` in config
2. **Open workspace in file manager** -- Tauri shell command to open directory
3. **Workspace health check** -- verify bootstrap files exist

### Defer

- **Channel-agent binding**: complex routing configuration, defer until multi-agent is more mature
- **ClawHub integration**: requires API integration with external service, significant scope
- **One-click skill install**: requires platform-specific package manager orchestration, defer
- **Group membership audit**: nice-to-have, not blocking core workflows

## Key Technical Insights

### Gateway API Coverage

The OpenClaw gateway already exposes all needed methods:
- `channels.status` -- channel health + probe
- `skills.status` -- full skill report with eligibility
- `skills.update` -- enable/disable, set API key, set env vars
- `skills.install` -- install skill dependencies
- `config.get` / `config.set` / `config.patch` -- read/write any config including workspace
- `agents.update` -- set per-agent workspace

No new gateway methods are needed. All features can be built against existing WebSocket protocol.

### Config Architecture

All three feature areas write to `~/.openclaw-maxauto/config/openclaw.json`:
- Telegram: `channels.telegram.*`
- Skills: `skills.entries.*`, `skills.allowBundled`, `skills.load.*`
- Workspace: `agents.defaults.workspace`

Changes to channels require gateway restart. Skills changes are picked up on next agent turn (hot reload via watcher). Workspace changes require restart.

### Existing Code to Extend

- `IMChannelsSection.tsx` -- already has Telegram config form, needs enhancement not rewrite
- `EditAgentDialog.tsx` -- already has workspace field per agent
- `SettingsPage.tsx` -- already has nav items for Skills and Workspace sections, just showing "Coming Soon"
- `gateway-client.ts` -- WebSocket client ready for `skills.status`, `skills.update` calls
- `config.rs` -- Tauri command for direct config read/write as fallback

## Sources

- OpenClaw source code: `extensions/telegram/src/channel.ts` (Telegram plugin architecture)
- OpenClaw docs: `docs/tools/skills.md` (skills system)
- OpenClaw docs: `docs/tools/skills-config.md` (skills configuration)
- OpenClaw docs: `docs/tools/clawhub.md` (ClawHub registry)
- OpenClaw docs: `docs/concepts/agent-workspace.md` (workspace layout)
- OpenClaw docs: `docs/gateway/configuration-reference.md` (config schema)
- OpenClaw source: `src/gateway/server-methods/skills.ts` (skills gateway methods)
- OpenClaw source: `src/agents/skills-status.ts` (SkillStatusReport type)
- MaxAuto source: `docs/gateway-protocol.md` (WebSocket protocol reference)
- MaxAuto source: `src/components/settings/IMChannelsSection.tsx` (existing Telegram UI)
- MaxAuto source: `src-tauri/src/commands/pairing.rs` (pairing backend)
