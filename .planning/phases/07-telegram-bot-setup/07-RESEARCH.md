# Phase 7: Telegram Bot Setup - Research

**Researched:** 2026-03-14
**Domain:** Telegram bot token validation, channel status display, OpenClaw gateway integration
**Confidence:** HIGH

## Summary

This phase enhances the existing `IMChannelsSection.tsx` to add proper token validation (via Telegram Bot API `getMe`) before saving, and to display richer connection status from the gateway's `channels.status` response. The existing code already has the skeleton -- token input, config save via `patchConfig()`, and status loading via `channels.status` -- so this is an incremental enhancement, not a rewrite.

The key technical insight is that the gateway already has a full `probeTelegram()` function (in `openclaw/src/telegram/probe.ts`) that calls `getMe`, but it requires the token to already be saved in config. For pre-save validation, the simplest approach is to call the Telegram Bot API `getMe` endpoint directly from the frontend (it is a simple HTTPS GET with no CORS restrictions since it returns JSON from `api.telegram.org`). The `channels.status` response returns a rich `ChannelAccountSnapshot` with fields like `connected`, `linked`, `running`, `lastConnectedAt`, `lastError`, `lastInboundAt`, `lastOutboundAt`, and `probe` data including bot username.

**Primary recommendation:** Validate tokens by calling `https://api.telegram.org/bot{token}/getMe` from the frontend before saving. Display connection status using the full `ChannelAccountSnapshot` fields from `channels.status` with `probe: true`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Validate token via Telegram Bot API probe (getMe) before saving
- On success: show bot username + auto-save the token
- On failure: show error explaining invalid token, don't save
- Load-time check only (not live/real-time), with manual refresh option
- Detailed status: connected/disconnected/error color + bot username + last connected time
- Status fetched from `channels.status` gateway API on page load
- Enhance the existing IMChannelsSection.tsx -- don't rewrite from scratch
- Keep existing DM/group policy and pairing functionality intact

### Claude's Discretion
- Whether to use gateway or direct Telegram API for token validation
- Status indicator styling (dot, badge, icon)
- Layout of bot info display after validation
- Refresh button placement and style

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TELE-01 | User can enter and validate a Telegram bot token in-app | Direct `getMe` API call for pre-save validation; existing `botToken` input in IMChannelsSection; `patchConfig()` for save |
| TELE-05 | User can see connection status of the Telegram bot (connected/disconnected/error) | `channels.status` with `probe: true` returns `ChannelAccountSnapshot` with `connected`, `linked`, `running`, `lastConnectedAt`, `lastError`, and `probe.bot.username` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI framework | Already in project |
| Tailwind CSS | 3.4 | Styling | Already in project |
| lucide-react | (installed) | Icons | Already used in IMChannelsSection |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gateway-client | local | WebSocket gateway communication | For `channels.status` requests |
| config-helpers | local | `patchConfig()` + `waitForReconnect()` | For saving token to config |

No new dependencies needed. Everything uses existing project infrastructure.

## Architecture Patterns

### Existing File to Modify
```
src/
└── components/
    └── settings/
        └── IMChannelsSection.tsx   # ~490 lines, enhance in-place
```

### Pattern 1: Direct Telegram API Validation (Recommended)
**What:** Call `https://api.telegram.org/bot{token}/getMe` directly from the frontend before saving
**When to use:** Before saving a new or changed bot token
**Why over gateway:** The gateway probe requires the token to already be in config. Direct validation gives immediate feedback without a save-restart cycle.

```typescript
// Validate token by calling Telegram Bot API directly
async function validateBotToken(token: string): Promise<{
  valid: boolean;
  botUsername?: string;
  botId?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json() as {
      ok?: boolean;
      description?: string;
      result?: { id?: number; username?: string };
    };
    if (!res.ok || !data?.ok) {
      return {
        valid: false,
        error: data?.description ?? `Token validation failed (${res.status})`,
      };
    }
    return {
      valid: true,
      botUsername: data.result?.username ?? undefined,
      botId: data.result?.id ?? undefined,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
```

