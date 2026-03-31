import {
  Settings,
  Palette,
  Puzzle,
  Plug,
  BookOpen,
  MessageCircle,
  FolderOpen,
  Shield,
  Mail,
  Info,
  ArrowLeft,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { gateway } from "@/api/gateway-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GeneralSection } from "@/components/settings/GeneralSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { IMChannelsSection } from "@/components/settings/IMChannelsSection";
import { ModelsAndApiSection } from "@/components/settings/ModelsAndApiSection";
import { McpSection } from "@/components/settings/McpSection";
import { AboutSection } from "@/components/settings/AboutSection";
import { SkillsSection } from "@/components/settings/SkillsSection";
import { WorkspaceSection } from "@/components/settings/WorkspaceSection";
import { useAppStore } from "@/stores/app-store";
import { useSettingsStore, type SettingsSection } from "@/stores/settings-store";

const NAV_ITEMS: { key: SettingsSection; labelKey: string; icon: ReactNode }[] = [
  { key: "general", labelKey: "settings.nav.general", icon: <Settings size={16} /> },
  { key: "appearance", labelKey: "settings.nav.appearance", icon: <Palette size={16} /> },
  { key: "models", labelKey: "settings.nav.models", icon: <Puzzle size={16} /> },
  { key: "mcp", labelKey: "settings.nav.mcp", icon: <Plug size={16} /> },
  { key: "skills", labelKey: "settings.nav.skills", icon: <BookOpen size={16} /> },
  { key: "im-channels", labelKey: "settings.nav.channels", icon: <MessageCircle size={16} /> },
  { key: "workspace", labelKey: "settings.nav.workspace", icon: <FolderOpen size={16} /> },
  { key: "privacy", labelKey: "settings.nav.privacy", icon: <Shield size={16} /> },
  { key: "feedback", labelKey: "settings.nav.feedback", icon: <Mail size={16} /> },
  { key: "about", labelKey: "settings.nav.about", icon: <Info size={16} /> },
];

function SectionPlaceholder({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <p>{label} - {t("common.comingSoon")}</p>
    </div>
  );
}

function renderSection(section: SettingsSection) {
  switch (section) {
    case "general":
      return <GeneralSection />;
    case "appearance":
      return <AppearanceSection />;
    case "models":
      return <ModelsAndApiSection />;
    case "mcp":
      return <McpSection />;
    case "im-channels":
      return <IMChannelsSection />;
    case "skills":
      return <SkillsSection />;
    case "workspace":
      return <WorkspaceSection />;
    case "about":
      return <AboutSection />;
    default: {
      const item = NAV_ITEMS.find((n) => n.key === section);
      return <SectionPlaceholder label={item?.labelKey ?? section} />;
    }
  }
}

export function SettingsPage() {
  const activeSection = useSettingsStore((s) => s.activeSection);
  const setActiveSection = useSettingsStore((s) => s.setActiveSection);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const { t } = useTranslation();

  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const debugBottomRef = useRef<HTMLDivElement>(null);

  const refreshDebug = useCallback(() => {
    setDebugLogs([...gateway.debugLog]);
  }, []);

  useEffect(() => {
    if (!debugOpen) {
      gateway.setDebugCallback(() => {});
      return;
    }
    refreshDebug();
    gateway.setDebugCallback(refreshDebug);
    return () => gateway.setDebugCallback(() => {});
  }, [debugOpen, refreshDebug]);

  useEffect(() => {
    if (debugOpen) {
      debugBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [debugLogs, debugOpen]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Settings sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col overflow-y-auto">
        <Button
          variant="ghost"
          onClick={() => setCurrentPage("home")}
          className="flex items-center gap-2 px-4 py-3 text-sm text-primary justify-start rounded-none"
        >
          <ArrowLeft size={14} />
          <span>{t("settings.backToApp")}</span>
        </Button>
        <div className="flex-1 px-2 py-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors ${
                activeSection === item.key
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <span>{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </div>
        <div className="px-4 pb-3">
          <button
            onClick={() => setDebugOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("common.debug")}
          </button>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">{renderSection(activeSection)}</div>

      <Dialog open={debugOpen} onOpenChange={setDebugOpen}>
        <DialogContent className="max-w-2xl h-[500px] flex flex-col gap-0 p-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-border">
            <DialogTitle className="text-sm font-mono">
              {t("common.debug")} — WS: {gateway.wsState} | Connected: {String(gateway.connected)}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 px-4 py-2">
            <div className="font-mono text-[11px] leading-relaxed space-y-0.5">
              {debugLogs.length === 0 ? (
                <span className="text-muted-foreground">No messages yet...</span>
              ) : (
                debugLogs.map((line, i) => {
                  const isError = line.includes("ERROR") || line.includes("error") || line.includes("FAILED");
                  const isEvent = line.includes("EVENT chat") || line.includes("EVENT agent");
                  return (
                    <div
                      key={i}
                      className={isError ? "text-destructive" : isEvent ? "text-cyan-400" : "text-green-400"}
                    >
                      {line}
                    </div>
                  );
                })
              )}
              <div ref={debugBottomRef} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
