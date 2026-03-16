# MaxAuto

## What is MaxAuto

A vendor-free, open-source desktop app that wraps OpenClaw. No login, no credits, no vendor lock-in — just a double-click installer that manages OpenClaw's setup and provides a polished GUI.

## Tech Stack

- **Frontend:** React 19 + TypeScript, Tailwind CSS 3.4 + shadcn/ui (Radix primitives), Zustand 5 (state), Vite 6, i18next (i18n)
- **Backend:** Tauri v2 (Rust), tokio, reqwest, serde
- **UI Components:** shadcn/ui with HSL CSS variable theming (13 primitives: Button, Input, Textarea, Badge, Label, Dialog, Card, Separator, Switch, Tabs, ScrollArea, Collapsible, Tooltip)
- **Communication:** WebSocket to OpenClaw gateway (`ws://127.0.0.1:51789`), Tauri IPC for Rust commands
- **Platforms:** Windows (.msi) + macOS (.dmg)
- **Package manager:** pnpm 10

## Project Structure

```
├── src/                          # React/TypeScript frontend
│   ├── main.tsx                  # React entry point + theme initialization
│   ├── App.tsx                   # Root (SetupPage or AppShell)
│   ├── env.d.ts                  # Vite/Tauri type declarations
│   ├── global.css                # Tailwind + shadcn HSL CSS variables + slider styles
│   ├── api/
│   │   ├── device-identity.ts    # Ed25519 device keypair (generate, persist, sign)
│   │   ├── gateway-client.ts     # WebSocket client for OpenClaw gateway
│   │   ├── tauri-commands.ts     # Typed Tauri invoke() wrappers (gateway, system, setup, config, pairing, docker, shell, winget)
│   │   ├── config-helpers.ts     # Config patching & gateway reconnection utilities
│   │   └── telegram-accounts.ts  # Telegram multi-account config management & migration
│   ├── lib/
│   │   ├── utils.ts              # cn() utility (clsx + tailwind-merge)
│   │   └── theme-utils.ts        # HSL color math, theme derivation, 5 built-in presets
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives (13 components)
│   │   │   ├── button.tsx, input.tsx, textarea.tsx, badge.tsx, label.tsx
│   │   │   ├── dialog.tsx, card.tsx, separator.tsx
│   │   │   ├── switch.tsx, tabs.tsx, scroll-area.tsx, collapsible.tsx, tooltip.tsx
│   │   ├── layout/               # AppShell (with close-to-tray dialog), TitleBar
│   │   ├── chat/                 # ChatPanel, ChatInput (Codex-style), Sidebar, SidebarTabs,
│   │   │                         # AgentCard, AgentList, CreateAgentDialog, EditAgentDialog
│   │   ├── settings/             # AppearanceSection, ModelsAndApiSection, AddModelDialog,
│   │   │                         # QuickConfigModal, GeneralSection, IMChannelsSection,
│   │   │                         # McpSection (local + remote servers), SkillsSection,
│   │   │                         # WorkspaceSection, AboutSection,
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
│   │   └── SettingsPage.tsx      # Settings navigation (12 sections)
│   └── stores/
│       ├── app-store.ts          # Global app state (setup, gateway, page, port, installMode)
│       ├── appearance-store.ts   # Theme state (mode, preset, colors, contrast) + localStorage
│       ├── chat-store.ts         # Chat state + agent CRUD + streaming + tool activity
│       ├── settings-store.ts     # Settings, models, provider defaults, config
│       └── update-store.ts       # App auto-update checking & installation
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── build.rs                  # Tauri build script
│   ├── tauri.conf.json           # Window 1200×800, decorated, com.openclaw.maxauto
│   ├── capabilities/default.json # Permission grants (shell, updater, process, dialog, fs, window hide/show/close)
│   └── src/
│       ├── main.rs / lib.rs      # Tauri app builder + plugin setup (17 commands) + RunEvent::Exit gateway cleanup
│       ├── commands/
│       │   ├── mod.rs             # Command module re-exports
│       │   ├── gateway.rs         # start/stop/status gateway, token generation, port cleanup (CREATE_NO_WINDOW on Windows)
│       │   ├── system.rs          # check Node.js/Git/OpenClaw, platform info
│       │   ├── setup.rs           # install Node.js 24, Git, OpenClaw, winget packages
│       │   ├── config.rs          # read/write openclaw.json, read provider API key
│       │   ├── pairing.rs         # Telegram pairing (list/approve/reject, 1hr TTL)
│       │   └── docker.rs          # Docker container lifecycle (check/pull/start/stop/status)
│       ├── state/
│       │   ├── mod.rs
│       │   └── gateway_process.rs # Mutex-wrapped child process + port holder
│       └── tray/
│           ├── mod.rs
│           └── menu.rs           # System tray icon (app icon) + menu (Show/Hide, Quit)
├── docs/
│   ├── PLAN.md                   # Architecture & implementation roadmap
│   ├── gateway-protocol.md       # OpenClaw WebSocket protocol reference
│   ├── tauri-v2-guide.md         # Tauri v2 patterns
│   ├── node-portable-install.md  # Node.js bundling strategy
│   ├── shadcn-migration-plan.md  # shadcn/ui migration plan
│   └── ui-migration-task.md      # Detailed UI migration task with before/after patterns
├── .github/workflows/
│   └── release-desktop.yml       # CI/CD release workflow (macOS universal + Windows)
└── components.json               # shadcn CLI configuration
```

