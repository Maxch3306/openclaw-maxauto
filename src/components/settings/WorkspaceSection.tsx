import { FolderOpen, ExternalLink, AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import { gateway } from "../../api/gateway-client";
import { patchConfig, waitForReconnect } from "../../api/config-helpers";
import { openUrl } from "../../api/tauri-commands";

const DEFAULT_WORKSPACE = "~/.openclaw-maxauto/workspace";

interface AgentWorkspaceInfo {
  agentId: string;
  name: string;
  emoji?: string;
  workspace?: string;
  status: "default" | "custom" | "auto-assigned";
  effectivePath: string;
}

export function WorkspaceSection() {
  const [workspacePath, setWorkspacePath] = useState(DEFAULT_WORKSPACE);
  const [saving, setSaving] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agentWorkspaces, setAgentWorkspaces] = useState<AgentWorkspaceInfo[]>([]);
  const [savingAgentId, setSavingAgentId] = useState<string | null>(null);

  const isMac = navigator.platform.includes("Mac");

  useEffect(() => {
    loadWorkspacePath();
    loadAgentWorkspaces();
  }, []);

  async function loadWorkspacePath() {
    try {
      const { config } = await gateway.request<{
        config: { agents?: { defaults?: { workspace?: string } } };
        hash: string;
      }>("config.get", {});
      const path = config?.agents?.defaults?.workspace;
      if (path) setWorkspacePath(path);
      return path || DEFAULT_WORKSPACE;
    } catch (err) {
      console.error("[workspace] failed to load config:", err);
      return DEFAULT_WORKSPACE;
    }
  }

  async function loadAgentWorkspaces() {
    try {
      // Load config for workspace assignments
      const { config } = await gateway.request<{
        config: {
          agents?: {
            defaults?: { workspace?: string };
            list?: Array<{ id: string; workspace?: string; [key: string]: unknown }>;
          };
        };
        hash: string;
      }>("config.get", {});

      // Load agent display info
      const { agents } = await gateway.request<{
        agents: Array<{ agentId: string; name: string; emoji?: string; workspace?: string }>;
      }>("agents.list", {});

      const defaultWs = config?.agents?.defaults?.workspace || DEFAULT_WORKSPACE;
      const configList = config?.agents?.list ?? [];

      // Build workspace info for each agent
      const infos: AgentWorkspaceInfo[] = agents.map((agent, index) => {
        const configEntry = configList.find((c) => c.id === agent.agentId);
        const explicitWorkspace = configEntry?.workspace || agent.workspace;

        if (explicitWorkspace) {
          return {
            agentId: agent.agentId,
            name: agent.name,
            emoji: agent.emoji,
            workspace: explicitWorkspace,
            status: "custom" as const,
            effectivePath: explicitWorkspace,
          };
        }

        // First agent (default/main) uses the default workspace
        if (index === 0) {
          return {
            agentId: agent.agentId,
            name: agent.name,
            emoji: agent.emoji,
            workspace: undefined,
            status: "default" as const,
            effectivePath: defaultWs,
          };
        }

        // Non-default agents without explicit workspace get auto-assigned path
        return {
          agentId: agent.agentId,
          name: agent.name,
          emoji: agent.emoji,
          workspace: undefined,
          status: "auto-assigned" as const,
          effectivePath: `~/.openclaw-maxauto/workspace-${agent.agentId}`,
        };
      });

      setAgentWorkspaces(infos);
    } catch (err) {
      console.error("[workspace] failed to load agent workspaces:", err);
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
      await loadAgentWorkspaces();
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

  async function handleAgentChangeWorkspace(agentId: string) {
    const selected = await open({ directory: true, title: "Select Agent Workspace" });
    if (!selected) return;

    setSavingAgentId(agentId);
    try {
      await gateway.request("agents.update", { agentId, workspace: selected });
      await loadAgentWorkspaces();
    } catch (err) {
      console.error("[workspace] failed to update agent workspace:", err);
    } finally {
      setSavingAgentId(null);
    }
  }

  async function handleAgentResetWorkspace(agentId: string) {
    setSavingAgentId(agentId);
    try {
      // Use patchConfig to null out the workspace for this agent (merge-patch delete semantics)
      const { config } = await gateway.request<{
        config: {
          agents?: {
            list?: Array<{ id: string; workspace?: string; [key: string]: unknown }>;
          };
        };
        hash: string;
      }>("config.get", {});

      const currentList = config?.agents?.list ?? [];
      const updatedList = currentList.map((entry) =>
        entry.id === agentId ? { ...entry, workspace: null } : entry
      );

      await patchConfig({ agents: { list: updatedList } });
      await waitForReconnect();
      await loadAgentWorkspaces();
    } catch (err) {
      console.error("[workspace] failed to reset agent workspace:", err);
    } finally {
      setSavingAgentId(null);
    }
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

      <section>
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">
          Per-Agent Workspaces
        </h2>
        {agentWorkspaces.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No agents found.</p>
        ) : (
          <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {agentWorkspaces.map((info) => {
              const isSaving = savingAgentId === info.agentId;
              return (
                <div
                  key={info.agentId}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  {/* Agent identity */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-base">{info.emoji || "🤖"}</span>
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {info.name}
                    </span>
                  </div>

                  {/* Workspace status */}
                  <div className="flex-1 min-w-0 text-right">
                    {info.status === "custom" ? (
                      <span className="font-mono text-xs text-[var(--color-text)] truncate block">
                        {info.effectivePath}
                      </span>
                    ) : info.status === "default" ? (
                      <span className="text-xs text-[var(--color-text-muted)] italic">
                        Default
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)] italic">
                        Auto-assigned
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => void handleAgentChangeWorkspace(info.agentId)}
                      disabled={isSaving}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
                    >
                      <FolderOpen size={12} />
                      {isSaving ? "..." : "Change"}
                    </button>
                    {info.status === "custom" && (
                      <button
                        onClick={() => void handleAgentResetWorkspace(info.agentId)}
                        disabled={isSaving}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
                      >
                        <RotateCcw size={12} />
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
