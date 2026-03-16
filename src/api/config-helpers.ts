import { gateway } from "./gateway-client";
import { useAppStore } from "../stores/app-store";
import { dockerGatewayStatus, startDockerGateway } from "./tauri-commands";

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
 * In Docker mode, if the connection doesn't recover within the first interval,
 * we check whether the container is still running. If the container stopped
 * (PID 1 exited during restart), we restart it explicitly.
 *
 * @param maxWaitMs - Maximum time to wait for reconnection (default: 15000ms)
 * @param pollMs - Polling interval (default: 500ms)
 * @returns `true` if reconnected, `false` if timed out
 */
export async function waitForReconnect(
  maxWaitMs = 15000,
  pollMs = 500
): Promise<boolean> {
  const { installMode, gatewayPort } = useAppStore.getState();
  const isDocker = installMode === "docker";

  // Docker container restarts are slower — give more time
  const effectiveMaxWait = isDocker ? Math.max(maxWaitMs, 30000) : maxWaitMs;

  // If still connected, wait briefly for the disconnect to happen
  // (gateway restart has ~2s default delay before SIGUSR1)
  if (gateway.connected) {
    await new Promise((r) => setTimeout(r, 2000));
  }

  let dockerRecoveryAttempted = false;
  const start = Date.now();
  while (Date.now() - start < effectiveMaxWait) {
    if (gateway.connected) return true;

    // In Docker mode, after 8s without reconnection, check if the container died
    // and restart it if needed (PID 1 exit causes container stop)
    if (isDocker && !dockerRecoveryAttempted && Date.now() - start > 8000) {
      dockerRecoveryAttempted = true;
      try {
        const status = await dockerGatewayStatus(gatewayPort);
        if (!status.running) {
          console.log("[config] Docker container stopped after config change, restarting...");
          await startDockerGateway(gatewayPort);
        }
      } catch (err) {
        console.warn("[config] Docker recovery check failed:", err);
      }
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }

  console.warn("[config] reconnect timeout, gateway may still be restarting");
  return false;
}
