# Architecture

**Analysis Date:** 2026-03-14

## Pattern Overview

**Overall:** Client-Server with Tauri IPC + WebSocket streaming

**Key Characteristics:**
- Tauri v2 desktop app (Rust backend + React frontend)
- Frontend communicates with Rust backend via Tauri IPC for system operations
- Frontend connects to OpenClaw gateway via WebSocket for chat/agent operations
- Bidirectional event streaming for chat responses, tool execution, and status updates
- Zustand for frontend state management (4 independent stores)
- All runtime files isolated under `~/.openclaw-maxauto/` to avoid global conflicts

## Layers

**Rust Backend (Tauri):**
- Purpose: System operations, gateway lifecycle management, config I/O, pairing
- Location: `src-tauri/src/`
- Contains: Command handlers (gateway, setup, system, config, pairing), process state, system tray
- Depends on: tokio, reqwest, serde, tauri plugins (shell, updater, process)
- Used by: React frontend via Tauri IPC invoke()

**Frontend UI (React):**
- Purpose: User interface for chat, settings, setup
- Location: `src/`
- Contains: React components, pages, stores, API clients
- Depends on: React 19, TypeScript, Tailwind CSS, Zustand, Lucide icons
- Used by: User interactions, renders state from stores

**API Layer (TypeScript):**
- Purpose: Bridge between React and external systems (Tauri, WebSocket)
- Location: `src/api/`
- Contains: `gateway-client.ts` (WebSocket), `device-identity.ts` (Ed25519 keypair), `tauri-commands.ts` (IPC wrappers)
- Depends on: @tauri-apps/api, @noble/ed25519, WebSocket API
- Used by: Stores and components

**State Management (Zustand):**
- Purpose: Global state for app, chat, settings, updates
- Location: `src/stores/`
- Contains: 4 independent stores (app, chat, settings, update)
- Exports: Hooks for React components to subscribe to state
- Pattern: Shallow comparison, direct mutations via set()

## Data Flow

**Setup Flow:**

1. App starts → `App.tsx` checks `setupComplete` flag
2. If false → render `SetupPage`
3. `SetupPage` sequentially checks/installs Git, Node.js, OpenClaw via Tauri IPC
4. Once complete, sets `setupComplete: true` in `useAppStore`
5. React re-renders → shows `AppShell` instead

**Gateway Lifecycle:**

1. `AppShell` mounts → calls `getGatewayStatus()` (Tauri IPC)
2. If gateway not running → calls `startGateway(port)` (Tauri IPC)
3. Rust spawns OpenClaw as child process, isolates to `~/.openclaw-maxauto/`
4. Gateway logs stream via Tauri event `gateway-log` → displayed in loading UI
5. Frontend calls `getGatewayToken()` (Tauri IPC) → `gateway.connect(port, token)` (WebSocket)
6. WebSocket handshake: server sends `connect.challenge` → client responds with Ed25519-signed connect frame
7. Server responds with `connect-0` response → connection established
8. `setGatewayConnected(true)` in app store

**Chat Message Flow:**

1. User types message → `ChatInput` calls `sendMessage(text)` action in `useChatStore`
2. Action:
   - Adds user message to local state
   - Creates placeholder assistant message with `streaming: true`
   - Calls `gateway.request("chat.send", { sessionKey, message, idempotencyKey })`
3. Gateway responds with `chat.send` response (initiates streaming server-side)
4. Frontend listens for `chat` events from gateway (WebSocket)
5. Each delta event triggers `updateStreamingMessage()` → appends text
6. When state is `final` or `aborted`, calls `finalizeStreaming()` → sets `streaming: false`
7. Chat history loaded on agent switch via `loadHistory()` (gateway.request)
8. Sessions list loaded via `loadSessions()` (gateway.request)

**Streaming Tool Execution:**

1. Gateway sends `agent` event with `stream: "tool"` and phase `start/partial/result`
2. Phase `start` → `addStreamingToolCall()` adds tool card to message content blocks
3. Phase `result` → `updateStreamingToolResult()` updates tool card with output
4. Phase `partial` → updates `toolActivity` indicator (shows "Using X...")
5. When assistant text resumes → phase `assistant` → `appendStreamingText()`

**Settings Update Flow:**

1. User modifies provider settings in UI
2. Component calls action like `setProviderAuth(key, apiKey)` in `useSettingsStore`
3. Action reads config via `readConfig()` (Tauri IPC)
4. Action merges changes into models.providers and agents.defaults objects
5. Action calls `writeConfigAndRestart()`:
   - Writes JSON to openclaw.json via `writeConfig()` (Tauri IPC)
   - Stops gateway via `stopGateway()` (Tauri IPC)
   - Starts gateway via `startGateway()` (Tauri IPC)
   - Reconnects WebSocket via `gateway.reconnect()`
