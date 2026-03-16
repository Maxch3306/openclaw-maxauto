import { ArrowLeft, Plus, Settings, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { gateway } from "@/api/gateway-client";
import { useAppStore } from "@/stores/app-store";
import { useChatStore } from "@/stores/chat-store";
import { Button } from "@/components/ui/button";
import { AgentList } from "./AgentList";
import { SidebarTabs } from "./SidebarTabs";

function formatTime(ts: number | null, t: (key: string) => string): string {
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
    return t("sidebar.yesterday");
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ChatsView() {
  const { t } = useTranslation();
  const sessions = useChatStore((s) => s.sessions);
  const sessionKey = useChatStore((s) => s.sessionKey);
  const switchSession = useChatStore((s) => s.switchSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const newSession = useChatStore((s) => s.newSession);
  const agents = useChatStore((s) => s.agents);
  const selectedAgentId = useChatStore((s) => s.selectedAgentId);
  const setSidebarTab = useChatStore((s) => s.setSidebarTab);

  const selectedAgent = agents.find((a) => a.agentId === selectedAgentId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header showing selected agent */}
      <div className="p-3 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarTab("agents")}
          title={t("sidebar.backToAgents")}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-foreground truncate">
            {selectedAgent?.emoji ? `${selectedAgent.emoji} ` : ""}
            {selectedAgent?.name || t("sidebar.chats")}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={newSession}
          title={t("sidebar.newChat")}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <Plus size={16} />
        </Button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2">
        {sessions.map((s) => (
          <div
            key={s.key}
            className={`relative flex items-center rounded-lg mb-0.5 transition-colors group ${
              sessionKey === s.key
                ? "bg-primary/10 border border-primary/30"
                : "hover:bg-secondary"
            }`}
          >
            <button
              onClick={() => switchSession(s.key)}
              className="flex-1 text-left px-3 py-2 min-w-0"
            >
              <div className="text-sm text-foreground truncate">{s.title}</div>
              {s.updatedAt && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {formatTime(s.updatedAt, t)}
                </div>
              )}
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                void deleteSession(s.key);
              }}
              title={t("sidebar.deleteChat")}
              className="hidden group-hover:flex h-7 w-7 mr-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-2">{t("sidebar.noConversations")}</p>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const sidebarTab = useChatStore((s) => s.sidebarTab);
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
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      <SidebarTabs />
      {sidebarTab === "agents" ? <AgentList /> : <ChatsView />}
      {/* Settings button */}
      <div className="px-3 py-2 border-t border-border">
        <Button
          variant="ghost"
          onClick={() => setCurrentPage("settings")}
          className="w-full justify-start gap-2 text-sm text-muted-foreground"
        >
          <Settings size={16} />
          <span>{t("sidebar.settings")}</span>
        </Button>
      </div>
    </aside>
  );
}