**Note:** Telegram Bot API does NOT have CORS restrictions. `getMe` works from any origin. This is confirmed by the OpenClaw probe implementation which uses the same endpoint (`https://api.telegram.org/bot${token}/getMe`).

### Pattern 2: Rich Status from channels.status
**What:** Use `channels.status` with `probe: true` for detailed connection info
**When to use:** On page load and manual refresh

The `ChannelAccountSnapshot` schema (from `openclaw/src/gateway/protocol/schema/channels.ts`) includes these fields relevant to our display:

```typescript
// Key fields from ChannelAccountSnapshot
interface ChannelAccountSnapshot {
  accountId: string;
  enabled?: boolean;
  configured?: boolean;
  linked?: boolean;           // true when bot is connected and polling
  running?: boolean;          // true when channel process is running
  connected?: boolean;        // true when connected to Telegram API
  lastConnectedAt?: number;   // Unix timestamp ms
  lastError?: string;         // Last error message if any
  lastStartAt?: number;
  lastStopAt?: number;
  lastInboundAt?: number;     // Last message received
  lastOutboundAt?: number;    // Last message sent
  botTokenSource?: string;    // "config" | "env" | "tokenFile" | "none"
  probe?: {                   // Only with probe: true
    ok: boolean;
    error?: string | null;
    elapsedMs: number;
    bot?: {
      id?: number | null;
      username?: string | null;
      canJoinGroups?: boolean | null;
      canReadAllGroupMessages?: boolean | null;
    };
  };
}
```

**Important:** The existing code calls `channels.status` with `{ probe: false }`. For richer data (bot username, connection verification), change to `{ probe: true }`. Note that probing adds latency (network call to Telegram API) so only use it on explicit load/refresh, not on every render.

### Pattern 3: Updated channels.status Response Shape
**What:** The response shape is `channelAccounts` as an array per channel (not a Record)

The existing code in IMChannelsSection treats `channelAccounts` as `Record<string, Record<string, ChannelAccountSnapshot>>`. However, the actual schema (`ChannelsStatusResultSchema`) defines it as:
```typescript
channelAccounts: Record<string, ChannelAccountSnapshot[]>  // Array, not nested Record
```

The existing code does `Object.values(tgAccounts)[0]` which works for both shapes, but the proper handling is:
```typescript
const result = await gateway.request<{
  channelAccounts?: Record<string, ChannelAccountSnapshot[]>;
}>("channels.status", { probe: true });

const tgAccounts = result.channelAccounts?.telegram;
if (tgAccounts && tgAccounts.length > 0) {
  setChannelStatus(tgAccounts[0]);  // First/default account
}
```

### Pattern 4: Token Format Pre-validation
**What:** Basic format check before making network request
**When to use:** Before calling `getMe`

```typescript
// Telegram bot tokens follow pattern: {botId}:{alphanumeric-hash}
// e.g., 123456789:ABCdefGhIjKlMnOpQrStUvWxYz_0123456789
function isPlausibleBotToken(token: string): boolean {
  return /^\d+:[A-Za-z0-9_-]{30,}$/.test(token.trim());
}
```

### Anti-Patterns to Avoid
- **Don't validate via gateway probe:** The gateway `channels.status` probe only works after the token is saved and the gateway has restarted. Pre-save validation must go direct.
- **Don't poll for status updates:** User decision is load-time check + manual refresh only.
- **Don't rewrite the component:** Enhance the existing structure. The DM/group policy and pairing sections stay as-is.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config saving | Custom HTTP/file writes | `patchConfig()` from config-helpers.ts | Handles optimistic locking, merge semantics, gateway restart |
| Gateway communication | Raw WebSocket | `gateway.request()` from gateway-client.ts | Handles framing, auth, reconnection |
| Token storage path | Custom config structure | `channels.telegram.botToken` (existing path) | Already established in the codebase |

