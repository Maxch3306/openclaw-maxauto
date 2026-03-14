import { gateway } from "./gateway-client";

/**
 * Send a partial config patch to the gateway using merge-patch semantics (RFC 7396).
 *
 * The gateway deep-merges the patch into the existing config, validates the result,
 * writes the file, and triggers an auto-restart. Only include the fields you want
 * to change in the patch object.
 *
 * **Important:** Setting a key to `null` in the patch will DELETE that key from
 * the config (merge-patch semantics). Use `undefined` (stripped by JSON.stringify)
 * to skip a field, or use empty string `""` to clear a value without deleting the key.
 *
 * @param patch - Partial config object containing only the fields to change
 * @param options.restartDelayMs - Override the gateway's default restart delay (2000ms)
 * @returns The restart status from the gateway response
 */
export async function patchConfig(
  patch: Record<string, unknown>,
  options?: { restartDelayMs?: number }
): Promise<{ restart: { ok: boolean; delayMs: number; coalesced: boolean } }> {
  // Get current config hash for optimistic locking
  const { hash } = await gateway.request<{ hash: string }>("config.get", {});

  // Send partial config as JSON string; gateway handles deep-merge + validation + restart
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
 * Wait for the gateway WebSocket to reconnect after an auto-restart.
 *
 * After `config.patch`, the gateway restarts with a default 2s delay. The WebSocket
 * connection will close and `GatewayClient` will auto-reconnect (3s timer). This
 * function polls `gateway.connected` until reconnection succeeds or times out.
 *
 * @param maxWaitMs - Maximum time to wait for reconnection (default: 15000ms)
 * @param pollMs - Polling interval (default: 500ms)
 * @returns `true` if reconnected, `false` if timed out
 */
export async function waitForReconnect(
  maxWaitMs = 15000,
  pollMs = 500
): Promise<boolean> {
  // If still connected, wait briefly for the disconnect to happen
  // (gateway restart has ~2s default delay before SIGUSR1)
  if (gateway.connected) {
    await new Promise((r) => setTimeout(r, 2000));
  }

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (gateway.connected) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }

  console.warn("[config] reconnect timeout, gateway may still be restarting");
  return false;
}
