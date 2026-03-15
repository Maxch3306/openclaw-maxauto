import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { gateway } from "../../api/gateway-client";
import { useAppStore } from "../../stores/app-store";

let debugWindow: Window | null = null;

function openDebugWindow() {
  // If already open and not closed, focus it
  if (debugWindow && !debugWindow.closed) {
    debugWindow.focus();
    return;
  }

  const w = window.open("", "maxauto-debug", "width=800,height=600,menubar=no,toolbar=no,status=no");
  if (!w) return;
  debugWindow = w;

  w.document.title = "MaxAuto — Gateway Debug Log";
  w.document.head.innerHTML = `<style>
    body { margin: 0; padding: 12px; background: #0a0a0a; color: #4ade80; font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; line-height: 1.5; }
    #status { color: #facc15; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #333; }
    #log { white-space: pre-wrap; word-break: break-all; }
    .line-error { color: #f87171; }
    .line-event { color: #22d3ee; }
  </style>`;
  w.document.body.innerHTML = `<div id="status"></div><div id="log"></div>`;

  // Render current state + start polling
  const render = () => {
    if (!w || w.closed) {
      debugWindow = null;
      return;
    }
    const statusEl = w.document.getElementById("status");
    const logEl = w.document.getElementById("log");
    if (statusEl) {
      statusEl.textContent = `URL: ${gateway.url || "(none)"} | WS: ${gateway.wsState} | Connected: ${String(gateway.connected)}`;
    }
    if (logEl) {
      const html = gateway.debugLog.length === 0
        ? '<span style="color:#6b7280">No messages yet...</span>'
        : gateway.debugLog.map((line) => {
            const cls = (line.includes("ERROR") || line.includes("error") || line.includes("FAILED"))
              ? "line-error"
              : (line.includes("EVENT chat") || line.includes("EVENT agent"))
                ? "line-event"
                : "";
            const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return cls ? `<div class="${cls}">${escaped}</div>` : `<div>${escaped}</div>`;
          }).join("");
      logEl.innerHTML = html;
      // Auto-scroll to bottom
      w.scrollTo(0, w.document.body.scrollHeight);
    }
  };

  render();
  gateway.setDebugCallback(render);

  // Restore default callback when window closes
  w.addEventListener("beforeunload", () => {
    debugWindow = null;
    gateway.setDebugCallback(() => {});
  });
}

export function GatewayStatus() {
  const { t } = useTranslation();
  const connected = useAppStore((s) => s.gatewayConnected);
  const prevConnectedRef = useRef(connected);

  // Update debug window status line when connection state changes
  const updateDebugStatus = useCallback(() => {
    if (debugWindow && !debugWindow.closed) {
      const statusEl = debugWindow.document.getElementById("status");
      if (statusEl) {
        statusEl.textContent = `URL: ${gateway.url || "(none)"} | WS: ${gateway.wsState} | Connected: ${String(gateway.connected)}`;
      }
    }
  }, []);

  useEffect(() => {
    if (prevConnectedRef.current !== connected) {
      prevConnectedRef.current = connected;
      updateDebugStatus();
    }
  }, [connected, updateDebugStatus]);

  return (
    <div className="px-3 py-1">
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${
            connected ? "bg-[var(--color-success)]" : "bg-[var(--color-error)]"
          }`}
        />
        <span className="text-xs text-[var(--color-text-muted)]">
          {connected ? t("common.connected") : t("common.disconnected")}
        </span>
        <span className="text-xs text-[var(--color-text-muted)] opacity-50 ml-1">
          WS: {gateway.wsState}
        </span>
        <button
          onClick={openDebugWindow}
          className="text-xs text-[var(--color-accent)] ml-auto hover:underline"
        >
          {t("common.debug")}
        </button>
      </div>
    </div>
  );
}
