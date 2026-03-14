import {
  WifiOff,
  Loader2,
  BookOpen,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  Eye,
  EyeOff,
  Download,
} from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { gateway } from "../../api/gateway-client";
import { useAppStore } from "../../stores/app-store";
import {
  type SkillStatusReport,
  type SkillStatusEntry,
  groupSkills,
  getSkillDisplayStatus,
  computeSkillMissing,
  skillNeedsApiKey,
  hasApiKeySet,
  isToggleDisabled,
  canInstallSkill,
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

function ToggleSwitch({
  checked,
  disabled,
  busy,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  busy: boolean;
  onChange: () => void;
}) {
  const isDisabled = disabled || busy;
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={isDisabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDisabled) onChange();
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none ${
        isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      } ${checked ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]/30"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function SkillCard({
  skill,
  expanded,
  onCardClick,
  onSkillToggle,
  skillError,
  busy,
  apiKeyEdit,
  apiKeyRevealed,
  savingApiKey,
  skillMessage,
  onApiKeyChange,
  onApiKeyRevealToggle,
  onSaveApiKey,
  onStartEdit,
  installingSkill,
  onInstall,
}: {
  skill: SkillStatusEntry;
  expanded: boolean;
  onCardClick: () => void;
  onSkillToggle: (skill: SkillStatusEntry) => void;
  skillError?: string;
  busy: boolean;
  apiKeyEdit?: string;
  apiKeyRevealed: boolean;
  savingApiKey: boolean;
  skillMessage?: { kind: "success" | "error"; message: string };
  onApiKeyChange: (skillKey: string, value: string) => void;
  onApiKeyRevealToggle: (skillKey: string) => void;
  onSaveApiKey: (skillKey: string) => void;
  onStartEdit: (skillKey: string) => void;
  installingSkill: string | null;
  onInstall: (skill: SkillStatusEntry) => void;
}) {
  const status = getSkillDisplayStatus(skill);
  const badge = STATUS_BADGE[status];
  const missingItems = computeSkillMissing(skill);
  const toggleDisabled = isToggleDisabled(skill) || skill.always;
  const isChecked = !skill.disabled;
  const needsApiKey = skillNeedsApiKey(skill);
  const hasKey = hasApiKeySet(skill);
  const isEditing = apiKeyEdit !== undefined;

  return (
    <div
      className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors ${
        status === "unavailable" ? "opacity-60" : ""
      }`}
      onClick={onCardClick}
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
          {canInstallSkill(skill) && (
            installingSkill === skill.skillKey ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                <Loader2 size={12} className="animate-spin" />
                Installing...
              </span>
            ) : (
              <button
                title={skill.install[0].label}
                disabled={installingSkill !== null}
                onClick={(e) => {
                  e.stopPropagation();
                  onInstall(skill);
                }}
                className="p-1 text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors disabled:opacity-40"
              >
                <Download size={14} />
              </button>
            )
          )}
          <ToggleSwitch
            checked={isChecked}
            disabled={toggleDisabled}
            busy={busy}
            onChange={() => onSkillToggle(skill)}
          />
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
        {skillError && (
          <p className="text-xs text-[var(--color-error)] mt-1 font-medium">
            {skillError}
          </p>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-[var(--color-border)] px-3 py-3 space-y-3">
          <p className="text-xs text-[var(--color-text)]">{skill.description}</p>

          {/* API Key section */}
          {needsApiKey && (
            <div>
              <p className="text-[10px] font-medium text-[var(--color-text-muted)] mb-1.5">
                API Key
              </p>
              {hasKey && !isEditing ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--color-success)]">
                    Key saved
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartEdit(skill.skillKey);
                    }}
                    className="text-[10px] text-[var(--color-accent)] hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type={apiKeyRevealed ? "text" : "password"}
                    value={apiKeyEdit ?? ""}
                    placeholder={hasKey ? "Enter new API key" : "Enter API key"}
                    onChange={(e) => {
                      e.stopPropagation();
                      onApiKeyChange(skill.skillKey, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-xs font-mono flex-1 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onApiKeyRevealToggle(skill.skillKey);
                    }}
                    className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                  >
                    {apiKeyRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSaveApiKey(skill.skillKey);
                    }}
                    disabled={!apiKeyEdit || savingApiKey}
                    className="text-xs px-2 py-1 rounded bg-[var(--color-accent)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >
                    {savingApiKey ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
              {skillMessage && (
                <p
                  className={`text-[10px] mt-1 ${
                    skillMessage.kind === "success"
                      ? "text-[var(--color-success)]"
                      : "text-[var(--color-error)]"
                  }`}
                >
                  {skillMessage.message}
                </p>
              )}
            </div>
          )}

          {/* Install error in expanded view */}
          {skillError && (
            <div className="bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded px-3 py-2">
              <p className="text-xs text-[var(--color-error)] font-medium">
                Install failed
              </p>
              <p className="text-[10px] text-[var(--color-error)]/80 mt-0.5">
                {skillError}
              </p>
            </div>
          )}

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

  // Task 1 state: toggle errors and busy tracking
  const [skillErrors, setSkillErrors] = useState<Record<string, string>>({});
  const [busySkills, setBusySkills] = useState<Set<string>>(new Set());

  // Task 2 state: API key editing
  const [apiKeyEdits, setApiKeyEdits] = useState<Record<string, string>>({});

  // Install state
  const [installingSkill, setInstallingSkill] = useState<string | null>(null);
  const [apiKeyRevealed, setApiKeyRevealed] = useState<Record<string, boolean>>(
    {},
  );
  const [savingApiKey, setSavingApiKey] = useState<string | null>(null);
  const [skillMessages, setSkillMessages] = useState<
    Record<string, { kind: "success" | "error"; message: string }>
  >({});

  // Refs for cleanup of auto-dismiss timers
  const errorTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const messageTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const t of Object.values(errorTimers.current)) clearTimeout(t);
      for (const t of Object.values(messageTimers.current)) clearTimeout(t);
    };
  }, []);

  const handleToggle = useCallback(
    async (skill: SkillStatusEntry) => {
      const key = skill.skillKey;
      const originalDisabled = skill.disabled;
      const newEnabled = originalDisabled; // if was disabled, enable it

      // Mark busy
      setBusySkills((prev) => new Set(prev).add(key));

      // Optimistic update
      setReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          skills: prev.skills.map((s) =>
            s.skillKey === key ? { ...s, disabled: !newEnabled } : s,
          ),
        };
      });

      // Clear existing error
      setSkillErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      try {
        await gateway.request("skills.update", {
          skillKey: key,
          enabled: newEnabled,
        });
        await loadSkills();
      } catch (err) {
        // Revert optimistic update
        setReport((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            skills: prev.skills.map((s) =>
              s.skillKey === key ? { ...s, disabled: originalDisabled } : s,
            ),
          };
        });
        const msg = err instanceof Error ? err.message : String(err);
        setSkillErrors((prev) => ({ ...prev, [key]: msg }));

        // Auto-dismiss error after 5 seconds
        if (errorTimers.current[key]) clearTimeout(errorTimers.current[key]);
        errorTimers.current[key] = setTimeout(() => {
          setSkillErrors((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }, 5000);
      } finally {
        setBusySkills((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [loadSkills],
  );

  const handleInstall = useCallback(
    async (skill: SkillStatusEntry) => {
      const key = skill.skillKey;
      setInstallingSkill(key);

      // Clear any previous error for this skill
      setSkillErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      try {
        await gateway.request("skills.install", {
          name: skill.name,
          installId: skill.install[0].id,
          timeoutMs: 120000,
        });
        await loadSkills();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSkillErrors((prev) => ({ ...prev, [key]: msg }));

        // Auto-dismiss error after 30 seconds
        if (errorTimers.current[key]) clearTimeout(errorTimers.current[key]);
        errorTimers.current[key] = setTimeout(() => {
          setSkillErrors((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }, 30000);
      } finally {
        setInstallingSkill(null);
      }
    },
    [loadSkills],
  );

  const handleSaveApiKey = useCallback(
    async (skillKey: string) => {
      const value = apiKeyEdits[skillKey];
      if (!value) return;

      setSavingApiKey(skillKey);
      try {
        await gateway.request("skills.update", {
          skillKey,
          apiKey: value,
        });
        await loadSkills();
        // Clear the edit input
        setApiKeyEdits((prev) => {
          const next = { ...prev };
          delete next[skillKey];
          return next;
        });
        setSkillMessages((prev) => ({
          ...prev,
          [skillKey]: { kind: "success", message: "Saved" },
        }));
        // Auto-dismiss success message after 3 seconds
        if (messageTimers.current[skillKey])
          clearTimeout(messageTimers.current[skillKey]);
        messageTimers.current[skillKey] = setTimeout(() => {
          setSkillMessages((prev) => {
            const next = { ...prev };
            delete next[skillKey];
            return next;
          });
        }, 3000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSkillMessages((prev) => ({
          ...prev,
          [skillKey]: { kind: "error", message: msg },
        }));
      } finally {
        setSavingApiKey(null);
      }
    },
    [apiKeyEdits, loadSkills],
  );

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
                  onCardClick={() =>
                    setExpanded(
                      expanded === skill.skillKey ? null : skill.skillKey,
                    )
                  }
                  onSkillToggle={handleToggle}
                  skillError={skillErrors[skill.skillKey]}
                  busy={busySkills.has(skill.skillKey)}
                  apiKeyEdit={apiKeyEdits[skill.skillKey]}
                  apiKeyRevealed={apiKeyRevealed[skill.skillKey] ?? false}
                  savingApiKey={savingApiKey === skill.skillKey}
                  skillMessage={skillMessages[skill.skillKey]}
                  onApiKeyChange={(key, value) =>
                    setApiKeyEdits((prev) => ({ ...prev, [key]: value }))
                  }
                  onApiKeyRevealToggle={(key) =>
                    setApiKeyRevealed((prev) => ({
                      ...prev,
                      [key]: !prev[key],
                    }))
                  }
                  onSaveApiKey={handleSaveApiKey}
                  onStartEdit={(key) =>
                    setApiKeyEdits((prev) => ({ ...prev, [key]: "" }))
                  }
                  installingSkill={installingSkill}
                  onInstall={handleInstall}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
