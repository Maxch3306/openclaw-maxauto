# MaxAuto

## What is MaxAuto

A vendor-free, open-source desktop app that wraps OpenClaw. No login, no credits, no vendor lock-in — just a double-click installer that manages OpenClaw's setup and provides a polished GUI.

## Tech Stack

- **Frontend:** React 19 + TypeScript, Tailwind CSS 3.4, Zustand 5 (state), Vite 6
- **Backend:** Tauri v2 (Rust), tokio, reqwest, serde
- **Communication:** WebSocket to OpenClaw gateway (`ws://127.0.0.1:51789`), Tauri IPC for Rust commands
- **Platforms:** Windows (.msi) + macOS (.dmg)
- **Package manager:** pnpm

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
│   │   └── tauri-commands.ts     # Typed Tauri invoke() wrappers (incl. pairing)
│   ├── components/
│   │   ├── layout/               # AppShell, TitleBar
│   │   ├── chat/                 # ChatPanel, ChatInput, Sidebar, SidebarTabs,
│   │   │                         # AgentCard, AgentList, CreateAgentDialog, EditAgentDialog
│   │   ├── settings/             # ModelsAndApiSection, AddModelDialog, QuickConfigModal,
│   │   │                         # GeneralSection, IMChannelsSection, BailianCodingQuickSetup,
│   │   │                         # AboutSection
│   │   └── common/               # GatewayStatus, UpdateBanner
│   ├── pages/
│   │   ├── SetupPage.tsx         # First-run setup flow
│   │   └── SettingsPage.tsx      # Settings navigation (9 sections)
│   └── stores/
│       ├── app-store.ts          # Global app state (setup, gateway, page, port)
│       ├── chat-store.ts         # Chat state + agent CRUD + streaming
│       ├── settings-store.ts     # Settings, models, provider defaults, config
│       └── update-store.ts       # App auto-update checking & installation
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── build.rs                  # Tauri build script
│   ├── tauri.conf.json           # Window 1200×800, decorated, com.openclaw.maxauto
│   └── src/
│       ├── main.rs / lib.rs      # Tauri app builder + plugin setup
│       ├── commands/
│       │   ├── mod.rs             # Command module re-exports
│       │   ├── gateway.rs         # start/stop/status gateway, token generation
│       │   ├── system.rs          # check Node.js, platform info
│       │   ├── setup.rs           # install Node.js 22, install OpenClaw
│       │   ├── config.rs          # read/write openclaw.json
│       │   └── pairing.rs         # Telegram pairing (list/approve/reject, 1hr TTL)
│       ├── state/
│       │   ├── mod.rs
│       │   └── gateway_process.rs
│       └── tray/
│           ├── mod.rs
│           └── menu.rs           # System tray icon + menu
├── docs/
│   ├── PLAN.md                   # Architecture & implementation roadmap
│   ├── gateway-protocol.md       # OpenClaw WebSocket protocol reference
│   ├── tauri-v2-guide.md         # Tauri v2 patterns
│   └── node-portable-install.md  # Node.js bundling strategy
├── .github/workflows/
│   └── release-desktop.yml       # CI/CD release workflow
└── bailian-coding.json           # Bailian Coding preset config (provider + models)
```

## Architecture

1. **Setup flow:** `App.tsx` checks `setupComplete` → shows `SetupPage` (installs Node.js + OpenClaw, starts gateway) or `AppShell`.
2. **Gateway lifecycle:** Rust spawns OpenClaw gateway as child process with isolated env under `~/.openclaw-maxauto/`. Default port: 51789.
3. **Device identity:** `device-identity.ts` generates an Ed25519 keypair per device, persisted in localStorage. Used for authenticated WebSocket handshake (v2 payload signing).
4. **WebSocket protocol (v3):** `GatewayClient` connects, authenticates with device-signed token, sends request/response frames, subscribes to events (`chat-event`, `presence`).
5. **Chat flow:** Select agent from Sidebar → send message via `gateway.request("chat.send")` → stream response via `chat-event` events.
6. **Agent management:** Full CRUD — create, edit (name/emoji/workspace), delete, and set per-agent model via gateway calls.
7. **Settings:** 9 sections — General, Models & API, MCP Services, Skills, Channels, Workspace, Data & Privacy, Feedback, About. Implemented: General, Models & API, Channels, About. Others show "Coming Soon" placeholders.
8. **Model providers:** `PROVIDER_DEFAULTS` in settings-store defines built-in providers:
   - `maxauto-crs-openai` — Claude proxy (openai-responses), GPT-5.4
   - `kimi-coding` — Kimi for Coding (anthropic-messages), k2p5
   - `moonshot` — Moonshot/Kimi K2.5 (openai-completions)
   - `minimax` / `minimax-cn` — MiniMax M2.5 + M2.5 Highspeed (anthropic-messages, authHeader)
   - `maxauto-aliyun-cn` — Aliyun DashScope (openai-completions), qwen3.5-plus, qwen3-coder-next
   - `maxauto-glm-coding-plan` — GLM Coding (openai-completions), glm-5, glm-4.7, glm-4.6v
9. **Bailian Coding quick setup:** `BAILIAN_CODING_PRESET` provides a one-click multi-vendor setup (qwen3.5-plus, MiniMax-M2.5, glm-5, kimi-k2.5) via a single Aliyun Coding API key.
10. **Telegram pairing:** `pairing.rs` handles pairing request flow (list → approve/reject) with 1-hour TTL, stores credentials in `~/.openclaw-maxauto/credentials/`.
11. **Auto-updates:** `update-store.ts` + `UpdateBanner` component handle check/download/install/relaunch via Tauri's plugin-updater. Update endpoint: GitHub Releases.

## Environment Isolation

All runtime files live under `~/.openclaw-maxauto/` (node/, openclaw/, config/, credentials/, sessions/) to avoid conflicts with global installs.

## Scripts

```bash
pnpm dev       # Vite dev server + Tauri dev mode
pnpm build     # TypeScript check + Vite production build
pnpm tauri     # Tauri CLI commands
```
