# MaxAuto: Vendor-Free OpenClaw Desktop Wrapper

## Context

OpenClaw is powerful but requires CLI knowledge, Node.js, and manual config editing. AutoClaw (by Zhipu AI) solved this with a desktop GUI — but it requires login and ties users to Zhipu's ecosystem. **MaxAuto** is our vendor-free alternative: a double-click installer with GUI that wraps OpenClaw without modifying its code. No login, no credits, BYOK + preset providers (Ollama is an optional preset, not auto-configured).

## Tech Stack

- **Desktop framework**: Tauri v2 (Rust backend, ~10MB bundle)
- **Frontend**: React + TypeScript + Tailwind CSS + Zustand
- **Platforms**: Windows (.msi) + macOS (.dmg)
- **All code in**: `max-auto/`

## Folder Structure

```
max-auto/
  package.json                  # Frontend deps
  vite.config.ts
  tailwind.config.ts
  index.html
  src/                          # React frontend
    main.tsx
    App.tsx
    global.css
    api/
      gateway-client.ts         # WS client to OpenClaw gateway
      tauri-commands.ts         # Typed invoke() wrappers
      config-api.ts             # R/W openclaw.json via Tauri
      ollama-api.ts             # Ollama model listing (optional, user-triggered only)
    hooks/
      useGateway.ts, useConfig.ts, useChat.ts, useModels.ts
    stores/
      app-store.ts, chat-store.ts, config-store.ts, model-store.ts
    pages/
      HomePage.tsx              # Chat view + sidebar
      SettingsPage.tsx          # Settings shell
      settings/
        GeneralSettings.tsx, ModelSettings.tsx, AgentSettings.tsx,
        McpSettings.tsx, WorkspaceSettings.tsx, AboutSettings.tsx
    components/
      layout/   AppShell.tsx, Sidebar.tsx, TitleBar.tsx
      chat/     ChatPanel.tsx, ChatMessage.tsx, ChatInput.tsx, ModelSelector.tsx
      agents/   AgentList.tsx, AgentQuickConfig.tsx
      models/   ProviderList.tsx, AddModelDialog.tsx, PresetProviderPicker.tsx
      settings/ SettingsNav.tsx, GatewayStatus.tsx
      common/   Dialog.tsx, Button.tsx, Input.tsx, Select.tsx, Toggle.tsx, Toast.tsx
    lib/
      constants.ts, preset-providers.ts, utils.ts
  src-tauri/                    # Rust backend
    Cargo.toml
    tauri.conf.json
    src/
      main.rs, lib.rs
      commands/
        gateway.rs              # start/stop/status gateway process
        config.rs               # read/write openclaw.json
        system.rs               # check Node.js, platform info
        setup.rs                # first-run setup helpers
      state/
        gateway_process.rs      # Child process management
      tray/
        menu.rs                 # System tray icon + menu
  ui-reference/                 # (existing) AutoClaw screenshots
  docs/                         # (existing)
```

## How It Works (No OpenClaw Modification)

All interaction with OpenClaw is external:

1. **Install**: On first launch, install OpenClaw into `~/.openclaw-maxauto/openclaw/` (isolated from any global install)
2. **Config**: Read/write `~/.openclaw-maxauto/config/openclaw.json` (isolated config via `OPENCLAW_CONFIG_PATH` env var)
3. **Gateway**: Spawn gateway with `OPENCLAW_STATE_DIR=~/.openclaw-maxauto` so all state is isolated
4. **Chat/Agents**: WebSocket to gateway at `ws://127.0.0.1:18789` using OpenClaw's protocol
5. **Ollama**: Just another preset provider in the list. If user selects Ollama, they configure the base URL (default `http://127.0.0.1:11434/v1`). No auto-detection on startup.

## Environment Isolation

All MaxAuto files live under `~/.openclaw-maxauto/` to avoid conflicts with any existing OpenClaw installation:

