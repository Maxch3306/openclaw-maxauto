import { Shield, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { gateway } from "@/api/gateway-client";
import { useChatStore } from "@/stores/chat-store";
import { useSettingsStore } from "@/stores/settings-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <Dialog open={true} onOpenChange={(v) => { if (!v) setShowQuickConfig(false); }}>
      <DialogContent className="w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("settings.quickConfig.title")}</DialogTitle>
          <DialogDescription>
            {t("settings.quickConfig.subtitle")}
          </DialogDescription>
        </DialogHeader>

        {/* Form */}
        <div className="space-y-4">
          {/* User name */}
          <div>
            <Label className="mb-1">{t("settings.quickConfig.whatCallYou")}</Label>
            <Input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={t("settings.quickConfig.enterName")}
            />
          </div>

          {/* User role */}
          <div>
            <Label className="mb-1">{t("settings.quickConfig.yourRole")}</Label>
            <Input
              type="text"
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              placeholder={t("settings.quickConfig.rolePlaceholder")}
            />
          </div>

          {/* Agent nickname */}
          <div>
            <Label className="mb-1">{t("settings.quickConfig.agentName")}</Label>
            <Input
              type="text"
              value={agentNickname}
              onChange={(e) => setAgentNickname(e.target.value)}
              placeholder={t("settings.quickConfig.agentNamePlaceholder")}
            />
          </div>

          {/* Usage scenarios */}
          <div>
            <Label className="mb-2">{t("settings.quickConfig.scenarios")}</Label>
            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleScenario(s)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors ${
                    selectedScenarios.includes(s)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary border border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  {t(SCENARIO_LABELS[s] ?? s)}
                </button>
              ))}
              <button className="px-3 py-1 rounded-full text-xs bg-secondary border border-border text-muted-foreground hover:border-primary">
                {t("settings.quickConfig.other")}
              </button>
            </div>
          </div>

          {/* Work directory */}
          <div>
            <Label className="mb-1">{t("settings.quickConfig.workDir")}</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={workDir}
                onChange={(e) => setWorkDir(e.target.value)}
                className="flex-1 font-mono"
              />
              <Button variant="outline" size="sm" className="whitespace-nowrap">
                {t("settings.quickConfig.browseDots")}
              </Button>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2">
            {/* Limit file access */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-foreground" />
                <div>
                  <p className="text-sm text-foreground">{t("settings.quickConfig.limitFileAccess")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.quickConfig.limitFileAccessDesc")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLimitFileAccess(!limitFileAccess)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  limitFileAccess ? "bg-primary" : "bg-border"
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
                <Sparkles size={16} className="text-foreground" />
                <p className="text-sm text-foreground">{t("settings.quickConfig.optimizePlan")}</p>
              </div>
              <button
                onClick={() => setOptimizePlan(!optimizePlan)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  optimizePlan ? "bg-primary" : "bg-border"
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

        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? t("common.saving") : t("settings.quickConfig.completeSetup")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
