# Codebase Concerns

**Analysis Date:** 2026-03-14

## Tech Debt

**Unsafe Rust unwrap() calls in gateway startup:**
- Issue: Excessive use of `.unwrap()` and `.expect()` in critical Rust code paths without proper error handling
- Files: `src-tauri/src/commands/gateway.rs` (lines 77, 81, 85, 89, 128, 167, 200, 312-313, 436-437), `src-tauri/src/commands/setup.rs` (lines 474, 478, 488), `src-tauri/src/commands/config.rs` (line 12)
- Impact: Application crashes on edge cases like invalid UTF-8 paths, missing home directory, or JSON serialization failures instead of graceful error recovery
- Fix approach: Replace `.unwrap()` with `.map_err()` chains or `?` operator to propagate errors to Result type, allowing frontend to display meaningful error messages

**Device identity initialization race condition:**
- Issue: `loadOrCreateDeviceIdentity()` in `src/api/device-identity.ts` (lines 60-96) reads and writes to localStorage synchronously without atomicity guarantees
- Files: `src/api/device-identity.ts` (lines 62, 75, 94), `src/api/gateway-client.ts` (line 266)
- Impact: Multiple simultaneous calls during app startup could create multiple device identities or corrupt stored keys, causing authentication failures or device identity mismatches
- Fix approach: Implement a simple in-memory lock or use sessionStorage flag to prevent concurrent initialization

**No cleanup of pending WebSocket requests on disconnect:**
- Issue: `GatewayClient.rejectAllPending()` rejects pending requests but doesn't clear/cancel timers until they fire naturally
- Files: `src/api/gateway-client.ts` (lines 372-378)
- Impact: Memory leak if many requests timeout during a network outage; timers continue firing even after app closes WebSocket
- Fix approach: Clear all timer references before rejecting: `clearTimeout(req.timer)` before deletion

**Settings store hardcoded gateway restart delays:**
- Issue: Fixed `setTimeout()` delays (1.5s, 3s, 2s) used for gateway restart synchronization in `writeConfigAndRestart()`
- Files: `src/stores/settings-store.ts` (lines 389-394)
- Impact: On slow systems or under load, gateway may not be ready when timeout expires, causing config load failures; race condition between gateway startup and reconnect
- Fix approach: Poll gateway status with exponential backoff or listen to gateway-log event for "ready" signal before reconnecting

**Agent workspace duplication with per-agent setting ignored:**
- Issue: Chat store creates per-agent workspaces but `setAgentModel()` only sets global `agents.defaults.model`, never per-agent workspace
- Files: `src/stores/chat-store.ts` (lines 607-634), `src/stores/settings-store.ts` (CLAUDE.md mentions "workspace defaults to ~/.openclaw-maxauto/workspace")
- Impact: Feature for per-agent workspace configuration is unused; all agents share default workspace despite creating separate workspace paths during creation
- Fix approach: Update `setAgentModel()` to persist per-agent workspace in `config.agents.perAgent.{agentId}.workspace` and load during `loadAgents()`

## Known Bugs

**Session loading filters empty sessions but displays stale history:**
- Issue: `loadSessions()` filters sessions where `updatedAt` is falsy (line 520), but `loadHistory()` doesn't validate that the session still exists on gateway before rendering
- Files: `src/stores/chat-store.ts` (lines 501-560, 379-499)
- Impact: User switches to a session, `loadHistory()` succeeds with old cached data, but session is actually deleted on gateway side, causing out-of-sync state
- Workaround: Refresh sessions list after loading history
- Fix: Add existence check in `loadHistory()` or handle "session not found" errors explicitly

**Tool result streaming overwrites instead of appending:**
- Issue: `appendStreamingText()` sets trailing text block entirely (line 182) instead of appending to existing content
- Files: `src/stores/chat-store.ts` (lines 167-199)
- Impact: Multiple streaming text updates overwrite previous text; final message loses all but last text chunk if tool results are streamed between text chunks
- Fix: Change line 182 from `text:` to `text: (lastBlock?.text ?? "") + text`

