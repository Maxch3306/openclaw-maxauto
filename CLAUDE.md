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
│   ├── global.css                # Tailwind + CSS variables (dark theme)
│   ├── api/
│   │   ├── gateway-client.ts     # WebSocket client for OpenClaw gateway
│   │   └── tauri-commands.ts     # Typed Tauri invoke() wrappers (incl. pairing)
│   ├── components/
│   │   ├── layout/               # AppShell, TitleBar
│   │   ├── chat/                 # ChatPanel, ChatInput, Sidebar, SidebarTabs,
│   │   │                         # AgentCard, AgentList, CreateAgentDialog, EditAgentDialog
│   │   ├── settings/             # ModelsAndApiSection, AddModelDialog, QuickConfigModal,
│   │   │                         # GeneralSection, IMChannelsSection, BailianCodingQuickSetup
│   │   └── common/               # GatewayStatus, UpdateBanner
│   ├── pages/
│   │   ├── SetupPage.tsx         # First-run setup flow
│   │   └── SettingsPage.tsx      # Settings navigation (9 sections)
│   └── stores/
│       ├── app-store.ts          # Global app state (setup, gateway, page)
│       ├── chat-store.ts         # Chat state + agent CRUD + streaming
│       ├── settings-store.ts     # Settings, models, provider defaults, config
│       └── update-store.ts       # App auto-update checking & installation
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json           # Window 1200x800, frameless, com.openclaw.maxauto
│   └── src/
│       ├── main.rs / lib.rs      # Tauri app builder + plugin setup
│       ├── commands/
│       │   ├── gateway.rs        # start/stop/status gateway, token generation
│       │   ├── system.rs         # check Node.js, platform info
│       │   ├── setup.rs          # install Node.js 22, install OpenClaw
│       │   ├── config.rs         # read/write openclaw.json
│       │   └── pairing.rs        # Telegram pairing (list/approve/reject, 1hr TTL)
│       ├── state/
│       │   └── gateway_process.rs
│       └── tray/
│           └── menu.rs           # System tray icon + menu
├── docs/
│   ├── PLAN.md                   # Architecture & implementation roadmap
│   ├── gateway-protocol.md       # OpenClaw WebSocket protocol reference
│   ├── tauri-v2-guide.md         # Tauri v2 patterns
│   └── node-portable-install.md  # Node.js bundling strategy
├── bailian-coding.json           # Bailian Coding preset config (provider + models)
└── ui-reference/                 # AutoClaw screenshot references
```

## Architecture

1. **Setup flow:** `App.tsx` checks `setupComplete` → shows `SetupPage` (installs Node.js + OpenClaw, starts gateway) or `AppShell`.
2. **Gateway lifecycle:** Rust spawns OpenClaw gateway as child process with isolated env under `~/.openclaw-maxauto/`.
3. **WebSocket protocol (v3):** `GatewayClient` connects, authenticates with token, sends request/response frames, subscribes to events (`chat-event`, `presence`).
4. **Chat flow:** Select agent from Sidebar → send message via `gateway.request("chat.send")` → stream response via `chat-event` events.
5. **Agent management:** Full CRUD — create, edit (name/emoji/workspace), delete, and set per-agent model via gateway calls.
6. **Settings:** 9 sections — General, Models & API, MCP, Skills, IM Channels, Workspace, Privacy, Feedback, About.
7. **Model providers:** `PROVIDER_DEFAULTS` in settings-store defines built-in providers:
   - `openai` — OpenAI API (openai-completions)
   - `anthropic` — Anthropic API (anthropic-messages)
   - `deepseek` — DeepSeek (openai-completions)
   - `maxauto-crs-openai` — Claude proxy (openai-responses), GPT-5.4
   - `kimi-coding` — Kimi for Coding (anthropic-messages), k2p5
   - `moonshot` — Moonshot/Kimi K2.5 (openai-completions)
   - `minimax` / `minimax-cn` — MiniMax M2.5 (anthropic-messages, authHeader)
   - `modelstudio` — Bailian Coding (openai-completions), qwen3.5-plus, qwen3-max, qwen3-coder-next/plus, MiniMax-M2.5, glm-5, kimi-k2.5
   - `aliyun-maxauto` — Aliyun DashScope (openai-completions), qwen3.5-plus, qwen3-coder-next
   The "Set up Provider" dropdown also includes upstream OpenClaw providers not in `PROVIDER_DEFAULTS` (amazon-bedrock, azure-openai-responses, cerebras, github-copilot, google, google-antigravity, google-gemini-cli, google-vertex, groq, huggingface, mistral, openai-codex, opencode, opencode-go, openrouter, vercel-ai-gateway, xai, zai).
8. **Telegram pairing:** `pairing.rs` handles pairing request flow (list → approve/reject) with 1-hour TTL, stores credentials in `~/.openclaw-maxauto/credentials/`.
9. **Auto-updates:** `update-store.ts` + `UpdateBanner` component handle check/download/install/relaunch via Tauri's plugin-updater.

## Environment Isolation

All runtime files live under `~/.openclaw-maxauto/` (node/, openclaw/, config/, credentials/, sessions/) to avoid conflicts with global installs.

## Scripts

```bash
pnpm dev       # Vite dev server + Tauri dev mode
pnpm build     # TypeScript check + Vite production build
pnpm tauri     # Tauri CLI commands
```
