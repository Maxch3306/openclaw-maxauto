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
import { useTranslation } from "react-i18next";
import { gateway } from "@/api/gateway-client";
import { useAppStore } from "@/stores/app-store";
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
  isOsIncompatible,
  canWingetInstall,
  getWingetPackageForSkill,
} from "./skills-utils";
import { installWingetPackage } from "@/api/tauri-commands";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const STATUS_BADGE_VARIANT: Record<
  "enabled" | "disabled" | "unavailable",
  { variant: "success" | "secondary" | "warning"; labelKey: string }
> = {
  enabled: {
    variant: "success",
    labelKey: "common.enabled",
  },
  disabled: {
    variant: "secondary",
    labelKey: "common.disabled",
  },
  unavailable: {
    variant: "warning",
    labelKey: "common.unavailable",
  },
};

/** Detect if an emoji string looks like a shortcode (word chars/underscores only). */
function isShortcode(emoji: string): boolean {
  return /^[\w]+$/.test(emoji);
}

function SkillEmoji({ emoji }: { emoji?: string }) {
  if (!emoji || isShortcode(emoji)) {
    return <BookOpen size={18} className="text-muted-foreground" />;
  }
  return <span className="text-lg leading-none">{emoji}</span>;
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
  const { t } = useTranslation();
  const status = getSkillDisplayStatus(skill);
  const badgeInfo = STATUS_BADGE_VARIANT[status];
  const missingItems = computeSkillMissing(skill);
  const toggleDisabled = isToggleDisabled(skill) || skill.always;
  const isChecked = !skill.disabled;
  const needsApiKey = skillNeedsApiKey(skill);
  const hasKey = hasApiKeySet(skill);
  const isEditing = apiKeyEdit !== undefined;

  const isWin = navigator.platform.includes("Win");
  const showInstall = canInstallSkill(skill) && (!isWin || canWingetInstall(skill));

  return (
    <Card
      className={`cursor-pointer hover:bg-secondary transition-colors ${
        status === "unavailable" ? "opacity-60" : ""
      }`}
      onClick={onCardClick}
    >
      {/* Collapsed view */}
      <div className="p-4">
        <div className="flex items-center gap-2.5">
          <SkillEmoji emoji={skill.emoji} />
          <span className="flex-1 text-sm font-medium text-foreground">
            {skill.name}
          </span>
          <Badge variant={badgeInfo.variant} className="text-[10px] px-2 py-0.5">
            {t(badgeInfo.labelKey)}
          </Badge>
          {showInstall && (
            installingSkill === skill.skillKey ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Loader2 size={12} className="animate-spin" />
                {t("settings.skills.installing")}
              </span>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-primary hover:text-primary/80"
                title={skill.install[0].label}
                disabled={installingSkill !== null}
                onClick={(e) => {
                  e.stopPropagation();
                  onInstall(skill);
                }}
              >
                <Download size={14} />
              </Button>
            )
          )}
          <Switch
            checked={isChecked}
            disabled={toggleDisabled || busy}
            onCheckedChange={() => onSkillToggle(skill)}
            onClick={(e) => e.stopPropagation()}
          />
          <ChevronDown
            size={14}
            className={`text-muted-foreground transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
          {skill.description}
        </p>
        {skillError && (
          <p className="text-xs text-destructive mt-1 font-medium">
            {skillError}
          </p>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-3 py-3 space-y-3">
          <p className="text-xs text-foreground">{skill.description}</p>

          {/* API Key section */}
          {needsApiKey && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1.5">
                {t("settings.skills.apiKey")}
              </p>
              {hasKey && !isEditing ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-success">
                    {t("settings.skills.keySaved")}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartEdit(skill.skillKey);
                    }}
                    className="text-[10px] text-primary hover:underline"
                  >
                    {t("settings.skills.change")}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Input
                    type={apiKeyRevealed ? "text" : "password"}
                    value={apiKeyEdit ?? ""}
                    placeholder={hasKey ? t("settings.skills.enterNewKey") : t("settings.skills.enterKey")}
                    onChange={(e) => {
                      e.stopPropagation();
                      onApiKeyChange(skill.skillKey, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="h-7 text-xs font-mono flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onApiKeyRevealToggle(skill.skillKey);
                    }}
                  >
                    {apiKeyRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                  <Button
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSaveApiKey(skill.skillKey);
                    }}
                    disabled={!apiKeyEdit || savingApiKey}
                  >
                    {savingApiKey ? t("common.saving") : t("common.save")}
                  </Button>
                </div>
              )}
              {skillMessage && (
                <p
                  className={`text-[10px] mt-1 ${
                    skillMessage.kind === "success"
                      ? "text-success"
                      : "text-destructive"
                  }`}
                >
                  {skillMessage.message}
                </p>
              )}
            </div>
          )}

          {/* Install error in expanded view */}
          {skillError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded px-3 py-2">
              <p className="text-xs text-destructive font-medium">
                {t("settings.skills.installFailed")}
              </p>
              <p className="text-[10px] text-destructive/80 mt-0.5">
                {skillError}
              </p>
            </div>
          )}

          {/* Why unavailable */}
          {status === "unavailable" && missingItems.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-warning mb-1.5">
                {t("settings.skills.whyUnavailable")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missingItems.map((item) => (
                  <span
                    key={item}
                    className="font-mono text-[10px] bg-background text-muted-foreground px-2 py-0.5 rounded"
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
              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <ExternalLink size={10} />
              {t("settings.skills.homepage")}
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

export function SkillsSection() {
  const { t } = useTranslation();
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

  const isWindows = navigator.platform.includes("Win");

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
        // On Windows, try winget install if a mapping exists
        if (isWindows) {
          const wingetPkg = getWingetPackageForSkill(skill);
          if (wingetPkg) {
            await installWingetPackage(wingetPkg);
            await loadSkills();
            return;
          }
        }

        // Default: use gateway's skill install
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
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <WifiOff size={32} />
        <p className="text-sm font-medium">{t("settings.skills.gatewayNotConnected")}</p>
        <p className="text-xs">
          {t("settings.skills.gatewayRequired")}
        </p>
      </div>
    );
  }

  // Loading
  if (loading && !report) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 size={24} className="animate-spin" />
        <p className="text-sm">{t("settings.skills.loadingSkills")}</p>
      </div>
    );
  }

  // Error
  if (error && !report) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadSkills()}
        >
          <RefreshCw size={12} />
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  // Skills grid — filter out OS-incompatible skills
  const allSkills = report?.skills ?? [];
  const compatibleSkills = allSkills.filter((s) => !isOsIncompatible(s));
  const hiddenCount = allSkills.length - compatibleSkills.length;
  const groups = groupSkills(compatibleSkills);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-foreground">
          {t("settings.skills.title")}
        </h1>
        {report && (
          <span className="text-xs text-muted-foreground">
            {t("settings.skills.skillCount", { count: compatibleSkills.length })}
            {hiddenCount > 0 && ` · ${t("settings.skills.hiddenCount", { count: hiddenCount })}`}
          </span>
        )}
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.id}>
            <div className="flex items-baseline gap-2 mb-3">
              <h2 className="text-sm font-semibold text-foreground">
                {group.label}
              </h2>
              <span className="text-xs text-muted-foreground">
                {group.skills.length}
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
