import { useEffect, useState } from "react";
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
} from "../api/tauri-commands";

export function SetupPage() {
  const { setupStep, setupError, setSetupStep, setSetupError, setSetupComplete, setGatewayRunning } =
    useAppStore();
  const [statusMessage, setStatusMessage] = useState("Checking system...");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    runSetup();
  }, []);

  async function runSetup() {
    try {
      setSetupStep("checking");
      setStatusMessage("Checking Git...");
      setProgress(5);

      const gitStatus = await checkGit();

      if (!gitStatus.available) {
        setSetupStep("install-git");
        setStatusMessage("Installing Git...");
        setProgress(10);
        await installGit();
      }

      setProgress(15);
      setStatusMessage("Checking Node.js...");

      const nodeStatus = await checkNode();

      if (!nodeStatus.available) {
        setSetupStep("install-node");
        setStatusMessage("Installing Node.js...");
        setProgress(25);
        await installNode();
      }

      setProgress(40);
      setStatusMessage("Checking OpenClaw...");

      const oclawStatus = await checkOpenclaw();

      if (!oclawStatus.installed) {
        setSetupStep("install-openclaw");
        setStatusMessage("Installing OpenClaw...");
        setProgress(50);
        await installOpenclaw();
      }

      setProgress(70);
      setStatusMessage("Starting gateway...");

      await startGateway();
      setGatewayRunning(true);

      // Wait for gateway to be ready to accept connections
      setProgress(85);
      setStatusMessage("Waiting for gateway to be ready...");
      await new Promise((r) => setTimeout(r, 2000));

      setProgress(100);
      setStatusMessage("Ready!");
      setSetupStep("ready");

      // Brief delay so user sees "Ready!" before transition
      await new Promise((r) => setTimeout(r, 500));
      setSetupComplete(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSetupError(message);
      setSetupStep("error");
      setStatusMessage(`Error: ${message}`);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <TitleBar />
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
        <h1 className="text-3xl font-bold">MaxAuto</h1>
        <p className="text-[var(--color-text-muted)] text-center max-w-md">
          Vendor-free desktop wrapper for OpenClaw. No login required.
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
              <button
                onClick={() => {
                  setSetupError(null);
                  setProgress(0);
                  runSetup();
                }}
                className="mt-3 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg text-sm transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