## Common Pitfalls

### Pitfall 1: CORS with Telegram API
**What goes wrong:** Developers worry about CORS when calling Telegram API from browser
**Why it happens:** Misunderstanding of CORS policy
**How to avoid:** Telegram Bot API does NOT enforce CORS. Direct `fetch()` from the frontend works fine. The OpenClaw source confirms this -- `probe.ts` uses the same pattern.
**Warning signs:** N/A -- this is not actually a problem

### Pitfall 2: Stale Status After Token Change
**What goes wrong:** After saving a new token, the status display still shows old data
**Why it happens:** `patchConfig()` triggers a gateway restart. Status is stale until reconnection completes.
**How to avoid:** After `waitForReconnect()`, re-fetch `channels.status` with `probe: true` to get fresh data.
**Warning signs:** Status badge shows "Connected" right after entering a new token

### Pitfall 3: Probe Timeout on Slow Networks
**What goes wrong:** `channels.status` with `probe: true` hangs or times out
**Why it happens:** Probe makes real HTTP calls to Telegram API (up to 10s timeout by default)
**How to avoid:** Use `{ probe: true, timeoutMs: 5000 }` for a reasonable timeout. Show a loading indicator during probe.
**Warning signs:** UI appears frozen when loading channel status

### Pitfall 4: Token Visibility in DevTools
**What goes wrong:** Bot token visible in Network tab when calling getMe
**Why it happens:** Token is in the URL path of the Telegram API call
**How to avoid:** This is inherent to Telegram's API design. The token is also stored in the config file on disk. Not a real concern for a desktop app.
**Warning signs:** N/A -- acceptable for desktop app context

### Pitfall 5: ChannelAccountSnapshot Type Mismatch
**What goes wrong:** Frontend TypeScript type for `ChannelAccountSnapshot` is too narrow
**Why it happens:** The existing interface only has `enabled, configured, linked, status, label`
**How to avoid:** Expand the `ChannelAccountSnapshot` interface to include the additional fields needed: `connected`, `running`, `lastConnectedAt`, `lastError`, `lastInboundAt`, `lastOutboundAt`, `probe`, `botTokenSource`
**Warning signs:** Type errors when accessing `.probe.bot.username` or `.lastConnectedAt`

## Code Examples

### Token Validation Flow
```typescript
// In IMChannelsSection.tsx
const [validating, setValidating] = useState(false);
const [validationResult, setValidationResult] = useState<{
  valid: boolean;
  botUsername?: string;
  error?: string;
} | null>(null);

async function handleValidateAndSave() {
  const trimmed = botToken.trim();
  if (!trimmed) return;

  // Quick format check
  if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(trimmed)) {
    setValidationResult({ valid: false, error: "Invalid token format. Expected: 123456789:ABCdef..." });
    return;
  }

  setValidating(true);
  setValidationResult(null);

  try {
    const res = await fetch(`https://api.telegram.org/bot${trimmed}/getMe`);
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      setValidationResult({
        valid: false,
        error: data?.description ?? "Invalid bot token",
      });
      return;
    }
    // Valid -- save automatically
    setValidationResult({
      valid: true,
      botUsername: data.result?.username,
    });
    // Proceed to save via patchConfig
    await saveTelegramConfig();
  } catch (err) {
    setValidationResult({
      valid: false,
      error: "Could not reach Telegram API. Check your network.",
    });
  } finally {
    setValidating(false);
  }
}
```

### Status Display
```typescript
// Derive display state from ChannelAccountSnapshot
function getStatusDisplay(status: ChannelAccountSnapshot | null): {
  color: string;  // CSS variable
  label: string;
  detail?: string;
} {
  if (!status) {
    return { color: "var(--color-text-muted)", label: "Not Set Up" };
  }
  if (!status.configured) {
    return { color: "var(--color-text-muted)", label: "Not Configured" };
  }
  if (!status.enabled) {
    return { color: "var(--color-text-muted)", label: "Disabled" };
  }
  if (status.connected || status.linked) {
    const detail = status.lastConnectedAt
      ? `Since ${new Date(status.lastConnectedAt).toLocaleString()}`
      : undefined;
    return { color: "var(--color-success)", label: "Connected", detail };
  }
  if (status.lastError) {
    return { color: "var(--color-error)", label: "Error", detail: status.lastError };
  }
  return { color: "var(--color-warning)", label: "Disconnected" };
}
```

### Refresh Button
```typescript
// Manual refresh for status
const [refreshing, setRefreshing] = useState(false);

