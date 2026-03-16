import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Monitor, Container, RefreshCw, ExternalLink } from "lucide-react";
import { TitleBar } from "../components/layout/TitleBar";
import { useAppStore } from "../stores/app-store";
import {
  checkNode,
  checkGit,
  checkOpenclaw,
  installNode,
  installGit,
  installOpenclaw,
  startGateway,
  checkDocker,
  pullOpenclawImage,
  startDockerGateway,
  openUrl,
} from "../api/tauri-commands";
import type { DockerStatus } from "../api/tauri-commands";

export function SetupPage() {
  const {
    setupStep,
    setupError,
    installMode,
    setSetupStep,
    setSetupError,
    setSetupComplete,
    setGatewayRunning,
    setInstallMode,
  } = useAppStore();
  const { t } = useTranslation();
  const [statusMessage, setStatusMessage] = useState("");
  const [progress, setProgress] = useState(0);

  // Docker detection state
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);
  const [checkingDocker, setCheckingDocker] = useState(true);

  // Check Docker availability on mount
  useEffect(() => {
    detectDocker();
  }, []);

  async function detectDocker() {
    setCheckingDocker(true);
    try {
      const status = await checkDocker();
      setDockerStatus(status);
    } catch {
      setDockerStatus({ available: false, version: null, daemon_running: false });
    } finally {
      setCheckingDocker(false);
    }
  }

  function handleSelectMode(mode: "native" | "docker") {
    setInstallMode(mode);
    setSetupStep("checking");
    if (mode === "native") {
      runNativeSetup();
    } else {
      runDockerSetup();
    }
  }

  async function runNativeSetup() {
    try {
      setSetupStep("checking");
      setStatusMessage(t("setup.checkingGit"));
      setProgress(5);

      const gitStatus = await checkGit();

      if (!gitStatus.available) {
        setSetupStep("install-git");
        setStatusMessage(t("setup.installingGit"));
        setProgress(10);
        await installGit();
      }

      setProgress(15);
      setStatusMessage(t("setup.checkingNode"));

      const nodeStatus = await checkNode();

      if (!nodeStatus.available) {
        setSetupStep("install-node");
        setStatusMessage(t("setup.installingNode"));
        setProgress(25);
        await installNode();
      }

      setProgress(40);
      setStatusMessage(t("setup.checkingOpenclaw"));

      const oclawStatus = await checkOpenclaw();

      if (!oclawStatus.installed) {
        setSetupStep("install-openclaw");
        setStatusMessage(t("setup.installingOpenclaw"));
        setProgress(50);
        await installOpenclaw();
      }

      setProgress(70);
      setStatusMessage(t("setup.startingGateway"));

      await startGateway();
      setGatewayRunning(true);

      setProgress(85);
      setStatusMessage(t("setup.waitingGateway"));
      await new Promise((r) => setTimeout(r, 2000));

      setProgress(100);
      setStatusMessage(t("setup.ready"));
      setSetupStep("ready");

      await new Promise((r) => setTimeout(r, 500));
      setSetupComplete(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSetupError(message);
      setSetupStep("error");
      setStatusMessage(t("setup.error", { message }));
    }
  }

  async function runDockerSetup() {
    try {
      setSetupStep("checking");
      setStatusMessage(t("setup.pullingImage"));
      setProgress(10);

      await pullOpenclawImage("latest");

      setProgress(50);
      setStatusMessage(t("setup.startingContainer"));

      await startDockerGateway();
      setGatewayRunning(true);

      setProgress(90);
      setStatusMessage(t("setup.waitingGateway"));
      await new Promise((r) => setTimeout(r, 1000));

      setProgress(100);
      setStatusMessage(t("setup.ready"));
      setSetupStep("ready");

      await new Promise((r) => setTimeout(r, 500));
      setSetupComplete(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSetupError(message);
      setSetupStep("error");
      setStatusMessage(t("setup.error", { message }));
    }
  }

  const dockerAvailable = dockerStatus?.available && dockerStatus?.daemon_running;

  // Show mode selection screen
  if (setupStep === "choosing-mode") {
    return (
      <div className="flex flex-col h-screen">
        <TitleBar />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <h1 className="text-3xl font-bold">{t("setup.title")}</h1>
          <p className="text-[var(--color-text-muted)] text-center max-w-md">
            {t("setup.chooseMode")}
          </p>

          <div className="flex gap-4 w-full max-w-xl">
            {/* Native Install Card */}
            <button
              onClick={() => handleSelectMode("native")}
              className="flex-1 p-5 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-hover)] transition-all text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Monitor size={20} />
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  {t("setup.modeNative")}
                </h3>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                {t("setup.modeNativeDesc")}
              </p>
            </button>

            {/* Docker Install Card */}
            <div className="flex-1 relative">
              <button
                onClick={() => dockerAvailable && handleSelectMode("docker")}
                disabled={!dockerAvailable}
                className={`w-full h-full p-5 rounded-xl border-2 text-left transition-all ${
                  dockerAvailable
                    ? "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${dockerAvailable ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-500"}`}>
                    <Container size={20} />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--color-text)]">
                    {t("setup.modeDocker")}
                  </h3>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-3">
                  {t("setup.modeDockerDesc")}
                </p>

                {/* Docker status indicator */}
                {checkingDocker ? (
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <RefreshCw size={12} className="animate-spin" />
                    {t("setup.checkingDocker")}
                  </div>
                ) : dockerAvailable ? (
                  <div className="flex items-center gap-2 text-xs text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    {t("setup.dockerDetected", { version: dockerStatus?.version ?? "" })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-[var(--color-error)]">
                      <span className="w-2 h-2 rounded-full bg-[var(--color-error)]" />
                      {dockerStatus?.available && !dockerStatus?.daemon_running
                        ? t("setup.dockerNotRunning")
                        : t("setup.dockerNotDetected")}
                    </div>
                  </div>
                )}
              </button>

              {/* Actions below the card when Docker not available */}
              {!checkingDocker && !dockerAvailable && (
                <div className="flex items-center gap-3 mt-2 px-1">
                  <button
                    onClick={() => openUrl("https://www.docker.com/products/docker-desktop/")}
                    className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                  >
                    <ExternalLink size={11} />
                    {t("setup.dockerDownload")}
                  </button>
                  <button
                    onClick={detectDocker}
                    className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  >
                    <RefreshCw size={11} />
                    {t("setup.dockerRefresh")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show progress screen (shared by both modes)
  return (
    <div className="flex flex-col h-screen">
      <TitleBar />
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
        <h1 className="text-3xl font-bold">{t("setup.title")}</h1>
        <p className="text-[var(--color-text-muted)] text-center max-w-md">
          {t("setup.subtitle")}
        </p>

        <div className="w-full max-w-sm">
          {/* Progress bar */}
          <div className="w-full h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-3 text-center">
            {statusMessage}
          </p>
        </div>

        {setupStep === "error" && setupError && (
          <div className="mt-4 w-full max-w-sm">
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4">
              <p className="text-red-400 text-sm">{setupError}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    setSetupError(null);
                    setProgress(0);
                    if (installMode === "native") {
                      runNativeSetup();
                    } else {
                      runDockerSetup();
                    }
                  }}
                  className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg text-sm transition-colors"
                >
                  {t("common.retry")}
                </button>
                <button
                  onClick={() => {
                    setSetupError(null);
                    setProgress(0);
                    setSetupStep("choosing-mode");
                  }}
                  className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-lg text-sm transition-colors"
                >
                  {t("setup.backToModeSelection")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
