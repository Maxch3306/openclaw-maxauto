# External Integrations

**Analysis Date:** 2026-03-14

## APIs & External Services

**AI Model Providers:**
- Claude Proxy (maxauto-crs-openai) - GPT-5.4 via OpenAI API compatibility
  - Base URL: `https://claude-proxy.bsoltest.com/openai`
  - Protocol: `openai-responses`
  - Implementation: `src/stores/settings-store.ts` (PROVIDER_DEFAULTS)

- Kimi for Coding (kimi-coding) - Kimi K2.5 reasoning model
  - Base URL: `https://api.kimi.com/coding/`
  - Protocol: `anthropic-messages`
  - Implementation: `src/stores/settings-store.ts`

- Moonshot/Kimi K2.5 (moonshot) - Alternative endpoint for Kimi
  - Base URL: `https://api.moonshot.ai/v1`
  - Protocol: `openai-completions`
  - Implementation: `src/stores/settings-store.ts`

- MiniMax M2.5 (minimax / minimax-cn) - Dual endpoints (global and China)
  - Global: `https://api.minimax.io/anthropic`
  - China: `https://api.minimaxi.com/anthropic`
  - Protocol: `anthropic-messages`
  - Uses custom auth header: `authHeader: true`
  - Implementation: `src/stores/settings-store.ts`

- Aliyun DashScope (maxauto-aliyun-cn) - Qwen models
  - Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
  - Models: qwen3.5-plus, qwen3-coder-next
  - Protocol: `openai-completions`
  - Implementation: `src/stores/settings-store.ts`

- Bailian Coding (bailian-coding-maxauto) - Multi-vendor preset via Aliyun
  - Base URL: `https://coding.dashscope.aliyuncs.com/v1`
  - Protocol: `openai-completions`
  - Includes: qwen3.5-plus, MiniMax-M2.5, glm-5, kimi-k2.5
  - Single API key auth (Aliyun)
  - Configuration: `bailian-coding.json` (preset template)
  - Implementation: `src/stores/settings-store.ts` (BAILIAN_CODING_PRESET)

- GLM Coding (maxauto-glm-coding-plan) - Zhipu GLM models
  - Base URL: `https://open.bigmodel.cn/api/coding/paas/v4`
  - Models: glm-5, glm-4.7, glm-4.6v
  - Protocol: `openai-completions`
  - Implementation: `src/stores/settings-store.ts`

**OpenClaw Gateway Communication:**
- Protocol: WebSocket v3 (authenticated via Ed25519 device signatures)
- URL: `ws://127.0.0.1:51789/` (default port, configurable)
- Implementation: `src/api/gateway-client.ts`
- Request/response frames: JSON-serialized command/response pairs
- Event subscriptions: `chat-event`, `presence`, custom tool events
- Capabilities: `tool-events` for streaming tool execution results
- Auth: Device identity (public key + signature) + optional gateway token

**Release Management:**
- GitHub Releases API for auto-updates
- Update endpoint: `https://github.com/Maxch3306/openclaw-maxauto/releases/latest/download/latest.json`
- Implementation: `src-tauri/tauri.conf.json` (updater plugin config)
- Signing: RSA public key embedded in app config
- Auto-update flow via Tauri plugin-updater

## Data Storage

**Databases:**
- None directly (application is stateless gateway wrapper)

**File Storage:**
- Local filesystem at `~/.openclaw-maxauto/` for environment isolation
  - `config/openclaw.json` - Gateway configuration
  - `credentials/` - Telegram pairing credentials
  - `sessions/` - Chat session data (managed by OpenClaw)
  - `workspace/` - Agent workspace (default, changeable via config)
  - `node/` - Vendored Node.js 24.14.0
  - `git/` - Vendored Git 2.49.0 (Windows only)
  - `openclaw/` - OpenClaw npm package installation
- Implementation: Rust commands in `src-tauri/src/commands/`

**Caching:**
- localStorage (browser-side) - Device identity Ed25519 keypair
- In-memory circular buffer (200-entry) - WebSocket debug log
- Implementation: `src/api/device-identity.ts`, `src/api/gateway-client.ts`

## Authentication & Identity

**Auth Provider:**
- OpenClaw gateway (self-hosted)
- Device identity: Ed25519 keypair (persisted in browser localStorage)
- Token: Random 48-character hex string generated per gateway instance
- Scopes: operator.admin, operator.read, operator.write, operator.approvals, operator.pairing

**Device Authentication:**
- Algorithm: Ed25519 public key + signature
- Challenge-response flow: gateway sends nonce → client signs (nonce + payload) → gateway verifies
- Implementation: `src/api/device-identity.ts`
- Payload: device ID, client info, platform, scopes, signed timestamp