async function handleRefreshStatus() {
  setRefreshing(true);
  try {
    await loadChannelStatus();  // Modified to use probe: true
  } finally {
    setRefreshing(false);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Save token blindly, check after restart | Validate via getMe before save | This phase | Prevents invalid tokens from causing gateway errors |
| Simple "Connected/Configured/Not Set Up" badge | Rich status with probe data, bot info, timestamps | This phase | Better debugging and user confidence |
| `channelAccounts` as nested Record | `channelAccounts` as array per channel | Already in gateway | Frontend type should be corrected |

## Open Questions

1. **Tauri fetch restrictions**
   - What we know: Tauri v2 has CSP and `allowlist` for HTTP. Standard `fetch()` may be blocked by Tauri's security model.
   - What's unclear: Whether `api.telegram.org` needs to be added to `tauri.conf.json` security scope
   - Recommendation: Check if direct fetch works in dev mode. If blocked, add `api.telegram.org` to allowed external URLs in tauri config, OR use a Rust command to make the HTTP call.

2. **Bot username persistence**
   - What we know: After validation, we show the bot username. On page reload, we only have it if we probe again.
   - What's unclear: Whether to store the username locally or always derive it from probe
   - Recommendation: Always fetch from `channels.status` with `probe: true` on load. The gateway caches probe results. No need for separate persistence.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in MaxAuto frontend |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TELE-01 | Token validation via getMe, format check, save on success | manual-only | Manual: enter valid/invalid tokens in UI | N/A |
| TELE-05 | Status display from channels.status | manual-only | Manual: check status badge with running/stopped bot | N/A |

**Justification for manual-only:** This is a Tauri desktop app with no frontend test infrastructure. The changes are UI-focused (input validation, status display) that require a running gateway to test meaningfully. The validation logic is straightforward (single API call + response check).

### Sampling Rate
- **Per task commit:** `pnpm build` (TypeScript compilation check)
- **Per wave merge:** Manual verification in dev mode
- **Phase gate:** Full manual verification per success criteria

### Wave 0 Gaps
None -- no test infrastructure exists for the frontend, and adding one is out of scope for this phase.

## Sources

### Primary (HIGH confidence)
- `openclaw/src/telegram/probe.ts` -- Telegram Bot API probe implementation using `getMe`
- `openclaw/src/gateway/protocol/schema/channels.ts` -- `ChannelAccountSnapshot` schema with all fields
- `openclaw/src/gateway/server-methods/channels.ts` -- `channels.status` handler implementation
- `openclaw/src/telegram/account-inspect.ts` -- Token resolution and inspection logic
- `src/components/settings/IMChannelsSection.tsx` -- Existing component to enhance
- `src/api/config-helpers.ts` -- `patchConfig()` and `waitForReconnect()` implementations
- `docs/gateway-protocol.md` -- Protocol reference

### Secondary (MEDIUM confidence)
- Telegram Bot API `getMe` endpoint behavior (well-documented, stable API)

### Tertiary (LOW confidence)
- Tauri v2 CSP / fetch restrictions for external API calls (needs runtime verification)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new deps needed
- Architecture: HIGH - patterns derived directly from existing codebase and gateway source
- Pitfalls: HIGH - identified from real code analysis of probe implementation and config flow

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- Telegram Bot API and gateway protocol are mature)