**Note:** The `openclaw/` directory at root is a gitignored reference copy of the OpenClaw source for development reference only — it is not part of the build.

## Architecture

1. **Setup flow:** `App.tsx` checks `setupComplete` → shows `SetupPage` or `AppShell`. SetupPage offers two install modes: **native** (install Git, Node.js 24, OpenClaw directly) or **Docker** (pull and run OpenClaw container). The `installMode` state in app-store tracks the chosen path. On Windows, if Git is not found, MaxAuto downloads and launches the Git for Windows installer. On macOS, triggers xcode-select CLI tools dialog. The `install_openclaw` step sets `GIT_CONFIG_*` env vars on the npm subprocess to rewrite `ssh://git@github.com/` → `https://github.com/`, avoiding SSH key requirements.
2. **Gateway lifecycle (native):** Rust spawns OpenClaw gateway as child process with isolated env under `~/.openclaw-maxauto/`. Default port: 51789. Uses `CREATE_NO_WINDOW` flag on Windows to hide the console. Streams stdout/stderr as `gateway-log` events to the frontend. `AppShell` ensures the gateway is running on mount. On app exit (`RunEvent::Exit`), the gateway child process is explicitly killed. On hide-to-tray, it stays running.
3. **Gateway lifecycle (Docker):** `docker.rs` manages the `maxauto-openclaw` container (`ghcr.io/openclaw/openclaw`). Mounts `~/.openclaw-maxauto/config` and `workspace` as volumes, maps to port 18789 internally, polls `/healthz` for readiness (30s timeout). Container uses `unless-stopped` restart policy.
4. **Close behavior:** When the user clicks the window close button, a dialog asks whether to **minimize to system tray** (gateway keeps running) or **quit** (gateway is killed). The system tray icon shows the app icon with Show/Hide and Quit menu items.
5. **Device identity:** `device-identity.ts` generates an Ed25519 keypair per device, persisted in localStorage. Used for authenticated WebSocket handshake (v2 payload signing).
6. **WebSocket protocol (v3):** `GatewayClient` connects, authenticates with device-signed token, sends request/response frames, subscribes to events (`chat-event`, `presence`). Supports `tool-events` capability for streaming tool execution. Includes 200-entry circular debug log buffer.
7. **Chat flow:** Select agent from Sidebar → send message via `gateway.request("chat.send")` → stream response via `chat-event` events. `ChatPanel` renders tool call UI cards with real-time streaming results via Collapsible components. Chat messages and input are centered with `max-w-3xl`.
8. **Agent management:** Full CRUD — create, edit (name/emoji/workspace), delete, and set per-agent model via gateway calls.
9. **Settings:** 12 sections — General, Appearance, Models & API, MCP Services, Skills, Channels, Workspace, Usage, Credits, Data & Privacy, Feedback, About. Implemented: General, Appearance, Models & API, MCP, Skills, Channels, Workspace, About. Others show placeholders.
10. **Appearance system:** `appearance-store.ts` manages theme with 5 presets (Default Dark/Light, Ocean, Rosewood, Monochrome). Users can customize accent/background/foreground colors + contrast slider. `theme-utils.ts` derives all 15+ shadcn CSS variables from 4 inputs (accent, bg, fg, contrast). Theme is applied before React render via `initializeTheme()` to prevent flash. Persisted in localStorage.
11. **Model providers:** `PROVIDER_DEFAULTS` in settings-store defines built-in providers (sorted A-Z by displayName): Aliyun Bailian Coding, GLM Coding, Kimi for Coding, MaxAuto Claude Proxy, MiniMax (Global/China), Moonshot/Kimi. Each includes displayName, description, signupUrl, and model definitions.
12. **MCP services:** `McpSection` supports two server types: **Local (stdio)** with command/args/env, and **Remote (URL)** using `mcp-remote` bridge for Streamable HTTP/SSE servers with optional auth headers. OAuth-enabled servers open the browser automatically. Includes link to browse [Smithery](https://smithery.ai/servers) MCP server directory.
13. **Skills management:** `SkillsSection` with 2-column grid layout, sorted by status (enabled → disabled → unavailable). On Windows, brew-only skills use winget mapping for installation (7 known formulas: ffmpeg, gh, python, uv, himalaya, 1password-cli, gemini-cli).
14. **Telegram pairing & multi-account:** `pairing.rs` handles pairing request flow with 1-hour TTL. Frontend supports multi-account config with migration from flat to multi-account structure.
15. **Auto-updates:** `update-store.ts` + `UpdateBanner` component handle check/download/install/relaunch via Tauri's plugin-updater. Update endpoint: GitHub Releases.
16. **Internationalization:** i18next with LanguageDetector, supporting English (`en`) and Traditional Chinese (`zh-TW`).
17. **UI component library:** shadcn/ui with 13 Radix-based primitives. All components use `@/` path aliases. Theming via HSL CSS variables with custom `--success` and `--warning` colors.

## Environment Isolation

All runtime files live under `~/.openclaw-maxauto/` (node/, git/, openclaw/, config/, credentials/, sessions/, workspace/) to avoid conflicts with global installs. Default agent workspace is set to `~/.openclaw-maxauto/workspace` via `agents.defaults.workspace` in the gateway config. Docker mode mounts config/ and workspace/ as container volumes.

## Scripts

```bash
pnpm dev       # Vite dev server + Tauri dev mode
pnpm build     # TypeScript check + Vite production build
pnpm tauri     # Tauri CLI commands
```