**No validation of malformed WebSocket frames:**
- Issue: Frame parsing in `gateway-client.ts` catches generic JSON parse errors but doesn't validate frame structure (missing `type`, `id`, `event` fields)
- Files: `src/api/gateway-client.ts` (lines 199-242)
- Impact: Invalid frames silently fail to parse; no distinction between recoverable parse errors and protocol violations
- Fix: Add strict schema validation with descriptive error messages per frame type

## Security Considerations

**Device private key stored unencrypted in localStorage:**
- Risk: Ed25519 private key persisted as base64 string in browser localStorage; accessible to XSS attacks or compromised browser extensions
- Files: `src/api/device-identity.ts` (lines 17, 94), `src/api/gateway-client.ts` (line 266)
- Current mitigation: localhost-only WebSocket connection, local Tauri renderer context (not web)
- Recommendations:
  1. Store private key in encrypted Tauri app state using platform keyring (Tauri plugin-keyring)
  2. Derive session-specific signing keys from master key instead of storing root key
  3. Consider hardware token support for device identity

**Gateway token stored in plaintext openclaw.json:**
- Risk: OAuth-like token written to `~/.openclaw-maxauto/config/openclaw.json` in plaintext; readable by other processes
- Files: `src-tauri/src/commands/gateway.rs` (lines 159-160, 192-194)
- Current mitigation: File permissions on user's home directory, local loopback binding
- Recommendations:
  1. Encrypt token at rest using system keychain/credential store
  2. Implement automatic token rotation (e.g., 30-day expiry)
  3. Never log or display token in debug output

**Provider API keys potentially logged or exposed:**
- Risk: Custom model API keys could be accidentally logged during config read/write or error handling
- Files: `src/stores/settings-store.ts` (lines 223-276 handle apiKey), potentially logged during JSON serialization
- Recommendations:
  1. Add `__secretContent()` wrapper to redact API keys from console logs
  2. Audit all `console.log()` calls for sensitive data
  3. Implement audit logging for config mutations

**No CORS validation on WebSocket upgrade:**
- Risk: Gateway accepts WebSocket from `http://localhost:5173` (Vite dev server) without proper origin validation
- Files: `src-tauri/src/commands/gateway.rs` (lines 60-65 hardcode allowed origins)
- Current mitigation: localhost-only, compiled app mode disables dev server
- Recommendations:
  1. Dynamically set allowed origins based on Tauri window configuration
  2. Validate `Origin` header during WebSocket handshake

## Performance Bottlenecks

**Full chat message history loaded on every session switch:**
- Problem: `loadHistory()` fetches 200 messages (line 399) regardless of UI visibility; blocks rendering until request completes
- Files: `src/stores/chat-store.ts` (lines 379-499)
- Cause: No pagination or lazy loading; all history loaded upfront
- Improvement path:
  1. Fetch only last 50 messages on initial load
  2. Implement "load older" button with cursor-based pagination
  3. Virtualize message list to reduce DOM nodes

**Settings store re-renders entire provider list on single provider change:**
- Problem: `loadConfig()` re-parses all providers and re-renders settings UI even if only one API key changed
- Files: `src/stores/settings-store.ts` (lines 462-503)
- Cause: Monolithic config state instead of normalized provider/model indices
- Improvement path:
  1. Split config state into `providers`, `models`, `defaultModel` separate keys
  2. Use selector functions in components to subscribe to only changed fields
  3. Implement structural sharing for unchanged provider configs

**Gateway startup polls system every 2 seconds during setup:**
- Problem: `SetupPage.tsx` repeatedly calls `checkGateway()` with hardcoded delays (line 72: 2000ms)
- Files: `src/pages/SetupPage.tsx` (lines 72, 79), `src-tauri/src/commands/gateway.rs` (line 345: 2000ms check)
- Impact: Wastes CPU, increases time-to-first-message by up to 2s
- Improvement: Listen for `gateway-log` event with "ready" marker instead of polling

