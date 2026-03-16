import { MessageSquare, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "@/stores/chat-store";

export function SidebarTabs() {
  const { t } = useTranslation();
  const tab = useChatStore((s) => s.sidebarTab);
  const setTab = useChatStore((s) => s.setSidebarTab);

  return (
    <div className="flex border-b border-border">
      <button
        onClick={() => setTab("agents")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
          tab === "agents"
            ? "text-primary border-b-2 border-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Users size={14} />
        {t("sidebar.agents")}
      </button>
      <button
        onClick={() => setTab("chats")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
          tab === "chats"
            ? "text-primary border-b-2 border-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <MessageSquare size={14} />
        {t("sidebar.chats")}
      </button>
    </div>
  );
}
