# Phase 1: Config Infrastructure - Research

**Researched:** 2026-03-14
**Domain:** OpenClaw config write semantics, gateway protocol, merge-patch
**Confidence:** HIGH

## Summary

The OpenClaw gateway already provides a `config.patch` method that accepts a partial JSON object, deep-merges it into the existing config using RFC 7396-style merge-patch semantics, validates the result, writes the file, and triggers an auto-restart via SIGUSR1. This is exactly what MaxAuto needs -- the infrastructure exists in the gateway; MaxAuto just needs to stop using `config.set` (full-replace) and `writeConfig` (Tauri IPC file write) in favor of `config.patch`.

The current MaxAuto code has two distinct config write patterns: (1) `readConfigFile()` then `writeConfigAndRestart()` via Tauri IPC in settings-store.ts (10 methods), and (2) `config.get` then `config.set` via gateway WebSocket in IMChannelsSection.tsx and chat-store.ts (3 call sites). Both are read-modify-write cycles vulnerable to race conditions. Both need migration to `config.patch`. Since `config.patch` handles auto-restart internally, the manual restart logic (disconnect, stop, sleep 1.5s, start, sleep 3s, reconnect, sleep 2s) can be replaced with WebSocket reconnection polling.

**Primary recommendation:** Create a `patchConfig` helper function that calls `gateway.request("config.patch", { baseHash, raw })` with the partial config object, then handles reconnection. Migrate all 13 config write call sites to use it.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation details are at Claude's discretion.

### Claude's Discretion
- Migration strategy: full migration vs foundation + incremental (Claude decides based on complexity)
- Restart strategy: config.patch auto-restart vs manual restart with improved polling (current hardcoded delays are 1.5s/3s/2s)
- Code organization: where the new config helper lives (new utility vs extend settings-store vs inline)
- Windows fallback for SIGUSR1-based auto-restart

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | Config writes use `config.patch` (merge semantics) instead of full replace to prevent race conditions | Gateway `config.patch` method exists with deep-merge, validation, and auto-restart. 13 call sites identified for migration. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| OpenClaw gateway `config.patch` | Current | Server-side merge-patch with validation + auto-restart | Built into gateway, handles merge, validation, file write, and restart atomically |
| GatewayClient (existing) | 0.1.0 | WebSocket client for `config.patch` calls | Already used for `config.get`/`config.set`, no new dependencies needed |

### Supporting
No new libraries needed. This phase uses only existing infrastructure.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `config.patch` (gateway) | Client-side merge + `config.set` | Would require implementing merge logic in frontend; still vulnerable to races between gateway reads; pointless duplication |
| `config.patch` (gateway) | Tauri IPC `writeConfig` with manual merge | Bypasses gateway validation, doesn't trigger auto-restart, more code to maintain |

## Architecture Patterns

### Recommended Helper Location
Create a new utility module rather than bloating settings-store:

```
src/
├── api/
│   ├── gateway-client.ts      # Existing WebSocket client
│   └── config-helpers.ts      # NEW: patchConfig(), waitForReconnect()
├── stores/
│   ├── settings-store.ts      # Migrated to use patchConfig()
│   └── chat-store.ts          # Migrated to use patchConfig()
└── components/
    └── settings/
        └── IMChannelsSection.tsx  # Migrated to use patchConfig()
```

### Pattern 1: Config Patch Helper
**What:** A reusable async function that fetches current config hash, sends a partial patch, and handles reconnection after auto-restart.
**When to use:** Every config write operation.
**Example:**
```typescript
// Source: OpenClaw gateway config.ts handler (verified in source)
// config.patch params: { raw: string, baseHash?: string, restartDelayMs?: number }

export async function patchConfig(patch: Record<string, unknown>): Promise<void> {
  // 1. Get current hash for optimistic locking
  const { hash } = await gateway.request<{ hash: string }>("config.get", {});

  // 2. Send partial config as JSON string
  await gateway.request("config.patch", {
    baseHash: hash,
    raw: JSON.stringify(patch),
  });

  // 3. Gateway auto-restarts via SIGUSR1; wait for reconnection
  await waitForReconnect();
}
```

