import { FolderOpen, ExternalLink, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import { gateway } from "../../api/gateway-client";
import { patchConfig, waitForReconnect } from "../../api/config-helpers";
import { openUrl } from "../../api/tauri-commands";

const DEFAULT_WORKSPACE = "~/.openclaw-maxauto/workspace";

export function WorkspaceSection() {
  const [workspacePath, setWorkspacePath] = useState(DEFAULT_WORKSPACE);
  const [saving, setSaving] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const isMac = navigator.platform.includes("Mac");

  useEffect(() => {
    loadWorkspacePath();
  }, []);

  async function loadWorkspacePath() {
    try {
      const { config } = await gateway.request<{
        config: { agents?: { defaults?: { workspace?: string } } };
        hash: string;
      }>("config.get", {});
      const path = config?.agents?.defaults?.workspace;
      if (path) setWorkspacePath(path);
    } catch (err) {
      console.error("[workspace] failed to load config:", err);
    }
  }

  async function applyWorkspacePath(path: string) {
    setSaving(true);
    setShowConfirm(false);
    setPendingPath(null);
    try {
      await patchConfig({ agents: { defaults: { workspace: path } } });
      await waitForReconnect();
      await loadWorkspacePath();
    } catch (err) {
      console.error("[workspace] failed to save workspace path:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleChange() {
    const selected = await open({ directory: true, title: "Select Workspace Directory" });
    if (!selected) return;

    try {
      const dirExists = await exists(selected);
      if (dirExists) {
        await applyWorkspacePath(selected);
      } else {
        setPendingPath(selected);
        setShowConfirm(true);
      }
    } catch {
      // If exists check fails, treat as non-existent and ask for confirmation
      setPendingPath(selected);
      setShowConfirm(true);
    }
  }

  function handleCancelConfirm() {
    setPendingPath(null);
    setShowConfirm(false);
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-lg font-semibold text-[var(--color-text)] mb-6">Workspace</h1>

      <section className="mb-6">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">
          Default Workspace
        </h2>
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            The workspace is the directory where agents read and write files. All agents use this
            default workspace unless overridden.
          </p>

          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-sm text-[var(--color-text)] truncate min-w-0">
              {workspacePath}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => void handleChange()}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
              >
                <FolderOpen size={14} />
                {saving ? "Saving..." : "Change"}
              </button>
              <button
                onClick={() => void openUrl(workspacePath)}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
              >
                <ExternalLink size={14} />
                {isMac ? "Open in Finder" : "Open in Explorer"}
              </button>
            </div>
          </div>

          {showConfirm && pendingPath && (
            <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-amber-200">
                    The selected directory does not exist. It will be created when an agent first
                    uses it.
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] font-mono truncate">
                    {pendingPath}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={handleCancelConfirm}
                  className="text-xs px-3 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void applyWorkspacePath(pendingPath)}
                  className="text-xs px-3 py-1 rounded-lg border border-amber-500/40 text-amber-200 hover:bg-amber-500/20 transition-colors"
                >
                  Apply Anyway
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
