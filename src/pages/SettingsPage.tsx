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
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Settings sidebar */}
      <aside className="w-56 bg-card border-r border-border flex flex-col overflow-y-auto">
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
      </aside>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">{renderSection(activeSection)}</div>
    </div>
  );
}
