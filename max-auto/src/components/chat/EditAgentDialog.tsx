import { useState } from "react";
import type { Agent } from "../../stores/chat-store";
import { useChatStore } from "../../stores/chat-store";

interface EditAgentDialogProps {
  agent: Agent;
  onClose: () => void;
}

export function EditAgentDialog({ agent, onClose }: EditAgentDialogProps) {
  const updateAgent = useChatStore((s) => s.updateAgent);
  const deleteAgent = useChatStore((s) => s.deleteAgent);

  const [name, setName] = useState(agent.name || "");
  const [emoji, setEmoji] = useState(agent.emoji || "");
  const [workspace, setWorkspace] = useState(agent.workspace || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const inputClass =
    "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]";

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateAgent({
        agentId: agent.agentId,
        name: name.trim(),
        emoji: emoji.trim() || undefined,
        workspace: workspace.trim() || undefined,
      });
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
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">Workspace</label>
            <input
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              placeholder="Optional workspace name"
              className={inputClass}
            />
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
