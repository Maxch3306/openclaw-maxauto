import { Download, Globe, RotateCw, Stethoscope, Container, Monitor } from "lucide-react";
import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import i18n from "../../i18n";
import { gateway } from "../../api/gateway-client";
import { stopGateway, startGateway, stopDockerGateway, startDockerGateway, runDoctor } from "../../api/tauri-commands";
import { useAppStore } from "../../stores/app-store";
import { useChatStore } from "../../stores/chat-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useUpdateStore } from "../../stores/update-store";

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
      <h1 className="text-lg font-semibold text-[var(--color-text)] mb-6">{t("settings.general.title")}</h1>

      <section className="mb-6">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">{t("settings.general.gateway")}</h2>
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  gatewayConnected
                    ? "bg-[var(--color-success)]/20 text-[var(--color-success)]"
                    : "bg-[var(--color-error)]/20 text-[var(--color-error)]"
                }`}
              >
                {gatewayConnected ? t("common.connected") : t("common.disconnected")}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-mono">
                ws://127.0.0.1:{gatewayPort}
              </span>
            </div>
            <button
              onClick={handleRestartGateway}
              disabled={restarting}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
            >
              <RotateCw size={14} className={restarting ? "animate-spin" : ""} />
              {restarting ? t("settings.general.restarting") : t("settings.general.restartGateway")}
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">{t("settings.general.healthCheck")}</h2>
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--color-text-muted)]">
              <Trans i18nKey="settings.general.doctorDesc" components={{ code: <code className="px-1 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-text)]" /> }} />
            </p>
            <button
              onClick={handleDoctor}
              disabled={runningDoctor}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50 shrink-0"
            >
              <Stethoscope size={14} className={runningDoctor ? "animate-pulse" : ""} />
              {runningDoctor ? t("settings.general.running") : t("settings.general.runDoctor")}
            </button>
          </div>
          {doctorOutput !== null && (
            <pre className="p-3 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-xs text-[var(--color-text)] overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
              {doctorOutput}
            </pre>
          )}
        </div>
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
      <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">
        <div className="flex items-center gap-1.5">
          <Globe size={14} />
          {t("settings.general.language")}
        </div>
      </h2>
      <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          {t("settings.general.languageDesc")}
        </p>
        <select
          value={currentLang}
          onChange={(e) => handleChange(e.target.value)}
          className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
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
      <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">
        {t("settings.general.installMode")}
      </h2>
      <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {installMode === "docker" ? (
              <Container size={14} className="text-green-400" />
            ) : (
              <Monitor size={14} className="text-blue-400" />
            )}
            <span className="text-sm text-[var(--color-text)]">
              {installMode === "docker"
                ? t("settings.general.installModeDocker")
                : t("settings.general.installModeNative")}
            </span>
          </div>
          <button
            onClick={handleReset}
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            {t("settings.general.resetSetup")}
          </button>
        </div>
      </div>
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
      <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">{t("settings.general.updates")}</h2>
      <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            {status === "available" ? (
              <p className="text-sm text-[var(--color-text)]">
                <Trans i18nKey="settings.general.updateAvailable" values={{ version: availableVersion }} components={{ strong: <strong /> }} />
              </p>
            ) : status === "up-to-date" ? (
              <p className="text-xs text-[var(--color-text-muted)]">{t("settings.general.latestVersion")}</p>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">{t("settings.general.checkDesc")}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status === "available" && (
              <button
                onClick={() => void downloadAndInstall()}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
              >
                <Download size={14} />
                {t("settings.general.installUpdate")}
              </button>
            )}
            <button
              onClick={() => void checkForUpdate()}
              disabled={checking}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
            >
              <RotateCw size={14} className={checking ? "animate-spin" : ""} />
              {checking ? t("settings.general.checking") : t("settings.general.checkForUpdates")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