### Pattern 2: Reconnection After Auto-Restart
**What:** Poll-based reconnection instead of hardcoded sleep delays.
**When to use:** After any `config.patch` call (gateway restarts automatically).
**Example:**
```typescript
async function waitForReconnect(maxWaitMs = 15000, pollMs = 500): Promise<void> {
  // Gateway sends SIGUSR1 to itself with ~2s default delay
  // WebSocket will close; GatewayClient auto-reconnects (3s timer in scheduleReconnect)
  // Poll gateway.connected until true or timeout
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (gateway.connected) return;
    await new Promise(r => setTimeout(r, pollMs));
  }
  // Don't throw -- gateway may still be restarting, client will reconnect
  console.warn("[config] reconnect timeout, gateway may still be restarting");
}
```

### Pattern 3: Caller Migration (settings-store example)
**What:** Replace read-modify-write cycles with targeted patch objects.
**Before (current):**
```typescript
// settings-store.ts setProviderAuth -- current pattern (read-modify-write, race-prone)
const config = await readConfigFile();
const existingProviders = cfg.models?.providers ?? {};
const providers = { ...existingProviders, [key]: providerEntry };
const newConfig = { ...config, models: { ...cfg.models, providers }, agents };
await writeConfigAndRestart(newConfig);
```
**After (with config.patch):**
```typescript
// settings-store.ts setProviderAuth -- migrated to config.patch
await patchConfig({
  models: { providers: { [key]: providerEntry } },
  agents: { defaults: { models: updatedDefaultModels } },
});
```

### Anti-Patterns to Avoid
- **Reading full config just to merge one field:** config.patch handles the merge server-side. Only send the fields you're changing.
- **Manual restart after config.patch:** config.patch triggers SIGUSR1 auto-restart. Do NOT call stopGateway/startGateway afterward.
- **Sending `null` values accidentally:** In RFC 7396 merge-patch, `null` means DELETE the key. Only set fields to `null` when intentionally removing config keys.
- **Skipping baseHash:** Always include baseHash from a recent `config.get` for optimistic locking. The gateway rejects stale hashes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep merge of config objects | Custom recursive merge | `config.patch` gateway method | Gateway's `applyMergePatch()` handles prototype pollution protection, blocked keys, id-keyed array merging, and recursive object merge |
| Config validation | JSON schema validation in frontend | Gateway's built-in validation pipeline | Gateway runs zod schema validation, legacy migrations, plugin validation, redacted value restoration |
| Gateway restart after config change | Manual stop/start with sleep timers | `config.patch` auto-restart via SIGUSR1 | Gateway handles restart scheduling with cooldown (30s), coalescing, and pre-restart deferral for in-flight work |
| Optimistic locking | Version counter in frontend state | Gateway's `baseHash` check | Gateway computes SHA hash of config file, rejects writes with stale hash |

**Key insight:** The gateway already implements ALL the hard parts -- merge, validation, file write, restart scheduling. MaxAuto's job is just to send the right partial objects and handle reconnection.

## Common Pitfalls

### Pitfall 1: Null Means Delete in Merge-Patch
**What goes wrong:** Sending `{ channels: { telegram: { botToken: null } } }` deletes the botToken key entirely instead of setting it to empty.
**Why it happens:** RFC 7396 merge-patch treats `null` as "remove this key" (verified in `applyMergePatch` source: `if (value === null) { delete result[key]; }`).
**How to avoid:** Use `undefined` (which gets stripped by JSON.stringify) to skip a field, or use empty string `""` instead of null for "clear this value".
**Warning signs:** Config keys mysteriously disappearing after patch.

