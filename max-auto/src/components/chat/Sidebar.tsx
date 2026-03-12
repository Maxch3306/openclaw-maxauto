import { Plus, Settings, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { gateway } from "../../api/gateway-client";
import { useAppStore } from "../../stores/app-store";
import { useChatStore } from "../../stores/chat-store";

export function ModelSelector() {
  const agents = useChatStore((s) => s.agents);
  const selectedAgentId = useChatStore((s) => s.selectedAgentId);
  const selectAgent = useChatStore((s) => s.selectAgent);

  return (
    <div className="px-3 py-2 border-t border-[var(--color-border)]">
      <select
        value={selectedAgentId ?? ""}
        onChange={(e) => selectAgent(e.target.value)}
        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
      >
        {agents.map((a) => (
          <option key={a.agentId} value={a.agentId}>
            {a.emoji ? `${a.emoji} ` : ""}
            {a.name}
          </option>
        ))}
        {agents.length === 0 && <option value="">No agents</option>}
      </select>
    </div>
  );
}

function formatTime(ts: number | null): string {
  if (!ts) {
    return "";
  }
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function Sidebar() {
  const sessions = useChatStore((s) => s.sessions);
  const sessionKey = useChatStore((s) => s.sessionKey);
  const switchSession = useChatStore((s) => s.switchSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const newSession = useChatStore((s) => s.newSession);
  const loadAgents = useChatStore((s) => s.loadAgents);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  useEffect(() => {
    if (gateway.connected) {
      void loadAgents();
    }
    const unsub = gateway.on("presence", () => {
      void loadAgents();
    });
    return unsub;
  }, []);

  return (
    <aside className="w-64 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col">
      <div className="p-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          Chats
        </h2>
        <button
          onClick={newSession}
          title="New Chat"
          className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {sessions.map((s) => (
          <div
            key={s.key}
            className={`relative flex items-center rounded-lg mb-0.5 transition-colors group ${
              sessionKey === s.key
                ? "bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30"
                : "hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            <button
              onClick={() => switchSession(s.key)}
              className="flex-1 text-left px-3 py-2 min-w-0"
            >
              <div className="text-sm text-[var(--color-text)] truncate">{s.title}</div>
              {s.updatedAt && (
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {formatTime(s.updatedAt)}
                </div>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void deleteSession(s.key);
              }}
              title="Delete chat"
              className="hidden group-hover:flex items-center justify-center p-1.5 mr-1 rounded-md text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)] px-3 py-2">No conversations yet</p>
        )}
      </div>
      <ModelSelector />
      {/* Settings button */}
      <div className="px-3 py-2 border-t border-[var(--color-border)]">
        <button
          onClick={() => setCurrentPage("settings")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
