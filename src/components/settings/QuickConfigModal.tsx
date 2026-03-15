import { Shield, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { gateway } from "../../api/gateway-client";
import { useChatStore } from "../../stores/chat-store";
import { useSettingsStore } from "../../stores/settings-store";

const SCENARIOS = [
  "Coding",
  "Writing",
  "Product",
  "Data Analysis",
  "Design",
  "DevOps",
  "Research",
  "Marketing",
];

const SCENARIO_LABELS: Record<string, string> = {
  "Coding": "settings.quickConfig.coding",
  "Writing": "settings.quickConfig.writing",
  "Product": "settings.quickConfig.product",
  "Data Analysis": "settings.quickConfig.dataAnalysis",
  "Design": "settings.quickConfig.design",
  "DevOps": "settings.quickConfig.devops",
  "Research": "settings.quickConfig.research",
  "Marketing": "settings.quickConfig.marketing",
};

export function QuickConfigModal() {
  const { t } = useTranslation();
  const setShowQuickConfig = useSettingsStore((s) => s.setShowQuickConfig);
  const selectedAgentId = useChatStore((s) => s.selectedAgentId);

  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [agentNickname, setAgentNickname] = useState("");
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [workDir, setWorkDir] = useState("~/.openclaw-maxauto/workspace");
  const [limitFileAccess, setLimitFileAccess] = useState(true);
  const [optimizePlan, setOptimizePlan] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleScenario = (s: string) => {
    setSelectedScenarios((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const handleSave = async () => {
    if (!selectedAgentId) {
      return;
    }
    setSaving(true);
    try {
      // Save user info to USER.md
      const userContent = [
        userName && `# User: ${userName}`,
        userRole && `Role: ${userRole}`,
        selectedScenarios.length > 0 && `Scenarios: ${selectedScenarios.join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n");

      if (userContent) {
        await gateway.request("agents.files.set", {
          agentId: selectedAgentId,
          name: "USER.md",
          content: userContent,
        });
      }

      // Save agent nickname to IDENTITY.md
      if (agentNickname) {
        await gateway.request("agents.files.set", {
          agentId: selectedAgentId,
          name: "IDENTITY.md",
          content: `name: ${agentNickname}`,
        });
      }

      setShowQuickConfig(false);
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[480px] max-h-[90vh] overflow-y-auto bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text)]">{t("settings.quickConfig.title")}</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {t("settings.quickConfig.subtitle")}
            </p>
          </div>
          <button
            onClick={() => setShowQuickConfig(false)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
          {/* User name */}
          <div>
            <label className="block text-sm text-[var(--color-text)] mb-1">
              {t("settings.quickConfig.whatCallYou")}
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={t("settings.quickConfig.enterName")}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* User role */}
          <div>
            <label className="block text-sm text-[var(--color-text)] mb-1">
              {t("settings.quickConfig.yourRole")}
            </label>
            <input
              type="text"
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              placeholder={t("settings.quickConfig.rolePlaceholder")}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Agent nickname */}
          <div>
            <label className="block text-sm text-[var(--color-text)] mb-1">
              {t("settings.quickConfig.agentName")}
            </label>
            <input
              type="text"
              value={agentNickname}
              onChange={(e) => setAgentNickname(e.target.value)}
              placeholder={t("settings.quickConfig.agentNamePlaceholder")}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Usage scenarios */}
          <div>
            <label className="block text-sm text-[var(--color-text)] mb-2">
              {t("settings.quickConfig.scenarios")}
            </label>
            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleScenario(s)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors ${
                    selectedScenarios.includes(s)
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]"
                  }`}
                >
                  {t(SCENARIO_LABELS[s] ?? s)}
                </button>
              ))}
              <button className="px-3 py-1 rounded-full text-xs bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]">
                {t("settings.quickConfig.other")}
              </button>
            </div>
          </div>

          {/* Work directory */}
          <div>
            <label className="block text-sm text-[var(--color-text)] mb-1">{t("settings.quickConfig.workDir")}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={workDir}
                onChange={(e) => setWorkDir(e.target.value)}
                className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:outline-none focus:border-[var(--color-accent)]"
              />
              <button className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors whitespace-nowrap">
                {t("settings.quickConfig.browseDots")}
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2">
            {/* Limit file access */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={16} />
                <div>
                  <p className="text-sm text-[var(--color-text)]">{t("settings.quickConfig.limitFileAccess")}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t("settings.quickConfig.limitFileAccessDesc")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLimitFileAccess(!limitFileAccess)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  limitFileAccess ? "bg-[var(--color-warning)]" : "bg-[var(--color-border)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    limitFileAccess ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Optimize plan */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} />
                <p className="text-sm text-[var(--color-text)]">{t("settings.quickConfig.optimizePlan")}</p>
              </div>
              <button
                onClick={() => setOptimizePlan(!optimizePlan)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  optimizePlan ? "bg-[var(--color-warning)]" : "bg-[var(--color-border)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    optimizePlan ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 text-sm rounded-lg bg-[var(--color-warning)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("settings.quickConfig.completeSetup")}
          </button>
        </div>
      </div>
    </div>
  );
}
