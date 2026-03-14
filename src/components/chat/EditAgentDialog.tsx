import { useState } from "react";
import { FolderOpen, RotateCcw } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { Agent } from "../../stores/chat-store";
import { useChatStore } from "../../stores/chat-store";
import { gateway } from "../../api/gateway-client";
import { patchConfig, waitForReconnect } from "../../api/config-helpers";

interface EditAgentDialogProps {
  agent: Agent;
  onClose: () => void;
}

export function EditAgentDialog({ agent, onClose }: EditAgentDialogProps) {
  const updateAgent = useChatStore((s) => s.updateAgent);
  const deleteAgent = useChatStore((s) => s.deleteAgent);
  const loadAgents = useChatStore((s) => s.loadAgents);

  const [name, setName] = useState(agent.name || "");
  const [emoji, setEmoji] = useState(agent.emoji || "");
  const [workspace, setWorkspace] = useState(agent.workspace || "");
  const [resetWorkspace, setResetWorkspace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const inputClass =
    "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]";

  async function handleBrowse() {
    const selected = await open({ directory: true, title: "Select Agent Workspace" });
    if (!selected) return;
    setWorkspace(selected);
    setResetWorkspace(false);
  }

  function handleReset() {
    setWorkspace("");
    setResetWorkspace(true);
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // If resetting workspace, use patchConfig to null out the per-agent workspace
      if (resetWorkspace) {
        // First update name/emoji via agents.update
        await updateAgent({
          agentId: agent.agentId,
          name: name.trim(),
          emoji: emoji.trim() || undefined,
        });
        // Then null out workspace via config patch (merge-patch delete semantics)
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
          entry.id === agent.agentId ? { ...entry, workspace: null } : entry
        );
        await patchConfig({ agents: { list: updatedList } });
        await waitForReconnect();
        await loadAgents();
      } else {
        // Normal save -- include workspace only if set
        await updateAgent({
          agentId: agent.agentId,
          name: name.trim(),
          emoji: emoji.trim() || undefined,
          workspace: workspace.trim() || undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await deleteAgent(agent.agentId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[400px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Edit Agent</h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">* Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agent name"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">Emoji</label>
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="e.g. 🤖"
              className={inputClass}
              maxLength={4}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm text-[var(--color-text-muted)]">Workspace</label>
              {(workspace || agent.workspace) && !resetWorkspace && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  <RotateCcw size={10} />
                  Reset
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2">
                {workspace && !resetWorkspace ? (
                  <span className="block font-mono text-sm text-[var(--color-text)] truncate">
                    {workspace}
                  </span>
                ) : (
                  <span className="block text-sm text-[var(--color-text-muted)]/50 truncate">
                    Using default workspace
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleBrowse()}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors shrink-0"
              >
                <FolderOpen size={14} />
                Browse
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={handleDelete}
            disabled={saving}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              confirmDelete
                ? "bg-[var(--color-error)] text-white hover:opacity-90"
                : "text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
            } disabled:opacity-50`}
          >
            {confirmDelete ? "Confirm Delete" : "Delete"}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
