import { MessageSquare, Users } from "lucide-react";
import { useChatStore } from "../../stores/chat-store";

export function SidebarTabs() {
  const tab = useChatStore((s) => s.sidebarTab);
  const setTab = useChatStore((s) => s.setSidebarTab);

  return (
    <div className="flex border-b border-[var(--color-border)]">
      <button
        onClick={() => setTab("agents")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
          tab === "agents"
            ? "text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        }`}
      >
        <Users size={14} />
        Agents
      </button>
      <button
        onClick={() => setTab("chats")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
          tab === "chats"
            ? "text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        }`}
      >
        <MessageSquare size={14} />
        Chats
      </button>
    </div>
  );
}
