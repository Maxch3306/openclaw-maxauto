# Codebase Structure

**Analysis Date:** 2026-03-14

## Directory Layout

```
openclaw-maxauto/
├── src/                          # React TypeScript frontend
│   ├── main.tsx                  # React entry point (ReactDOM.createRoot)
│   ├── App.tsx                   # Root component (SetupPage or AppShell routing)
│   ├── env.d.ts                  # Vite/Tauri type declarations
│   ├── global.css                # Tailwind + CSS variables (dark theme)
│   ├── api/                      # External integration layer
│   │   ├── device-identity.ts    # Ed25519 keypair generation & persistence
│   │   ├── gateway-client.ts     # WebSocket client for OpenClaw gateway
│   │   └── tauri-commands.ts     # Typed Tauri invoke() wrappers
│   ├── components/               # React UI components
│   │   ├── layout/
│   │   │   ├── AppShell.tsx      # Main app container (gateway lifecycle)
│   │   │   └── TitleBar.tsx      # Window title bar
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx     # Main chat display + input area
│   │   │   ├── ChatInput.tsx     # Message input + send button
│   │   │   ├── Sidebar.tsx       # Left sidebar with tabs
│   │   │   ├── SidebarTabs.tsx   # Agent/Chat tabs switcher
│   │   │   ├── AgentList.tsx     # List of agents
│   │   │   ├── AgentCard.tsx     # Individual agent display
│   │   │   ├── CreateAgentDialog.tsx  # Modal for new agent
│   │   │   └── EditAgentDialog.tsx    # Modal for edit agent
│   │   ├── settings/
│   │   │   ├── GeneralSection.tsx        # General settings (notifications, etc)
│   │   │   ├── ModelsAndApiSection.tsx   # Built-in provider setup
│   │   │   ├── AddModelDialog.tsx        # Custom model dialog
│   │   │   ├── QuickConfigModal.tsx      # Bailian Coding quick setup
│   │   │   ├── BailianCodingQuickSetup.tsx # Bailian UI
│   │   │   ├── IMChannelsSection.tsx     # IM channels placeholder
│   │   │   └── AboutSection.tsx          # About/version info
│   │   └── common/
│   │       ├── GatewayStatus.tsx    # Status indicator (bottom right)
│   │       └── UpdateBanner.tsx     # Update notification banner
│   ├── pages/
│   │   ├── SetupPage.tsx           # First-run setup flow
│   │   └── SettingsPage.tsx        # Settings navigation container
│   └── stores/                     # Zustand state management
│       ├── app-store.ts           # Global app state (setup, gateway, page)
│       ├── chat-store.ts          # Chat state + agent/session/streaming actions
│       ├── settings-store.ts      # Settings, models, providers
│       └── update-store.ts        # Auto-update state
│
├── src-tauri/                      # Rust backend (Tauri)
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs                # Tauri entry point (delegates to lib.rs)
│   │   ├── lib.rs                 # Tauri app builder + handler registration
│   │   ├── commands/              # IPC command handlers
│   │   │   ├── mod.rs             # Module re-exports
│   │   │   ├── gateway.rs         # start/stop/status gateway, token generation
│   │   │   ├── system.rs          # check Node.js/Git/OpenClaw, platform info
│   │   │   ├── setup.rs           # install Node.js 24, Git, OpenClaw
│   │   │   ├── config.rs          # read/write openclaw.json
│   │   │   └── pairing.rs         # Telegram pairing (list/approve/reject)
│   │   ├── state/
│   │   │   ├── mod.rs             # State module
│   │   │   └── gateway_process.rs # Gateway child process management
│   │   └── tray/                  # System tray
│   │       ├── mod.rs
│   │       └── menu.rs            # Tray menu definition
│   ├── tauri.conf.json            # Tauri config (window 1200×800, bundle settings)
│   └── icons/                     # App icons (32×32, 128×128, .icns, .ico)
│
├── docs/                          # Documentation
│   ├── PLAN.md                    # Architecture & roadmap
│   ├── gateway-protocol.md        # WebSocket protocol reference
│   ├── tauri-v2-guide.md          # Tauri patterns
│   └── node-portable-install.md   # Node.js bundling strategy
│
├── .github/workflows/
│   └── release-desktop.yml        # CI/CD for Windows .msi + macOS .dmg
│
├── package.json                   # pnpm workspace, deps (React, Tauri, Zustand, etc)
├── tsconfig.json                  # TypeScript config
├── vite.config.ts                 # Vite bundler config
└── bailian-coding.json            # Bailian Coding preset (reference)
```

## Directory Purposes

**`src/`:**
- Purpose: All React/TypeScript frontend code
- Contains: Components, pages, stores, API clients, styles
- Key files: `main.tsx`, `App.tsx`, `global.css`

**`src/api/`:**
- Purpose: Bridge between React and external systems
- Contains: WebSocket client, device identity, Tauri command wrappers
- Key files: `gateway-client.ts`, `device-identity.ts`, `tauri-commands.ts`

**`src/components/`:**
- Purpose: Reusable React components organized by feature
- Contains: Layout, chat UI, settings UI, common UI components
- Pattern: Feature-based subdirectories (layout/, chat/, settings/, common/)

**`src/stores/`:**
- Purpose: Global state management (Zustand)
- Contains: 4 independent stores with actions
- Key pattern: Each store handles one domain (app, chat, settings, update)

**`src/pages/`:**
- Purpose: Full-page components for routing
- Contains: SetupPage (first-run), SettingsPage (settings navigation)
- Each exports a single component

**`src-tauri/src/`:**
- Purpose: Rust backend code
- Contains: Tauri app setup, IPC command handlers, process management, tray
- Organized by concern: commands/, state/, tray/

