import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../stores/chat-store";
import { AgentCard } from "./AgentCard";
import { CreateAgentDialog } from "./CreateAgentDialog";
import { EditAgentDialog } from "./EditAgentDialog";
import type { Agent } from "../../stores/chat-store";

export function AgentList() {
  const { t } = useTranslation();
  const agents = useChatStore((s) => s.agents);
  const selectedAgentId = useChatStore((s) => s.selectedAgentId);
  const selectAgent = useChatStore((s) => s.selectAgent);

  const [showCreate, setShowCreate] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);

  const deleteAgent = useChatStore((s) => s.deleteAgent);

  const handleDelete = async (agent: Agent) => {
    if (deletingAgent?.agentId === agent.agentId) {
      // Already confirming — execute
      try {
        await deleteAgent(agent.agentId);
      } catch {
        // error handled in store
      }
      setDeletingAgent(null);
    } else {
      setDeletingAgent(agent);
    }
  };

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <Plus size={16} />
            {t("sidebar.newAgent")}
          </button>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {agents.map((agent) => (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              selected={selectedAgentId === agent.agentId}
              onSelect={() => selectAgent(agent.agentId)}
              onEdit={() => setEditingAgent(agent)}
              onDelete={() => handleDelete(agent)}
            />
          ))}
          {agents.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)] px-3 py-4 text-center">
              {t("sidebar.noAgents")}
            </p>
          )}
        </div>
      </div>

      {showCreate && <CreateAgentDialog onClose={() => setShowCreate(false)} />}
      {editingAgent && (
        <EditAgentDialog agent={editingAgent} onClose={() => setEditingAgent(null)} />
      )}
    </>
  );
}