**Debug log buffer circular shift is O(n):**
- Problem: `debugLog.shift()` at line 68 of `gateway-client.ts` is O(n) operation; happens on every frame
- Files: `src/api/gateway-client.ts` (lines 66-69)
- Impact: Minimal on typical usage (200 entries), but unnecessary allocation overhead
- Fix: Use circular array index instead of array.shift()

## Fragile Areas

**Chat message streaming state machine:**
- Files: `src/stores/chat-store.ts` (lines 113-276)
- Why fragile:
  1. Four separate streaming functions (`updateStreamingMessage`, `addStreamingToolCall`, `updateStreamingToolResult`, `appendStreamingText`) each mutate message state
  2. Tool result streaming logic (lines 152-166) assumes toolCall blocks exist; silently fails if called before toolCall added
  3. `contentBlocks` can be undefined or partially populated; no invariant enforcement
- Safe modification:
  1. Document state machine: user → assistant → toolCall → toolResult → text → finalize
  2. Add assertions in each function: "last message must be assistant streaming"
  3. Consolidate into single message updater function
- Test coverage: No unit tests visible for streaming state transitions; only integration tests via gateway

**Gateway WebSocket authentication handshake:**
- Files: `src/api/gateway-client.ts` (lines 180-326)
- Why fragile:
  1. `handshakeDone` flag relies on synchronous message ordering; no timeout if challenge never arrives
  2. Device identity generation is async, happens inside message handler (line 266) — potential race if multiple open events fire
  3. No retry logic if device identity generation fails (line 323: just close WebSocket)
- Safe modification:
  1. Implement handshake state machine: DISCONNECTED → WAIT_CHALLENGE → WAIT_RESPONSE → CONNECTED
  2. Set timeout on challenge wait (e.g., 10s); reconnect if expired
  3. Lock device identity generation to first-call-wins pattern
- Test coverage: Integration only; no unit tests for WebSocket protocol

**Config hash validation in settings store:**
- Files: `src/stores/settings-store.ts` (lines 462-503 load, 381-398 write)
- Why fragile:
  1. `baseHash` stored in Zustand state but not validated before write (line 625)
  2. Race condition: user modifies config via UI while `writeConfig()` is in flight; both use stale hash
  3. No conflict resolution strategy; last write wins
- Safe modification:
  1. Fetch hash before each write; abort with conflict error if mismatched
  2. Implement exponential backoff retry with user notification
  3. Show "config changed externally" dialog if hash fails
- Test coverage: No tests visible for config write conflicts

## Scaling Limits

**localStorage device identity persists indefinitely:**
- Current capacity: Ed25519 key (32 bytes) + public key (32 bytes) + metadata = ~200 bytes per device
- Limit: Not a storage limit, but security limit — device is bound to app instance permanently
- Scaling path: Implement device identity rotation (e.g., 90-day TTL) with offline fallback token

**Chat message history loaded from gateway at 200-message limit:**
- Current capacity: 200 messages per session (line 399 of chat-store.ts)
- Limit: Full history load becomes slow beyond 500-1000 messages; UI blocks
- Scaling path: Implement cursor-based pagination with binary search for time ranges

**Provider configuration stored as flat JSON object:**
- Current capacity: ~50 custom providers fit comfortably; 10,000+ model definitions are possible
- Limit: UI model selector becomes sluggish with 100+ models; config serialization delays increase
- Scaling path: Lazy-load model definitions; index by provider/category; implement search/filter in AddModelDialog

**Gateway process spawned per app instance:**
- Current capacity: Single gateway per app (only one port 51789 listening)
- Limit: No support for multiple concurrent app instances or multi-user scenarios
- Scaling path: Implement port negotiation (auto-increment on conflict) and session isolation per user

## Dependencies at Risk

