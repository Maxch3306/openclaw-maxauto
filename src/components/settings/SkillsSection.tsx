import {
  WifiOff,
  Loader2,
  BookOpen,
  ExternalLink,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { gateway } from "../../api/gateway-client";
import { useAppStore } from "../../stores/app-store";
import {
  type SkillStatusReport,
  type SkillStatusEntry,
  groupSkills,
  getSkillDisplayStatus,
  computeSkillMissing,
} from "./skills-utils";

const STATUS_BADGE: Record<
  "enabled" | "disabled" | "unavailable",
  { bg: string; text: string; label: string }
> = {
  enabled: {
    bg: "bg-[var(--color-success)]/20",
    text: "text-[var(--color-success)]",
    label: "Enabled",
  },
  disabled: {
    bg: "bg-[var(--color-text-muted)]/20",
    text: "text-[var(--color-text-muted)]",
    label: "Disabled",
  },
  unavailable: {
    bg: "bg-[var(--color-warning)]/20",
    text: "text-[var(--color-warning)]",
    label: "Unavailable",
  },
};

/** Detect if an emoji string looks like a shortcode (word chars/underscores only). */
function isShortcode(emoji: string): boolean {
  return /^[\w]+$/.test(emoji);
}

function SkillEmoji({ emoji }: { emoji?: string }) {
  if (!emoji || isShortcode(emoji)) {
    return <BookOpen size={18} className="text-[var(--color-text-muted)]" />;
  }
  return <span className="text-lg leading-none">{emoji}</span>;
}

function SkillCard({
  skill,
  expanded,
  onToggle,
}: {
  skill: SkillStatusEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = getSkillDisplayStatus(skill);
  const badge = STATUS_BADGE[status];
  const missingItems = computeSkillMissing(skill);

  return (
    <div
      className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors ${
        status === "unavailable" ? "opacity-60" : ""
      }`}
      onClick={onToggle}
    >
      {/* Collapsed view */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <SkillEmoji emoji={skill.emoji} />
          <span className="flex-1 text-sm font-medium text-[var(--color-text)] truncate">
            {skill.name}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
          <ChevronDown
            size={14}
            className={`text-[var(--color-text-muted)] transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-1">
          {skill.description}
        </p>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-[var(--color-border)] px-3 py-3 space-y-3">
          <p className="text-xs text-[var(--color-text)]">{skill.description}</p>

          {/* Why unavailable */}
          {status === "unavailable" && missingItems.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-[var(--color-warning)] mb-1.5">
                Why unavailable
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missingItems.map((item) => (
                  <span
                    key={item}
                    className="font-mono text-[10px] bg-[var(--color-bg)] text-[var(--color-text-muted)] px-2 py-0.5 rounded"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Install options */}
          {skill.install.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-[var(--color-text-muted)] mb-1">
                Install options
              </p>
              <div className="space-y-0.5">
                {skill.install.map((opt) => (
                  <p
                    key={opt.id}
                    className="text-[10px] text-[var(--color-text-muted)]"
                  >
                    {opt.label}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Homepage link */}
          {skill.homepage && (
            <a
              href={skill.homepage}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[10px] text-[var(--color-accent)] hover:underline"
            >
              <ExternalLink size={10} />
              Homepage
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function SkillsSection() {
  const gatewayConnected = useAppStore((s) => s.gatewayConnected);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SkillStatusReport | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await gateway.request<SkillStatusReport>(
        "skills.status",
        {},
      );
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (gatewayConnected) {
      void loadSkills();
    } else {
      setLoading(false);
    }
  }, [gatewayConnected, loadSkills]);

  // Gateway disconnected
  if (!gatewayConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] gap-2">
        <WifiOff size={32} />
        <p className="text-sm font-medium">Gateway not connected</p>
        <p className="text-xs">
          Skills information is available when the gateway is running.
        </p>
      </div>
    );
  }

  // Loading
  if (loading && !report) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] gap-2">
        <Loader2 size={24} className="animate-spin" />
        <p className="text-sm">Loading skills...</p>
      </div>
    );
  }

  // Error
  if (error && !report) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-[var(--color-error)]">{error}</p>
        <button
          onClick={() => void loadSkills()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  // Skills grid
  const groups = report ? groupSkills(report.skills) : [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-[var(--color-text)]">
          Skills
        </h1>
        {report && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {report.skills.length} skills
          </span>
        )}
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.id}>
            <div className="flex items-baseline gap-2 mb-3">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                {group.label}
              </h2>
              <span className="text-xs text-[var(--color-text-muted)]">
                {group.skills.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.skills.map((skill) => (
                <SkillCard
                  key={skill.skillKey}
                  skill={skill}
                  expanded={expanded === skill.skillKey}
                  onToggle={() =>
                    setExpanded(
                      expanded === skill.skillKey ? null : skill.skillKey,
                    )
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
