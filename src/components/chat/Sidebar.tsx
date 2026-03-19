import { ArrowLeft, Plus, Settings, Trash2, MessageSquare, Users2, Bot } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { gateway } from "@/api/gateway-client";
import { useAppStore } from "@/stores/app-store";
import { useChatStore } from "@/stores/chat-store";
import type { SessionItem } from "@/stores/chat-store";
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

/** Known channel display labels */
const CHANNEL_LABELS: Record<string, string> = {
  telegram: "Telegram",
  discord: "Discord",
  slack: "Slack",
  whatsapp: "WhatsApp",
  signal: "Signal",
  line: "LINE",
  irc: "IRC",
  twitch: "Twitch",
  feishu: "Feishu",
  webchat: "Webchat",
  imessage: "iMessage",
  googlechat: "Google Chat",
};

/**
 * Derive channel from session data or key.
 * Session key format: agent:{agentId}:{channel}:{scope}:...
 * e.g. agent:main:telegram:direct:12345
 */
function resolveChannel(session: SessionItem): string | null {
  if (session.channel) return session.channel;
  // Try to extract from key: agent:{id}:{channel}:...
  const parts = session.key.split(":");
  if (parts.length >= 3) {
    const scope = parts[2];
    // "main" and timestamp-based scopes are not channels
    if (scope !== "main" && !/^\d/.test(scope) && scope !== "subagent" && scope !== "dashboard" && scope !== "cron") {
      if (CHANNEL_LABELS[scope] || scope.length > 2) {
        return scope;
      }
    }
  }
  return null;
}

function ChannelBadge({ session }: { session: SessionItem }) {
  const channel = resolveChannel(session);
  if (!channel) return null;

  const label = CHANNEL_LABELS[channel] || channel;
  const isGroup = session.chatType === "group";

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      {isGroup ? <Users2 size={10} /> : <MessageSquare size={10} />}
      {label}
    </span>
  );
}

function SessionIcon({ session }: { session: SessionItem }) {
  const channel = resolveChannel(session);
  // Subagent session
  if (session.key.includes(":subagent:")) {
    return <Bot size={14} className="shrink-0 text-muted-foreground" />;
  }
  // Channel session
  if (channel) {
    const isGroup = session.chatType === "group";
    return isGroup
      ? <Users2 size={14} className="shrink-0 text-muted-foreground" />
      : <MessageSquare size={14} className="shrink-0 text-muted-foreground" />;
  }
  return null;
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
              <div className="flex items-center gap-1.5">
                <SessionIcon session={s} />
                <span className="text-sm text-foreground truncate">{s.title}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <ChannelBadge session={s} />
                {s.updatedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(s.updatedAt, t)}
                  </span>
                )}
              </div>
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
