import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, RotateCcw } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { Agent } from "@/stores/chat-store";
import { useChatStore } from "@/stores/chat-store";
import { gateway } from "@/api/gateway-client";
import { patchConfig, waitForReconnect } from "@/api/config-helpers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditAgentDialogProps {
  agent: Agent;
  onClose: () => void;
}

export function EditAgentDialog({ agent, onClose }: EditAgentDialogProps) {
  const { t } = useTranslation();
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
      setError(t("agent.edit.nameRequired"));
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
    <Dialog open={true} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[400px]">
        <DialogHeader>
          <DialogTitle>{t("agent.edit.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1 text-muted-foreground">{t("agent.create.name")}</Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("agent.edit.namePlaceholder")}
              autoFocus
            />
          </div>

          <div>
            <Label className="mb-1 text-muted-foreground">{t("agent.create.emoji")}</Label>
            <Input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder={t("agent.create.emojiPlaceholder")}
              maxLength={4}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-muted-foreground">{t("agent.edit.workspace")}</Label>
              {(workspace || agent.workspace) && !resetWorkspace && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw size={10} />
                  {t("common.reset")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 bg-card border border-border rounded-md px-3 py-2">
                {workspace && !resetWorkspace ? (
                  <span className="block font-mono text-sm text-foreground truncate">
                    {workspace}
                  </span>
                ) : (
                  <span className="block text-sm text-muted-foreground/50 truncate">
                    {t("agent.edit.usingDefault")}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleBrowse()}
                className="shrink-0"
              >
                <FolderOpen size={14} />
                {t("common.browse")}
              </Button>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button
            variant={confirmDelete ? "destructive" : "ghost"}
            onClick={handleDelete}
            disabled={saving}
            className={!confirmDelete ? "text-destructive hover:text-destructive hover:bg-destructive/10" : ""}
          >
            {confirmDelete ? t("agent.edit.confirmDelete") : t("common.delete")}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
