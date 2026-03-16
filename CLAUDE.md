# MaxAuto

## What is MaxAuto

A vendor-free, open-source desktop app that wraps OpenClaw. No login, no credits, no vendor lock-in — just a double-click installer that manages OpenClaw's setup and provides a polished GUI.

## Tech Stack

- **Frontend:** React 19 + TypeScript, Tailwind CSS 3.4, Zustand 5 (state), Vite 6, i18next (i18n)
- **Backend:** Tauri v2 (Rust), tokio, reqwest, serde
- **Communication:** WebSocket to OpenClaw gateway (`ws://127.0.0.1:51789`), Tauri IPC for Rust commands
- **Platforms:** Windows (.msi) + macOS (.dmg)
- **Package manager:** pnpm 10

## Project Structure

```
├── src/                          # React/TypeScript frontend
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root (SetupPage or AppShell)
│   ├── env.d.ts                  # Vite/Tauri type declarations
│   ├── global.css                # Tailwind + CSS variables (dark theme)
│   ├── api/
│   │   ├── device-identity.ts    # Ed25519 device keypair (generate, persist, sign)
│   │   ├── gateway-client.ts     # WebSocket client for OpenClaw gateway
│   │   ├── tauri-commands.ts     # Typed Tauri invoke() wrappers (gateway, system, setup, config, pairing, docker, shell)
│   │   ├── config-helpers.ts     # Config patching & gateway reconnection utilities
│   │   └── telegram-accounts.ts  # Telegram multi-account config management & migration
│   ├── components/
│   │   ├── layout/               # AppShell, TitleBar
│   │   ├── chat/                 # ChatPanel, ChatInput, Sidebar, SidebarTabs,
│   │   │                         # AgentCard, AgentList, CreateAgentDialog, EditAgentDialog
│   │   ├── settings/             # ModelsAndApiSection, AddModelDialog, QuickConfigModal,
│   │   │                         # GeneralSection, IMChannelsSection, BailianCodingQuickSetup,
│   │   │                         # SkillsSection, WorkspaceSection, AboutSection,
│   │   │                         # BotCard, BotCardList, AddBotDialog, RemoveBotDialog,
│   │   │                         # TagInput, skills-utils.ts
│   │   └── common/               # GatewayStatus, UpdateBanner
│   ├── i18n/                     # i18next setup + locale files
│   │   ├── index.ts              # i18next init with LanguageDetector
│   │   └── locales/
│   │       ├── en/translation.json
│   │       └── zh-TW/translation.json
│   ├── pages/
│   │   ├── SetupPage.tsx         # First-run setup flow (native or Docker mode)
│   │   └── SettingsPage.tsx      # Settings navigation (11 sections)
│   └── stores/
│       ├── app-store.ts          # Global app state (setup, gateway, page, port, installMode)
│       ├── chat-store.ts         # Chat state + agent CRUD + streaming + tool activity
│       ├── settings-store.ts     # Settings, models, provider defaults, config
│       └── update-store.ts       # App auto-update checking & installation
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── build.rs                  # Tauri build script
│   ├── tauri.conf.json           # Window 1200×800, decorated, com.openclaw.maxauto
│   ├── capabilities/default.json # Permission grants (shell, updater, process, dialog, fs)
│   └── src/
│       ├── main.rs / lib.rs      # Tauri app builder + plugin setup (16 commands registered)
│       ├── commands/
│       │   ├── mod.rs             # Command module re-exports
│       │   ├── gateway.rs         # start/stop/status gateway, token generation, port cleanup
│       │   ├── system.rs          # check Node.js/Git/OpenClaw, platform info
│       │   ├── setup.rs           # install Node.js 24, Git, OpenClaw
│       │   ├── config.rs          # read/write openclaw.json
│       │   ├── pairing.rs         # Telegram pairing (list/approve/reject, 1hr TTL)
│       │   └── docker.rs          # Docker container lifecycle (check/pull/start/stop/status)
│       ├── state/
│       │   ├── mod.rs
│       │   └── gateway_process.rs # Mutex-wrapped child process + port holder
│       └── tray/
│           ├── mod.rs
│           └── menu.rs           # System tray icon + menu (Show/Hide, Quit)
├── docs/
│   ├── PLAN.md                   # Architecture & implementation roadmap
│   ├── gateway-protocol.md       # OpenClaw WebSocket protocol reference
│   ├── tauri-v2-guide.md         # Tauri v2 patterns
│   └── node-portable-install.md  # Node.js bundling strategy
├── .github/workflows/
│   └── release-desktop.yml       # CI/CD release workflow (macOS universal + Windows)
└── bailian-coding.json           # Bailian Coding preset config (provider + models)
```

**Note:** The `openclaw/` directory at root is a gitignored reference copy of the OpenClaw source for development reference only — it is not part of the build.

## Architecture

