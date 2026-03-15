import { MoreHorizontal } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Agent } from "../../stores/chat-store";

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

interface AgentCardProps {
  agent: Agent;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function AgentCard({ agent, selected, onSelect, onEdit, onDelete }: AgentCardProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const bgColor = hashColor(agent.name || agent.agentId);

  return (
    <div
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors group ${
        selected
          ? "bg-[var(--color-accent)]/10 border-l-3 border-[var(--color-accent)]"
          : "hover:bg-[var(--color-surface-hover)]"
      }`}
      onClick={onSelect}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
          style={{ backgroundColor: bgColor }}
        >
          {agent.emoji || agent.name?.charAt(0)?.toUpperCase() || "?"}
        </div>
        {/* Online indicator */}
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[var(--color-success)] border-2 border-[var(--color-surface)]" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--color-text)] truncate">
          {agent.name || agent.agentId}
        </div>
        {agent.workspace && (
          <div className="text-[11px] text-[var(--color-text-muted)] truncate">
            {agent.workspace}
          </div>
        )}
      </div>

      {/* Menu button */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="hidden group-hover:flex items-center justify-center p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-32 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-lg z-10 py-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onEdit();
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              {t("common.edit")}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete();
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
            >
              {t("common.delete")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
