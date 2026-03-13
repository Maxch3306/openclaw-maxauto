import { Download, RotateCw, Stethoscope } from "lucide-react";
import { useState } from "react";
import { gateway } from "../../api/gateway-client";
import { stopGateway, startGateway, runDoctor } from "../../api/tauri-commands";
import { useAppStore } from "../../stores/app-store";
import { useChatStore } from "../../stores/chat-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useUpdateStore } from "../../stores/update-store";

export function GeneralSection() {
  const gatewayConnected = useAppStore((s) => s.gatewayConnected);
  const gatewayPort = useAppStore((s) => s.gatewayPort);
  const loadConfig = useSettingsStore((s) => s.loadConfig);
  const loadModels = useSettingsStore((s) => s.loadModels);
  const loadAgents = useChatStore((s) => s.loadAgents);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const [restarting, setRestarting] = useState(false);
  const [runningDoctor, setRunningDoctor] = useState(false);
  const [doctorOutput, setDoctorOutput] = useState<string | null>(null);

  const handleRestartGateway = async () => {
    setRestarting(true);
    try {
      gateway.disconnect();
      await stopGateway();
      await new Promise((r) => setTimeout(r, 1500));
      await startGateway();
      await new Promise((r) => setTimeout(r, 3000));
      gateway.reconnect();
      // Wait for WS to connect, then reload all data
      await new Promise((r) => setTimeout(r, 2000));
      await loadConfig();
      await loadModels();
      await loadAgents();
      await loadSessions();
    } catch (err) {
      console.error("[general] restart gateway failed:", err);
    } finally {
      setRestarting(false);
    }
  };

  const handleDoctor = async () => {
    setRunningDoctor(true);
    setDoctorOutput(null);
    try {
      const output = await runDoctor();
      setDoctorOutput(output);
    } catch (err) {
      setDoctorOutput(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunningDoctor(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-lg font-semibold text-[var(--color-text)] mb-6">General</h1>

      <section className="mb-6">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Gateway</h2>
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  gatewayConnected
                    ? "bg-[var(--color-success)]/20 text-[var(--color-success)]"
                    : "bg-[var(--color-error)]/20 text-[var(--color-error)]"
                }`}
              >
                {gatewayConnected ? "Connected" : "Disconnected"}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-mono">
                ws://127.0.0.1:{gatewayPort}
              </span>
            </div>
            <button
              onClick={handleRestartGateway}
              disabled={restarting}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
            >
              <RotateCw size={14} className={restarting ? "animate-spin" : ""} />
              {restarting ? "Restarting..." : "Restart Gateway"}
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Health Check</h2>
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--color-text-muted)]">
              Run{" "}
              <code className="px-1 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-text)]">
                openclaw doctor
              </code>{" "}
              to diagnose configuration issues.
            </p>
            <button
              onClick={handleDoctor}
              disabled={runningDoctor}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50 shrink-0"
            >
              <Stethoscope size={14} className={runningDoctor ? "animate-pulse" : ""} />
              {runningDoctor ? "Running..." : "Run Doctor"}
            </button>
          </div>
          {doctorOutput !== null && (
            <pre className="p-3 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-xs text-[var(--color-text)] overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
              {doctorOutput}
            </pre>
          )}
        </div>
      </section>

      <UpdateSection />
    </div>
  );
}

function UpdateSection() {
  const status = useUpdateStore((s) => s.status);
  const availableVersion = useUpdateStore((s) => s.availableVersion);
  const checkForUpdate = useUpdateStore((s) => s.checkForUpdate);
  const downloadAndInstall = useUpdateStore((s) => s.downloadAndInstall);
  const checking = status === "checking";

  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Updates</h2>
      <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            {status === "available" ? (
              <p className="text-sm text-[var(--color-text)]">
                Update <strong>v{availableVersion}</strong> available
              </p>
            ) : status === "up-to-date" ? (
              <p className="text-xs text-[var(--color-text-muted)]">You're on the latest version.</p>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">Check if a newer version is available.</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status === "available" && (
              <button
                onClick={() => void downloadAndInstall()}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
              >
                <Download size={14} />
                Install Update
              </button>
            )}
            <button
              onClick={() => void checkForUpdate()}
              disabled={checking}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
            >
              <RotateCw size={14} className={checking ? "animate-spin" : ""} />
              {checking ? "Checking..." : "Check for Updates"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
