import {
  Settings,
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
import { GeneralSection } from "../components/settings/GeneralSection";
import { IMChannelsSection } from "../components/settings/IMChannelsSection";
import { ModelsAndApiSection } from "../components/settings/ModelsAndApiSection";
import { AboutSection } from "../components/settings/AboutSection";
import { useAppStore } from "../stores/app-store";
import { useSettingsStore, type SettingsSection } from "../stores/settings-store";

const NAV_ITEMS: { key: SettingsSection; label: string; icon: ReactNode }[] = [
  { key: "general", label: "General", icon: <Settings size={16} /> },
  { key: "models", label: "Models & API", icon: <Puzzle size={16} /> },
  { key: "mcp", label: "MCP Services", icon: <Plug size={16} /> },
  { key: "skills", label: "Skills", icon: <BookOpen size={16} /> },
  { key: "im-channels", label: "Channels", icon: <MessageCircle size={16} /> },
  { key: "workspace", label: "Workspace", icon: <FolderOpen size={16} /> },
  { key: "privacy", label: "Data & Privacy", icon: <Shield size={16} /> },
  { key: "feedback", label: "Feedback", icon: <Mail size={16} /> },
  { key: "about", label: "About", icon: <Info size={16} /> },
];

function SectionPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
      <p>{label} - Coming Soon</p>
    </div>
  );
}

function renderSection(section: SettingsSection) {
  switch (section) {
    case "general":
      return <GeneralSection />;
    case "models":
      return <ModelsAndApiSection />;
    case "im-channels":
      return <IMChannelsSection />;
    case "about":
      return <AboutSection />;
    default: {
      const item = NAV_ITEMS.find((n) => n.key === section);
      return <SectionPlaceholder label={item?.label ?? section} />;
    }
  }
}

export function SettingsPage() {
  const activeSection = useSettingsStore((s) => s.activeSection);
  const setActiveSection = useSettingsStore((s) => s.setActiveSection);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Settings sidebar */}
      <aside className="w-56 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col overflow-y-auto">
        <button
          onClick={() => setCurrentPage("home")}
          className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--color-accent)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to App</span>
        </button>
        <div className="flex-1 px-2 py-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors ${
                activeSection === item.key
                  ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">{renderSection(activeSection)}</div>
    </div>
  );
}