**Telegram Pairing:**
- List incoming pairing requests: `src-tauri/src/commands/pairing.rs`
- Approve/reject with 1-hour TTL
- Credentials stored: `~/.openclaw-maxauto/credentials/`

## Monitoring & Observability

**Error Tracking:**
- None (no external service)
- Errors logged to console (frontend) and stderr (Rust backend)

**Logs:**
- Frontend: console.log with `[gateway]` prefix for WebSocket frames
- Backend: stderr output from spawned OpenClaw gateway process
- Debug log: 200-entry circular buffer in `GatewayClient`
- Implementation: `src/api/gateway-client.ts` (debugLog array)
- Exposed via: `GeneralSection.tsx` → "Show Gateway Debug Log" button

**Gateway Startup Logging:**
- `gateway-log` events streamed from Rust to frontend during startup
- Display: `SetupPage.tsx` → loading spinner + live log viewer
- Implementation: `src-tauri/src/commands/gateway.rs` (emit "gateway-log" events)

## CI/CD & Deployment

**Hosting:**
- GitHub (source repository)
- GitHub Releases (binary distribution)

**CI Pipeline:**
- GitHub Actions workflow: `.github/workflows/release-desktop.yml`
- Triggers: push to main branch or manual dispatch
- Build matrix: macOS latest (universal aarch64+x86_64) + Windows latest
- Artifacts: .dmg (macOS), .msi (Windows), .exe (installer)
- Signing: Tauri private key (RSA)
- Version: auto-bumped from package.json after release

**Build Targets:**
- Windows: `.msi` installer with WebView2 bootstrapper (silent download if missing)
- macOS: `.dmg` disk image with universal binary (aarch64 + x86_64)
- Minimum system versions: Windows (any modern), macOS 10.13+

**Deployment Strategy:**
- Release via GitHub Actions tauri-action
- Latest version published as release tag (`v{version}`)
- Auto-update via built-in Tauri updater plugin (checks latest.json)
- No manual deployment required — CI/CD handles full pipeline

## Environment Configuration

**Required env vars (CI/CD only):**
- `GITHUB_TOKEN` - GitHub API access for releases
- `TAURI_SIGNING_PRIVATE_KEY` - App signing key (base64)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - Signing key password

**Model API Keys (User Configuration):**
- Per-provider API keys configured via Settings UI
- Stored in `~/.openclaw-maxauto/config/openclaw.json`
- Implementation: `src/components/settings/ModelsAndApiSection.tsx`
- Providers: Aliyun (Bailian Coding, DashScope), MiniMax, Kimi, Zhipu, custom endpoints

**Secrets location:**
- Desktop app: OpenClaw gateway config file at `~/.openclaw-maxauto/config/openclaw.json`
- CI/CD: GitHub Actions Secrets (TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD)
- Device credentials: `~/.openclaw-maxauto/credentials/` (Telegram pairing)

## Webhooks & Callbacks

**Incoming:**
- Telegram callback: handled by OpenClaw gateway (pairing approval flow)
- Gateway log events: streamed to frontend during startup
- Chat events: streamed via WebSocket subscription (`chat-event`)
- Tool execution: streamed via WebSocket subscription (with `tool-events` capability)

**Outgoing:**
- None directly from MaxAuto
- OpenClaw gateway manages outbound IM integrations (Telegram, Slack, Discord, Signal, etc.)

## External Dependency Downloads

**Automated Downloads (Setup Phase):**

- **Node.js 24.14.0**
  - URL: `https://nodejs.org/dist/v24.14.0/node-v24.14.0-{os}-{arch}.{zip|tar.gz}`
  - Platforms: Windows (x64, arm64), macOS (x64, arm64)
  - Destination: `~/.openclaw-maxauto/node/`
  - Implementation: `src-tauri/src/commands/setup.rs` → `install_node()`

- **Git 2.49.0 (Windows only)**
  - URL: `https://github.com/git-for-windows/git/releases/download/v2.49.0.windows.1/MinGit-2.49.0-{64-bit|arm64}.zip`
  - Destination: `~/.openclaw-maxauto/git/`
  - macOS: Uses xcode-select, not bundled
  - Implementation: `src-tauri/src/commands/setup.rs` → `install_git()`

- **OpenClaw (npm package)**
  - Via npm in Node.js portable under `~/.openclaw-maxauto/node/`
  - Command: `npm install openclaw@latest`
  - Entry point: `~/.openclaw-maxauto/openclaw/node_modules/openclaw/openclaw.mjs`
  - Implementation: `src-tauri/src/commands/setup.rs` → `install_openclaw()`

---

*Integration audit: 2026-03-14*