6. Settings reloaded via `loadConfig()` and `loadModels()`

## Key Abstractions

**GatewayClient:**
- Purpose: Encapsulates WebSocket connection, request/response matching, event subscriptions
- Examples: `src/api/gateway-client.ts`
- Pattern: Singleton instance (`gateway`), pending requests map, event handler registry
- Methods: `connect()`, `disconnect()`, `reconnect()`, `request<T>()`, `on(event, handler)`
- Handles: Connection handshake with device-signed auth, automatic reconnection, 30s request timeout

**DeviceIdentity:**
- Purpose: Generate and persist Ed25519 keypair per device for authenticated WebSocket
- Examples: `src/api/device-identity.ts`
- Pattern: Load or create on first connection, stored in browser localStorage
- Methods: `loadOrCreateDeviceIdentity()`, `buildDeviceAuthPayload()`, `signDevicePayload()`

**Zustand Stores:**
- `useAppStore`: Global app state (setup, gateway status, current page)
- `useChatStore`: Chat messages, agents, sessions, streaming state + 12 actions
- `useSettingsStore`: Models, providers, config, UI state + 8 actions
- `useUpdateStore`: Update checking, downloading, installation

**TauriCommands Wrapper:**
- Purpose: Type-safe invoke() wrappers for all Rust IPC commands
- Examples: `src/api/tauri-commands.ts`
- Pattern: Thin async functions that call `invoke<T>(commandName, params)`
- Groups: Gateway, System, Setup, Config, Pairing, Shell

## Entry Points

**Electron → Tauri:**
- Location: `src-tauri/src/main.rs`
- Triggers: Desktop app launch
- Responsibilities: Calls `max_auto_lib::run()` (in lib.rs)

**React Root:**
- Location: `src/main.tsx`
- Triggers: Vite dev server / bundled HTML
- Responsibilities: Mounts React to DOM element with `<App />`

**App Root:**
- Location: `src/App.tsx`
- Triggers: React initialization
- Responsibilities: Routes to `SetupPage` (if `!setupComplete`) or `AppShell` (main UI)

**AppShell:**
- Location: `src/components/layout/AppShell.tsx`
- Triggers: After setup complete
- Responsibilities:
  - Ensures gateway running + connected
  - Subscribes to WebSocket events (chat, agent, health)
  - Loads agents, config, models on connect
  - Renders Sidebar + ChatPanel or SettingsPage

**Tauri Setup:**
- Location: `src-tauri/src/lib.rs`
- Triggers: App startup
- Responsibilities: Builds Tauri app, registers IPC handlers, initializes plugins, sets up tray menu

## Error Handling

**Strategy:** Layered error handling with user-facing fallbacks

**Patterns:**
- WebSocket request timeout: 30s default, rejects with "Request timed out" error
- Connection loss: Automatic reconnect scheduled 3s later (unless intentional close)
- Gateway start failure: Displays error in `SetupPage`, allows retry
- API errors: Caught in async actions, logged to console, usually display as chat error message
- Setup errors: Stored in `setupError` state, displayed in UI, blocks progression

**Cross-Error Finalization:**
- Chat error state: 5s delay before finalizing (allows retry detection by OpenClaw)
- If `agent` lifecycle `start` phase received → clears error finalization timer
- Prevents orphaned streaming state when retries occur

## Cross-Cutting Concerns

**Logging:** Console.log with prefix (`[gateway]`, `[chat]`, `[chat-store]`, `[settings]`). Debug buffer in `GatewayClient` holds 200 entries.

**Validation:**
- Agent name → normalizeAgentId: lowercase, alphanumeric + hyphens, 64 char max
- Provider key → providerKey: lowercase, non-alphanumeric → hyphens, collapse runs
- Session key → format: `agent:{agentId}:{scope}` where scope is timestamp + random suffix

**Authentication:**
- Device Ed25519 keypair per device (localStorage)
- Signed challenge response in WebSocket handshake
- Optional session token passed in connect frame (for Telegram pairing)

**Config Persistence:**
- Gateway config: `openclaw.json` at `~/.openclaw-maxauto/config/openclaw.json`
- Read via `readConfig()` (Tauri IPC) or `config.get` (WebSocket gateway request)
- Write via `writeConfig()` (Tauri IPC) + auto-restart
- Built-in provider definitions in `PROVIDER_DEFAULTS` (settings-store)

**Status Indicators:**
- Gateway running: tracked in `useAppStore.gatewayRunning`
- WebSocket connected: tracked in `useAppStore.gatewayConnected`
- Chat streaming: tracked in `useChatStore.streaming`
- Tool activity: tracked in `useChatStore.toolActivity` (name + phase)

---

*Architecture analysis: 2026-03-14*