```text
~/.openclaw-maxauto/
  node/                     # Bundled or installed Node.js runtime
  openclaw/                 # OpenClaw installation (npm prefix)
    bin/openclaw            # openclaw binary
    lib/node_modules/       # openclaw + deps
  config/
    openclaw.json           # OpenClaw config (MaxAuto's own copy)
  credentials/              # API keys, gateway tokens
  sessions/                 # Agent session data
  settings.json             # MaxAuto app settings (window state, openclaw path, etc.)
```

**How isolation works:**
- MaxAuto sets `OPENCLAW_STATE_DIR=~/.openclaw-maxauto` and `OPENCLAW_CONFIG_PATH=~/.openclaw-maxauto/config/openclaw.json` when spawning the gateway
- OpenClaw reads these env vars (see `src/config/paths.ts`) and uses our isolated paths
- The global `~/.openclaw/` is never touched
- Node.js and OpenClaw are installed locally via `npm install --prefix ~/.openclaw-maxauto/openclaw openclaw`

## OpenClaw Installation (First-Run)

MaxAuto installs OpenClaw into its isolated directory. No global install, no system PATH changes.

**First-run flow:**

1. Check if `~/.openclaw-maxauto/openclaw/bin/openclaw` exists
2. If found, verify version, proceed to gateway start
3. If NOT found, show setup screen:
   - Check if Node.js 22+ is available (system PATH or `~/.openclaw-maxauto/node/`)
   - If no Node.js: download Node.js binary for the platform into `~/.openclaw-maxauto/node/`
   - Install OpenClaw: `npm install --prefix ~/.openclaw-maxauto/openclaw openclaw`
   - After install completes, proceed to model config

**Rust commands for installation:**

| Command | Purpose |
| --- | --- |
| `check_openclaw()` | Check if `~/.openclaw-maxauto/openclaw/bin/openclaw` exists |
| `install_openclaw()` | Run `npm install --prefix ~/.openclaw-maxauto/openclaw openclaw` |
| `check_node()` | Check system Node.js or `~/.openclaw-maxauto/node/` |
| `install_node()` | Download Node.js 22 binary into `~/.openclaw-maxauto/node/` |

**Gateway start with isolation:**

```bash
OPENCLAW_STATE_DIR=~/.openclaw-maxauto \
OPENCLAW_CONFIG_PATH=~/.openclaw-maxauto/config/openclaw.json \
~/.openclaw-maxauto/openclaw/bin/openclaw gateway run --bind loopback --port 18789
```

## Key Rust Commands

| Command | Purpose |
|---------|---------|
| `start_gateway(port, bind)` | Spawn gateway with isolated env vars |
| `stop_gateway()` | Kill gateway child process |
| `gateway_status()` | Check if gateway is alive (process + health probe) |
| `read_config()` | Read `~/.openclaw-maxauto/config/openclaw.json` |
| `write_config(json)` | Write config (frontend handles merging) |
| `check_node()` | Check system or local Node.js 22.12+ |
| `check_openclaw()` | Check if `~/.openclaw-maxauto/openclaw/bin/openclaw` exists |
| `install_openclaw()` | Install OpenClaw into `~/.openclaw-maxauto/openclaw/` |
| `install_node()` | Download Node.js 22 into `~/.openclaw-maxauto/node/` |
| `get_platform_info()` | OS, arch, home dir |

Config path: `~/.openclaw-maxauto/config/openclaw.json` (set via `OPENCLAW_CONFIG_PATH` env var when spawning gateway).

## Preset Providers

Based on `src/agents/models-config.providers.ts` and `src/config/types.models.ts`:

| Provider | API Protocol | Base URL |
|----------|-------------|----------|
| OpenAI | openai-completions | https://api.openai.com/v1 |
| Anthropic | anthropic-messages | https://api.anthropic.com |
| DeepSeek | openai-completions | https://api.deepseek.com/v1 |
| Groq | openai-completions | https://api.groq.com/openai/v1 |
| Ollama (local) | ollama | http://127.0.0.1:11434/v1 |
| OpenRouter | openai-completions | https://openrouter.ai/api/v1 |
| Google Gemini | google-generative-ai | (SDK default) |
| Together AI | openai-completions | https://api.together.xyz/v1 |
| Mistral | openai-completions | https://api.mistral.ai/v1 |

