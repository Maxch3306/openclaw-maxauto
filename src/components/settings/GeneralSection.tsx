import { Download, Globe, RotateCw, Stethoscope, Container, Monitor } from "lucide-react";
import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import i18n from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { gateway } from "@/api/gateway-client";
import { stopGateway, startGateway, stopDockerGateway, startDockerGateway, runDoctor } from "@/api/tauri-commands";
import { useAppStore } from "@/stores/app-store";
import { useChatStore } from "@/stores/chat-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUpdateStore } from "@/stores/update-store";

export function GeneralSection() {
  const { t } = useTranslation();
  const gatewayConnected = useAppStore((s) => s.gatewayConnected);
  const gatewayPort = useAppStore((s) => s.gatewayPort);
  const installMode = useAppStore((s) => s.installMode);
  const loadConfig = useSettingsStore((s) => s.loadConfig);
  const loadModels = useSettingsStore((s) => s.loadModels);
  const loadAgents = useChatStore((s) => s.loadAgents);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const [restarting, setRestarting] = useState(false);
  const [runningDoctor, setRunningDoctor] = useState(false);
  const [doctorOutput, setDoctorOutput] = useState<string | null>(null);

  const handleRestartGateway = async () => {
    setRestarting(true);
    try {
      gateway.disconnect();
      if (installMode === "docker") {
        await stopDockerGateway();
        await new Promise((r) => setTimeout(r, 1500));
        await startDockerGateway(gatewayPort);
      } else {
        await stopGateway();
        await new Promise((r) => setTimeout(r, 1500));
        await startGateway();
      }
      await new Promise((r) => setTimeout(r, 3000));
      gateway.reconnect();
      // Wait for WS to connect, then reload all data
      await new Promise((r) => setTimeout(r, 2000));
      await loadConfig();
      await loadModels();
      await loadAgents();
      await loadSessions();
    } catch (err) {
      console.error("[general] restart gateway failed:", err);
    } finally {
      setRestarting(false);
    }
  };

  const handleDoctor = async () => {
    setRunningDoctor(true);
    setDoctorOutput(null);
    try {
      const output = await runDoctor();
      setDoctorOutput(output);
    } catch (err) {
      setDoctorOutput(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunningDoctor(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-lg font-semibold text-foreground mb-6">{t("settings.general.title")}</h1>

      <section className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("settings.general.gateway")}</h2>
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={gatewayConnected ? "success" : "destructive"} className="text-xs">
                {gatewayConnected ? t("common.connected") : t("common.disconnected")}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                ws://127.0.0.1:{gatewayPort}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestartGateway}
              disabled={restarting}
            >
              <RotateCw size={14} className={restarting ? "animate-spin" : ""} />
              {restarting ? t("settings.general.restarting") : t("settings.general.restartGateway")}
            </Button>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("settings.general.healthCheck")}</h2>
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <Trans i18nKey="settings.general.doctorDesc" components={{ code: <code className="px-1 py-0.5 rounded bg-background text-foreground" /> }} />
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDoctor}
              disabled={runningDoctor}
              className="shrink-0"
            >
              <Stethoscope size={14} className={runningDoctor ? "animate-pulse" : ""} />
              {runningDoctor ? t("settings.general.running") : t("settings.general.runDoctor")}
            </Button>
          </div>
          {doctorOutput !== null && (
            <pre className="p-3 rounded bg-background border border-border text-xs text-foreground overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
              {doctorOutput}
            </pre>
          )}
        </Card>
      </section>

      <LanguageSection />
      <InstallModeSection />
      <UpdateSection />
    </div>
  );
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh-TW", label: "繁體中文" },
];

function LanguageSection() {
  const { t } = useTranslation();
  const currentLang = i18n.language;

  const handleChange = (lang: string) => {
    void i18n.changeLanguage(lang);
  };

  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">
        <div className="flex items-center gap-1.5">
          <Globe size={14} />
          {t("settings.general.language")}
        </div>
      </h2>
      <Card className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          {t("settings.general.languageDesc")}
        </p>
        <select
          value={currentLang}
          onChange={(e) => handleChange(e.target.value)}
          className="bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </Card>
    </section>
  );
}

function InstallModeSection() {
  const { t } = useTranslation();
  const installMode = useAppStore((s) => s.installMode);
  const setSetupComplete = useAppStore((s) => s.setSetupComplete);
  const setSetupStep = useAppStore((s) => s.setSetupStep);

  const handleReset = () => {
    setSetupStep("choosing-mode");
    setSetupComplete(false);
  };

  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">
        {t("settings.general.installMode")}
      </h2>
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {installMode === "docker" ? (
              <Container size={14} className="text-green-400" />
            ) : (
              <Monitor size={14} className="text-blue-400" />
            )}
            <span className="text-sm text-foreground">
              {installMode === "docker"
                ? t("settings.general.installModeDocker")
                : t("settings.general.installModeNative")}
            </span>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={handleReset}
          >
            {t("settings.general.resetSetup")}
          </Button>
        </div>
      </Card>
    </section>
  );
}

function UpdateSection() {
  const { t } = useTranslation();
  const status = useUpdateStore((s) => s.status);
  const availableVersion = useUpdateStore((s) => s.availableVersion);
  const checkForUpdate = useUpdateStore((s) => s.checkForUpdate);
  const downloadAndInstall = useUpdateStore((s) => s.downloadAndInstall);
  const checking = status === "checking";

  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("settings.general.updates")}</h2>
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            {status === "available" ? (
              <p className="text-sm text-foreground">
                <Trans i18nKey="settings.general.updateAvailable" values={{ version: availableVersion }} components={{ strong: <strong /> }} />
              </p>
            ) : status === "up-to-date" ? (
              <p className="text-xs text-muted-foreground">{t("settings.general.latestVersion")}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("settings.general.checkDesc")}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status === "available" && (
              <Button
                onClick={() => void downloadAndInstall()}
                size="sm"
              >
                <Download size={14} />
                {t("settings.general.installUpdate")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void checkForUpdate()}
              disabled={checking}
            >
              <RotateCw size={14} className={checking ? "animate-spin" : ""} />
              {checking ? t("settings.general.checking") : t("settings.general.checkForUpdates")}
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
