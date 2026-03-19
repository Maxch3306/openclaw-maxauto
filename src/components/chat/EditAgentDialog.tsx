import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, FolderOpen, RotateCcw } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { Agent } from "@/stores/chat-store";
import { useChatStore } from "@/stores/chat-store";
import { useSettingsStore } from "@/stores/settings-store";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface EditAgentDialogProps {
  agent: Agent;
  onClose: () => void;
}

interface AgentListEntry {
  id: string;
  workspace?: string | null;
  subagents?: {
    allowAgents?: string[];
    model?: string;
    thinking?: string;
  };
  [key: string]: unknown;
}

interface AgentsConfig {
  list?: AgentListEntry[];
  defaults?: {
    workspace?: string;
    subagents?: {
      maxSpawnDepth?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

export function EditAgentDialog({ agent, onClose }: EditAgentDialogProps) {
  const { t } = useTranslation();
  const updateAgent = useChatStore((s) => s.updateAgent);
  const deleteAgent = useChatStore((s) => s.deleteAgent);
  const loadAgents = useChatStore((s) => s.loadAgents);
  const agents = useChatStore((s) => s.agents);
  const models = useSettingsStore((s) => s.models);

  const [name, setName] = useState(agent.name || "");
  const [emoji, setEmoji] = useState(agent.emoji || "");
  const [workspace, setWorkspace] = useState(agent.workspace || "");
  const [resetWorkspace, setResetWorkspace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Subagent state
  const [subagentsOpen, setSubagentsOpen] = useState(false);
  const [allowAll, setAllowAll] = useState(false);
  const [allowedAgentIds, setAllowedAgentIds] = useState<string[]>([]);
  const [subagentModel, setSubagentModel] = useState("");
  const [maxSpawnDepth, setMaxSpawnDepth] = useState(1);
  const [defaultWorkspace, setDefaultWorkspace] = useState("");

  // Load current subagent config + default workspace on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const { config } = await gateway.request<{
          config: { agents?: AgentsConfig };
          hash: string;
        }>("config.get", {});
        const entry = config?.agents?.list?.find((e) => e.id === agent.agentId);
        if (entry?.subagents) {
          const sa = entry.subagents;
          if (sa.allowAgents) {
            if (sa.allowAgents.length === 1 && sa.allowAgents[0] === "*") {
              setAllowAll(true);
            } else {
              setAllowedAgentIds(sa.allowAgents);
            }
          }
          if (sa.model) setSubagentModel(sa.model);
        }
        // maxSpawnDepth lives in agents.defaults.subagents
        const defaultDepth = config?.agents?.defaults?.subagents?.maxSpawnDepth;
        if (defaultDepth) setMaxSpawnDepth(defaultDepth);
        // Resolve default workspace path
        const dw = config?.agents?.defaults?.workspace;
        if (dw) setDefaultWorkspace(dw);
      } catch {
        // proceed with defaults on error
      }
    }
    void loadConfig();
  }, [agent.agentId]);

  const otherAgents = agents.filter((a) => a.agentId !== agent.agentId);

  function toggleAgentId(id: string) {
    setAllowedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

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
      // Update name/emoji/workspace via gateway
      await updateAgent({
        agentId: agent.agentId,
        name: name.trim(),
        emoji: emoji.trim() || undefined,
        workspace: resetWorkspace ? undefined : workspace.trim() || undefined,
      });

      // Build config patch for workspace reset + subagent settings
      const { config } = await gateway.request<{
        config: { agents?: AgentsConfig };
        hash: string;
      }>("config.get", {});
      const currentList = config?.agents?.list ?? [];

      // Build per-agent subagents config (allowAgents + model only)
      const subagentsPatch: Record<string, unknown> = {};
      if (allowAll) {
        subagentsPatch.allowAgents = ["*"];
      } else if (allowedAgentIds.length > 0) {
        subagentsPatch.allowAgents = allowedAgentIds;
      }
      if (subagentModel) {
        subagentsPatch.model = subagentModel;
      } else {
        subagentsPatch.model = null; // remove to inherit
      }

      const hasSubagentChanges = Object.values(subagentsPatch).some((v) => v !== null);
      const needsConfigPatch = resetWorkspace || hasSubagentChanges || allowAll || allowedAgentIds.length > 0;

      // maxSpawnDepth goes into agents.defaults.subagents (global setting)
      const currentDefaultDepth = config?.agents?.defaults?.subagents?.maxSpawnDepth ?? 1;
      const depthChanged = maxSpawnDepth !== currentDefaultDepth;

      if (needsConfigPatch || depthChanged) {
        const agentsPatch: Record<string, unknown> = {};

        // Per-agent list patch
        if (needsConfigPatch) {
          const existingEntry = currentList.find((e) => e.id === agent.agentId);
          const patchEntry: AgentListEntry = {
            ...(existingEntry ?? { id: agent.agentId }),
            subagents: subagentsPatch,
          };
          if (resetWorkspace) {
            patchEntry.workspace = null;
          }

          const updatedList = currentList.some((e) => e.id === agent.agentId)
            ? currentList.map((e) => (e.id === agent.agentId ? patchEntry : e))
            : [...currentList, patchEntry];

          agentsPatch.list = updatedList;
        }

        // Global defaults patch for maxSpawnDepth
        if (depthChanged) {
          agentsPatch.defaults = {
            ...(config?.agents?.defaults ?? {}),
            subagents: {
              ...(config?.agents?.defaults?.subagents ?? {}),
              maxSpawnDepth: maxSpawnDepth > 1 ? maxSpawnDepth : null,
            },
          };
        }

        await patchConfig({ agents: agentsPatch });
        await waitForReconnect();
        await loadAgents();
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
      <DialogContent className="w-[460px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("agent.edit.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 px-1 -mx-1">
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
                ) : defaultWorkspace && !resetWorkspace ? (
                  <span className="block font-mono text-sm text-muted-foreground truncate">
                    {defaultWorkspace}
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

          {/* Sub-agents section */}
          <Collapsible open={subagentsOpen} onOpenChange={setSubagentsOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
              {subagentsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {t("agent.edit.subagents")}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 pt-3">
                {/* Allow agents */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">
                      {t("agent.edit.allowAgents")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t("agent.edit.allowAgentsAll")}
                      </span>
                      <Switch
                        checked={allowAll}
                        onCheckedChange={setAllowAll}
                      />
                    </div>
                  </div>
                  {!allowAll && otherAgents.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {otherAgents.map((a) => (
                        <Badge
                          key={a.agentId}
                          variant={allowedAgentIds.includes(a.agentId) ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => toggleAgentId(a.agentId)}
                        >
                          {a.emoji ? `${a.emoji} ` : ""}{a.name || a.agentId}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {!allowAll && otherAgents.length === 0 && (
                    <p className="text-xs text-muted-foreground/50">
                      {t("agent.edit.allowAgentsSelf")}
                    </p>
                  )}
                  {!allowAll && otherAgents.length > 0 && allowedAgentIds.length === 0 && (
                    <p className="text-xs text-muted-foreground/50 mt-1">
                      {t("agent.edit.allowAgentsSelf")}
                    </p>
                  )}
                </div>

                {/* Sub-agent model */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    {t("agent.edit.subagentModel")}
                  </Label>
                  <select
                    value={subagentModel}
                    onChange={(e) => setSubagentModel(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">{t("agent.edit.inheritModel")}</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Max spawn depth */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    {t("agent.edit.maxSpawnDepth")}
                  </Label>
                  <select
                    value={maxSpawnDepth}
                    onChange={(e) => setMaxSpawnDepth(Number(e.target.value))}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    {t("agent.edit.maxSpawnDepthHint")}
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

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