Users can also add fully custom providers via the Add Model dialog.

## UI Pages (Matching AutoClaw Reference)

1. **Home** — Left sidebar: agent list (tabs: Agents / IM Channels / Cron Tasks). Main area: chat with selected agent. Bottom: model selector + message input.
2. **Settings > Model & API** — List configured providers, add custom model dialog, Gateway URL + status.
3. **Settings > Agent Config** — Quick config: name, role, personality tags, workspace path, restrict toggle.
4. **Settings > General / MCP / Workspace / About** — Standard settings pages.

## Auth Strategy (No Login)

- On first launch, auto-generate a gateway auth token
- Write to `~/.openclaw-maxauto/config/openclaw.json` under `gateway.auth`
- Frontend reads token from config and passes in WebSocket ConnectParams
- No accounts, no credits, no vendor tie-in

## Implementation Phases

### Phase 1: Scaffolding + Gateway Control

- `pnpm create tauri-app` in max-auto/
- Rust commands: `check_node`, `install_node`, `check_openclaw`, `install_openclaw`, `start_gateway`, `stop_gateway`, `gateway_status`
- First-run setup screen: detect Node.js + OpenClaw in `~/.openclaw-maxauto/`, install if missing
- `AppShell` + custom `TitleBar` (frameless window with drag region)
- Verify WS connection to running gateway
- System tray (show/hide, quit)

### Phase 2: Config + Model Management
- `read_config` / `write_config` Rust commands
- Settings page: Model & API with provider list
- `AddModelDialog` (provider, model ID, name, API key, protocol, base URL)
- `PresetProviderPicker` with one-click preset add (includes Ollama as an option)

### Phase 3: Chat Interface
- `HomePage` with sidebar matching AutoClaw layout
- `ChatPanel`, `ChatMessage`, `ChatInput`, `MessageList`
- `ModelSelector` dropdown
- Wire WS send/receive for chat
- Agent list + selection in sidebar

### Phase 4: Agent Management + Polish
- `AgentQuickConfig` dialog
- Agent CRUD via gateway protocol
- Remaining settings pages (MCP, Workspace, About)
- `GatewayStatus` indicator with connect/reset

### Phase 5: Polish + Packaging

- Window state persistence
- Error handling + toasts
- Build .msi (Windows) and .dmg (macOS)
- Test full flow: install MaxAuto on clean machine -> first-run installs OpenClaw -> configure model -> chat

## Critical Reference Files (Read-Only)

- `src/config/types.openclaw.ts` — Full OpenClawConfig type definition
- `src/config/paths.ts` — Config path resolution logic
- `src/gateway/protocol/index.ts` — WebSocket protocol (methods, frames, events)
- `src/config/types.models.ts` — ModelProviderConfig, MODEL_APIS enum
- `src/agents/models-config.providers.ts` — All provider builder definitions

## Verification

1. `cd max-auto && pnpm install && pnpm tauri dev` — app launches, window renders
2. Start OpenClaw gateway separately, verify WS connection indicator turns green
3. Add a model provider via UI, verify `~/.openclaw-maxauto/config/openclaw.json` updates correctly
4. Send a chat message, verify response streams back
5. `pnpm tauri build` — produces .msi on Windows, .dmg on macOS
6. Double-click install the .msi/.dmg on a clean machine, verify it launches and works

## Step 0: Write Research Docs

Before any code, save all research into `max-auto/docs/`:

1. **`max-auto/docs/PLAN.md`** — This plan file (the overall architecture and implementation roadmap)
2. **`max-auto/docs/tauri-v2-guide.md`** — Tauri v2 setup, IPC commands, child processes, system tray, frameless window, packaging config
3. **`max-auto/docs/gateway-protocol.md`** — OpenClaw WS protocol: frames, all methods, events, auth, config types
4. **`max-auto/docs/node-portable-install.md`** — Portable Node.js download, npm prefix install, cross-platform paths