**OpenClaw runtime dependency lacks version pinning:**
- Risk: OpenClaw installed into `~/.openclaw-maxauto/openclaw/` with no version constraint; git reference (`npm install` of latest) used
- Impact: Breaking changes in OpenClaw API could silently break gateway communication; no CI test against multiple OpenClaw versions
- Migration plan:
  1. Pin OpenClaw version in setup: `npm install openclaw@^1.5.0` with specific range
  2. Implement OpenClaw version check in gateway startup (query `openclaw --version`)
  3. Add compatibility matrix in CLAUDE.md

**Tauri v2 plugin-updater assumption:**
- Risk: Auto-update relies on `tauri-plugin-updater` with GitHub Releases backend (line 90 of update-store.ts); no fallback if GitHub is down
- Impact: App cannot check for updates if GitHub API is unavailable; users stay on old versions during outages
- Fix: Cache update check results; implement exponential backoff with user-friendly messaging

**@noble/ed25519 cryptography library:**
- Risk: Ed25519 signing is critical path (device authentication); library is maintained but non-standard (not crypto.subtle.sign())
- Impact: If library has bugs, all device auth fails; dependencies on unmaintained packages could introduce vulnerabilities
- Recommendations:
  1. Monitor @noble/ed25519 security advisories regularly
  2. Pin to ^1.7.0 (current stable); review semver changes
  3. Test against crypto.subtle.sign() implementation as fallback in production

## Missing Critical Features

**No offline mode:**
- Problem: App requires active gateway connection; no cached responses, UI blocks on network latency
- Blocks: Viewing chat history, reading settings during connection loss
- Priority: Medium — local-first architecture could cache last 50 messages and recent settings

**No error recovery for streaming interrupts:**
- Problem: If network drops during `chat.send`, message is lost; user must resend manually
- Blocks: Reliable message delivery for long-running sessions
- Priority: High — implement idempotency keys (already in sendMessage, line 316) to deduplicate retries

**No settings backup/export:**
- Problem: Custom models, provider configs, workspace paths not exportable; losing local data means reconfiguring all models
- Blocks: Multi-device setup, settings migration
- Priority: Low — implement `export-config` button that downloads JSON with redacted API keys

**No audit log of agent/model changes:**
- Problem: No history of who configured what; admins cannot see config change history
- Blocks: Compliance, debugging configuration issues
- Priority: Low — not needed for single-user app, but useful for team deployments

## Test Coverage Gaps

**No tests for WebSocket frame parsing:**
- What's not tested: Invalid frame types, missing fields, malformed JSON, protocol version mismatches
- Files: `src/api/gateway-client.ts` (lines 199-242)
- Risk: Silent failures on edge cases; no validation that frames match expected schema
- Priority: High — protocol violations should fail loudly

**No tests for streaming message state transitions:**
- What's not tested: Tool call → tool result ordering, missing blocks, concurrent streaming updates
- Files: `src/stores/chat-store.ts` (lines 113-276)
- Risk: UI corruption, lost tool results, incomplete messages
- Priority: High — state machine is complex and fragile

**No tests for config write conflicts:**
- What's not tested: Concurrent config mutations, hash mismatches, partial writes
- Files: `src/stores/settings-store.ts` (lines 381-398, 607-634)
- Risk: Config corruption or loss of custom model definitions
- Priority: Medium — race condition is unlikely but catastrophic if it happens

**No tests for device identity initialization:**
- What's not tested: Concurrent initialization, corruption of stored keys, keypair validation
- Files: `src/api/device-identity.ts` (lines 60-96)
- Risk: Multiple device IDs assigned, auth failures
- Priority: Medium — one-time initialization but critical for first run

**No tests for gateway startup/shutdown:**
- What's not tested: Orphaned process cleanup, timeout handling, multiple start calls
- Files: `src-tauri/src/commands/gateway.rs` (lines 266-368)
- Risk: Port conflicts, hung processes, setup failure on restart
- Priority: High — manual testing only; no coverage for edge cases

---

*Concerns audit: 2026-03-14*