**`src-tauri/src/commands/`:**
- Purpose: IPC handlers called from React via `invoke()`
- Contains: 6 command modules (gateway, system, setup, config, pairing, and mod.rs)
- Each module groups related operations

**`docs/`:**
- Purpose: Architecture, protocol, and development documentation
- Contains: Architecture plan, gateway protocol spec, Tauri patterns, Node bundling guide

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React entry (ReactDOM.createRoot)
- `src/App.tsx`: Root component (routing logic)
- `src-tauri/src/main.rs`: Tauri entry (calls lib.rs)
- `src-tauri/src/lib.rs`: Tauri app setup

**Configuration:**
- `src-tauri/tauri.conf.json`: Window size, app info, plugins, bundle settings
- `package.json`: Dependencies, scripts, pnpm config
- `tsconfig.json`: TypeScript compilation
- `vite.config.ts`: Vite bundler (dev server, build output)

**Core Logic:**
- `src/api/gateway-client.ts`: WebSocket connection, request/response matching, events
- `src/stores/chat-store.ts`: Chat state + 12 actions (send, load agents, load history, etc)
- `src/stores/settings-store.ts`: Model/provider config + 8 actions
- `src/components/layout/AppShell.tsx`: Gateway lifecycle, event subscriptions

**Gateway Operations:**
- `src-tauri/src/commands/gateway.rs`: start_gateway, stop_gateway, gateway_status, get_gateway_token, run_doctor
- `src-tauri/src/state/gateway_process.rs`: Child process spawning, stdout streaming

**Setup & System:**
- `src/pages/SetupPage.tsx`: First-run flow (check/install Git, Node, OpenClaw)
- `src-tauri/src/commands/system.rs`: Check Node/Git/OpenClaw availability
- `src-tauri/src/commands/setup.rs`: Install Node.js 24, Git, OpenClaw

**Configuration Management:**
- `src-tauri/src/commands/config.rs`: read_config, write_config (openclaw.json I/O)
- `src/stores/settings-store.ts`: Config parsing, provider management, model list building

**Pairing:**
- `src-tauri/src/commands/pairing.rs`: list_pairing_requests, approve_pairing_request, reject_pairing_request

## Naming Conventions

**Files:**
- React components: PascalCase (e.g., `ChatPanel.tsx`, `AddModelDialog.tsx`)
- Store files: kebab-case + `-store.ts` (e.g., `chat-store.ts`, `settings-store.ts`)
- API modules: kebab-case (e.g., `gateway-client.ts`, `device-identity.ts`)
- Rust modules: snake_case (e.g., `gateway.rs`, `gateway_process.rs`)
- Pages: PascalCase (e.g., `SetupPage.tsx`, `SettingsPage.tsx`)

**Directories:**
- Feature-based (e.g., `components/chat/`, `components/settings/`)
- kebab-case for multi-word names (e.g., `src-tauri/`)
- `src/` for frontend, `src-tauri/` for backend

**Variables & Functions:**
- camelCase for functions, variables (e.g., `sendMessage()`, `gateway.connect()`)
- PascalCase for React components and classes
- SCREAMING_SNAKE_CASE for constants (e.g., `PROVIDER_DEFAULTS`, `TOOL_LABELS`)
- Prefix handlers with `on` or `handle` (e.g., `onStatusChange`, `handleResponse`)

## Where to Add New Code

**New Chat Feature:**
- Component: `src/components/chat/[FeatureName].tsx`
- Store actions: Add to `useChatStore` in `src/stores/chat-store.ts`
- Tests: Co-located `src/components/chat/[FeatureName].test.ts`

**New Settings Section:**
- Component: `src/components/settings/[SectionName]Section.tsx`
- Store state: Add to `useSettingsStore` in `src/stores/settings-store.ts`
- Reference in: `src/pages/SettingsPage.tsx`

**New Gateway Command (Rust):**
- Handler: Add to `src-tauri/src/commands/[concern].rs` (e.g., system.rs, gateway.rs)
- Register in: `src-tauri/src/lib.rs` in `invoke_handler!` macro
- TypeScript wrapper: Add to `src/api/tauri-commands.ts`

**New API Integration:**
- Client module: `src/api/[service]-client.ts` (e.g., `gateway-client.ts`)
- Use in stores via actions or React components

**Utilities:**
- Shared helpers: `src/lib/[utility].ts` (if dir doesn't exist, create it)
- Constants: Keep in store files (e.g., `PROVIDER_DEFAULTS`) or feature components

## Special Directories

**`~/.openclaw-maxauto/`:**
- Purpose: Isolated runtime environment (not in repo)
- Generated: Yes (created at first setup)
- Committed: No (gitignored)
- Contains:
  - `node/` — Node.js 24 installation
  - `git/` — Git installation
  - `openclaw/` — OpenClaw installation
  - `config/openclaw.json` — Gateway config
  - `credentials/` — Telegram pairing credentials
  - `sessions/` — Chat session data
  - `workspace/` — Default agent workspace

**`.planning/codebase/`:**
- Purpose: GSD codebase mapping documents
- Generated: Yes (by mapper)
- Committed: Yes
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

**`dist/`:**
- Purpose: Built frontend bundle
- Generated: Yes (`pnpm build`)
- Committed: No (gitignored)
- Contains: HTML, CSS, JS bundles served by Tauri webview

**`src-tauri/target/`:**
- Purpose: Rust build artifacts
- Generated: Yes (`cargo build`)
- Committed: No (gitignored)
- Contains: Binary executables, debug symbols

---

*Structure analysis: 2026-03-14*