1. **Setup flow:** `App.tsx` checks `setupComplete` → shows `SetupPage` or `AppShell`. SetupPage offers two install modes: **native** (install Git, Node.js 24, OpenClaw directly) or **Docker** (pull and run OpenClaw container). The `installMode` state in app-store tracks the chosen path. On Windows, if Git is not found, a `git-missing` screen directs users to install Git from git-scm.com and retry (no bundled MinGit). On macOS, triggers xcode-select CLI tools dialog. The `install_openclaw` step sets `GIT_CONFIG_*` env vars on the npm subprocess to rewrite `ssh://git@github.com/` → `https://github.com/`, avoiding SSH key requirements for npm dependencies.
2. **Gateway lifecycle (native):** Rust spawns OpenClaw gateway as child process with isolated env under `~/.openclaw-maxauto/`. Default port: 51789. Streams stdout/stderr as `gateway-log` events to the frontend. `AppShell` ensures the gateway is running on mount (checks status → starts if needed), so the gateway auto-recovers across app restarts. `run_doctor` command runs `openclaw doctor` for diagnostics. Includes orphaned-process cleanup via `kill_process_on_port()`.
3. **Gateway lifecycle (Docker):** `docker.rs` manages the `maxauto-openclaw` container (`ghcr.io/openclaw/openclaw`). Mounts `~/.openclaw-maxauto/config` and `workspace` as volumes, maps to port 18789 internally, polls `/healthz` for readiness (30s timeout). Container uses `unless-stopped` restart policy.
4. **Device identity:** `device-identity.ts` generates an Ed25519 keypair per device, persisted in localStorage. Used for authenticated WebSocket handshake (v2 payload signing).
5. **WebSocket protocol (v3):** `GatewayClient` connects, authenticates with device-signed token, sends request/response frames, subscribes to events (`chat-event`, `presence`). Supports `tool-events` capability for streaming tool execution. Includes 200-entry circular debug log buffer.
6. **Chat flow:** Select agent from Sidebar → send message via `gateway.request("chat.send")` → stream response via `chat-event` events. Sessions are filtered per agent via `agentId` param in `sessions.list`. `ChatPanel` renders tool call UI cards with real-time streaming results. `ToolActivity` tracks active tool name and phase.
7. **Agent management:** Full CRUD — create, edit (name/emoji), delete, and set per-agent model via gateway calls. Workspace defaults to `~/.openclaw-maxauto/workspace` (set in gateway config, not per-agent UI).
8. **Settings:** 11 sections — General, Usage, Credits, Models & API, MCP Services, Skills, Channels, Workspace, Data & Privacy, Feedback, About. Implemented: General, Models & API, Skills, Channels, Workspace, About. Others show placeholders.
9. **Model providers:** `PROVIDER_DEFAULTS` in settings-store defines built-in providers:
   - `maxauto-crs-openai` — Claude proxy (openai-responses), GPT-5.4
   - `kimi-coding` — Kimi for Coding (anthropic-messages), k2p5
   - `moonshot` — Moonshot/Kimi K2.5 (openai-completions)
   - `minimax` / `minimax-cn` — MiniMax M2.5 + M2.5 Highspeed (anthropic-messages, authHeader)
   - `maxauto-aliyun-cn` — Aliyun DashScope (openai-completions), qwen3.5-plus, qwen3-coder-next
   - `maxauto-glm-coding-plan` — GLM Coding (openai-completions), glm-5, glm-4.7, glm-4.6v
10. **Bailian Coding quick setup:** `BAILIAN_CODING_PRESET` provides a one-click multi-vendor setup (qwen3.5-plus, MiniMax-M2.5, glm-5, kimi-k2.5) via a single Aliyun Coding API key.
11. **Telegram pairing & multi-account:** `pairing.rs` handles pairing request flow (list → approve/reject) with 1-hour TTL, stores credentials in `~/.openclaw-maxauto/credentials/`. Frontend `telegram-accounts.ts` supports multi-account config with migration from flat to multi-account structure. `BotCard`/`BotCardList`/`AddBotDialog`/`RemoveBotDialog` provide full bot management UI.
12. **Skills management:** `SkillsSection` with `TagInput` component and `skills-utils.ts` for skill parsing/formatting. Allows configuring agent skills/tools.
13. **Workspace config:** `WorkspaceSection` allows setting the default agent workspace path.
14. **Auto-updates:** `update-store.ts` + `UpdateBanner` component handle check/download/install/relaunch via Tauri's plugin-updater. Update endpoint: GitHub Releases.
15. **Internationalization:** i18next with LanguageDetector, supporting English (`en`) and Traditional Chinese (`zh-TW`). Locale files in `src/i18n/locales/`.
16. **Config helpers:** `config-helpers.ts` provides `patchConfig()` for merge-patching gateway config and `waitForReconnect()` for polling gateway reconnection after config changes.

## Environment Isolation

All runtime files live under `~/.openclaw-maxauto/` (node/, git/, openclaw/, config/, credentials/, sessions/, workspace/) to avoid conflicts with global installs. Default agent workspace is set to `~/.openclaw-maxauto/workspace` via `agents.defaults.workspace` in the gateway config. Docker mode mounts config/ and workspace/ as container volumes.

## Scripts

```bash
pnpm dev       # Vite dev server + Tauri dev mode
pnpm build     # TypeScript check + Vite production build
pnpm tauri     # Tauri CLI commands
```