### Pitfall 2: Array Replacement vs Merge
**What goes wrong:** Sending `{ models: { providers: { myProvider: { models: [newModel] } } } }` replaces the entire models array instead of appending.
**Why it happens:** `config.patch` uses `mergeObjectArraysById` option, which merges arrays of objects with `id` fields by matching IDs. But if the base array items lack `id` fields, the entire array is replaced.
**How to avoid:** For provider models, always include the full models array in the patch (provider models have `id` fields so they'll merge by ID). Or better: send the complete provider object.
**Warning signs:** Models disappearing after adding a new provider.

### Pitfall 3: Reconnection Timing After Auto-Restart
**What goes wrong:** Frontend tries to make gateway requests during the restart window and gets "Not connected" errors.
**Why it happens:** `config.patch` auto-restart has a default 2s delay (`delayMsRaw` defaults to 2000 in `scheduleGatewaySigusr1Restart`), plus a 30s cooldown between restarts. The gateway process restarts and needs time to re-bind the port.
**How to avoid:** After `config.patch`, wait for WebSocket reconnection before reloading config/models. The `GatewayClient` already has auto-reconnect with 3s timer.
**Warning signs:** Intermittent "Not connected" errors after saving settings.

### Pitfall 4: Windows SIGUSR1 Behavior
**What goes wrong:** `config.patch` auto-restart may behave differently on Windows because SIGUSR1 is Unix-only.
**Why it happens:** OpenClaw's `restart.ts` shows Windows uses `relaunchGatewayScheduledTask()` instead of SIGUSR1. The `config.patch` handler calls `scheduleGatewaySigusr1Restart` which uses `process.emit("SIGUSR1")` (in-process, not OS signal), so it works cross-platform when Node has a SIGUSR1 listener registered.
**How to avoid:** This is handled by OpenClaw internally. The `mode` field in the restart response indicates whether it used `emit` (in-process) or `signal`. MaxAuto doesn't need a special Windows fallback -- just rely on the gateway's built-in restart mechanism.
**Warning signs:** Gateway not restarting after config.patch on Windows. Check if the response includes `restart.ok: true`.

### Pitfall 5: Stale baseHash After Failed Patch
**What goes wrong:** A failed `config.patch` (e.g., validation error) doesn't change the config, but the caller doesn't know if the hash is still valid for retry.
**Why it happens:** Failed patches don't modify the config file, so the hash remains valid. But if another caller writes in between, the hash becomes stale.
**How to avoid:** On `config.patch` failure, re-fetch with `config.get` before retrying.

## Code Examples

### Complete patchConfig Helper
```typescript
// Source: Derived from OpenClaw gateway config.ts handler analysis
import { gateway } from "./gateway-client";

/**
 * Send a partial config patch to the gateway.
 * The gateway deep-merges it into the existing config, validates,
 * writes the file, and triggers an auto-restart.
 *
 * @param patch - Partial config object (only include fields to change)
 * @param options.restartDelayMs - Override restart delay (default: 2000ms)
 */
export async function patchConfig(
  patch: Record<string, unknown>,
  options?: { restartDelayMs?: number }
): Promise<{ restart: { ok: boolean; delayMs: number; coalesced: boolean } }> {
  const { hash } = await gateway.request<{ hash: string }>("config.get", {});

  const result = await gateway.request<{
    ok: boolean;
    config: Record<string, unknown>;
    restart: { ok: boolean; delayMs: number; coalesced: boolean };
  }>("config.patch", {
    baseHash: hash,
    raw: JSON.stringify(patch),
    ...(options?.restartDelayMs !== undefined ? { restartDelayMs: options.restartDelayMs } : {}),
  });

  return { restart: result.restart };
}

/**
 * Wait for gateway WebSocket to reconnect after a restart.
 */
export async function waitForReconnect(
  maxWaitMs = 15000,
  pollMs = 500
): Promise<boolean> {
  // If still connected (restart not yet happened), wait briefly for disconnect
  if (gateway.connected) {
    await new Promise(r => setTimeout(r, 2000));
  }

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (gateway.connected) return true;
    await new Promise(r => setTimeout(r, pollMs));
  }
  return false;
}
```

### Migration Example: setProviderAuth
```typescript
// Before: 70 lines of read-modify-write
setProviderAuth: async (key, apiKey, baseUrl) => {
  const config = await readConfigFile();
  // ... complex spread-merge logic ...
  await writeConfigAndRestart(newConfig);
  await get().loadConfig();
  await get().loadModels();
},

// After: ~20 lines with targeted patch
setProviderAuth: async (key, apiKey, baseUrl) => {
  const defaults = PROVIDER_DEFAULTS[key];
  if (!defaults) throw new Error(`Unknown provider "${key}"`);

  const providerEntry = {
    baseUrl: baseUrl?.trim() || defaults.baseUrl,
    api: defaults.api,
    apiKey,
    ...defaults.extraConfig,
    ...(defaults.models.length > 0 ? { models: defaults.models } : {}),
  };

  const modelEntries: Record<string, unknown> = {};
  for (const m of defaults.models) {
    modelEntries[`${key}/${m.id}`] = {};
  }

  await patchConfig({
    models: { providers: { [key]: providerEntry } },
    agents: { defaults: { models: modelEntries } },
  });
  await waitForReconnect();
  await get().loadConfig();
  await get().loadModels();
},
```

### Migration Example: IMChannelsSection saveTelegramConfig
```typescript
// Before: config.get → full merge → config.set → manual restart
const fullConfig = await gateway.request("config.get", {});
const newConfig = { ...fullConfig.config, channels };
await gateway.request("config.set", { baseHash: fullConfig.hash, raw: JSON.stringify(newConfig) });
await restartGateway(); // manual stop/start with sleep

// After: targeted patch, auto-restart
await patchConfig({
  channels: {
    telegram: {
      enabled: true,
      botToken: botToken.trim() || undefined,
      dmPolicy,
      groupPolicy,
      ...(allowFromList.length > 0 ? { allowFrom: allowFromList } : {}),
    },
  },
});
await waitForReconnect();
```

### Key Difference: config.set vs config.patch
```
config.set:
  - Params: { raw: "full JSON string", baseHash }
  - Replaces entire config file
  - Does NOT auto-restart
  - Client must handle restart manually

config.patch:
  - Params: { raw: "partial JSON string", baseHash, restartDelayMs? }
  - Deep-merges partial into existing config
  - Auto-restarts via SIGUSR1 (with 2s default delay)
  - Returns restart status: { ok, delayMs, coalesced }
  - Has 30s cooldown between restarts (coalesces rapid writes)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `readConfigFile()` + spread merge + `writeConfigAndRestart()` | `config.patch` via gateway | Available in current OpenClaw | Eliminates race conditions, removes 6.5s of hardcoded delays per save |
| `config.set` + manual restart | `config.patch` with auto-restart | Available in current OpenClaw | Server handles merge + restart atomically |
| Hardcoded sleep delays (1.5s+3s+2s) | Poll-based reconnection | This migration | Responsive UX, saves 3-5 seconds per config change |

## Call Site Inventory

All config write call sites that need migration:

### settings-store.ts (10 call sites, all use `readConfigFile` + `writeConfigAndRestart`)
1. `addCustomModel` (line 508) - adds custom model provider
2. `updateCustomModel` (line 543) - updates existing custom model
3. `removeCustomModel` (line 583) - removes custom model
4. `replaceProviderModels` (line 628) - replaces all models for a provider
5. `setProviderAuth` (line 670) - configures built-in provider API key
6. `removeProvider` (line 744) - removes provider entirely
7. `addQuickProvider` (line 779) - adds Bailian Coding preset
8. `removeQuickProvider` (line 814) - removes Bailian Coding preset

### chat-store.ts (1 call site, uses `config.get` + `config.set`)
9. `setAgentModel` (line 607) - sets default agent model

### IMChannelsSection.tsx (2 call sites, uses `config.get` + `config.set` + manual restart)
10. `saveTelegramConfig` (line 157) - saves Telegram channel config
11. `disableTelegram` (line 206) - disables Telegram channel

### Cleanup targets
12. `writeConfigAndRestart()` function (line 381) - can be removed after migration
13. `readConfigFile()` function (line 375) - may still be needed for `loadConfig` fallback
14. `restartGateway()` in IMChannelsSection (line 72) - can be removed after migration

**Total: 11 write call sites to migrate, 2-3 helper functions to remove.**

## Merge-Patch Semantics (from source)

Key rules from `applyMergePatch()` in OpenClaw source:

1. **Objects merge recursively:** `{ a: { b: 1 } }` + `{ a: { c: 2 } }` = `{ a: { b: 1, c: 2 } }`
2. **`null` deletes keys:** `{ a: null }` removes key `a`
3. **Non-object patches replace:** `{ a: [1,2] }` replaces any existing `a` value
4. **Arrays of objects merge by `id`:** When `mergeObjectArraysById` is true (it is for `config.patch`), arrays of objects with `id` string fields are merged by matching IDs; new IDs are appended
5. **Prototype pollution blocked:** `__proto__`, `constructor`, `prototype` keys are silently dropped
6. **Non-id arrays replace:** Arrays without `id` fields in all entries are fully replaced

## Open Questions

1. **Provider removal via config.patch**
   - What we know: Setting a key to `null` in merge-patch deletes it. So `{ models: { providers: { "mykey": null } } }` should remove provider `mykey`.
   - What's unclear: Whether this works correctly with the gateway's validation pipeline (will it validate a config without the removed provider?).
   - Recommendation: Test this pattern. If validation fails, fall back to `config.apply` (which takes a full config but also auto-restarts).

2. **Removing entries from agents.defaults.models**
   - What we know: `null` deletes keys in merge-patch. So `{ agents: { defaults: { models: { "provider/model": null } } } }` should work.
   - What's unclear: Same validation concern as above.
   - Recommendation: Test during implementation. This pattern is critical for `removeCustomModel` and `removeProvider`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently configured |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | config.patch sends partial config and merges correctly | manual-only | Manual: test in running app with multiple settings sections | N/A |
| INFR-01 | Two rapid config writes don't clobber each other | manual-only | Manual: rapid-click two different settings sections | N/A |

**Justification for manual-only:** This is a Tauri desktop app with no test framework configured. The config writes go through a live WebSocket to a running OpenClaw gateway -- unit testing would require mocking the entire gateway protocol. The existing OpenClaw source already has comprehensive tests for `applyMergePatch` (merge-patch.test.ts). MaxAuto's responsibility is just calling the right API method.

### Sampling Rate
- **Per task commit:** Manual verification -- change a setting, verify config file has correct merged content
- **Per wave merge:** Manual verification -- rapidly change settings in different sections, verify no data loss
- **Phase gate:** Verify all 11 call sites use config.patch; verify writeConfigAndRestart removed

### Wave 0 Gaps
- No test infrastructure to set up for this phase (manual testing appropriate for config write infrastructure)
- Consider adding Vitest in a future phase for utility function testing

## Sources

### Primary (HIGH confidence)
- OpenClaw source `openclaw/src/gateway/server-methods/config.ts` - verified `config.patch` handler, params schema, merge behavior, auto-restart
- OpenClaw source `openclaw/src/config/merge-patch.ts` - verified `applyMergePatch()` implementation, null-delete, id-merge
- OpenClaw source `openclaw/src/gateway/protocol/schema/config.ts` - verified `ConfigPatchParamsSchema` = `{ raw, baseHash?, sessionKey?, note?, restartDelayMs? }`
- OpenClaw source `openclaw/src/infra/restart.ts` - verified `scheduleGatewaySigusr1Restart` with 2s default delay, 30s cooldown, coalescing, Windows emit mode
- MaxAuto source `src/stores/settings-store.ts` - verified 8 config write call sites using readConfigFile+writeConfigAndRestart
- MaxAuto source `src/stores/chat-store.ts` - verified 1 config write call site using config.set
- MaxAuto source `src/components/settings/IMChannelsSection.tsx` - verified 2 config write call sites using config.set + manual restart
- MaxAuto source `src/api/gateway-client.ts` - verified WebSocket client with auto-reconnect (3s timer)

### Secondary (MEDIUM confidence)
- None needed -- all findings from primary source analysis

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - directly verified in OpenClaw source code
- Architecture: HIGH - clear migration path from existing patterns to config.patch
- Pitfalls: HIGH - merge-patch semantics verified in source, restart behavior verified in source

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable infrastructure, unlikely to change)
