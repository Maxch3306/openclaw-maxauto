import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { gateway } from "@/api/gateway-client";
import { exit } from "@tauri-apps/plugin-process";
import {
  getGatewayStatus,
  getGatewayToken,
  startGateway,
  dockerGatewayStatus,
  startDockerGateway,
} from "@/api/tauri-commands";
import { SettingsPage } from "@/pages/SettingsPage";
import { useAppStore } from "@/stores/app-store";
import { useChatStore } from "@/stores/chat-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUpdateStore } from "@/stores/update-store";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Sidebar } from "@/components/chat/Sidebar";
import { GatewayStatus } from "@/components/common/GatewayStatus";
import { UpdateBanner } from "@/components/common/UpdateBanner";
import { QuickConfigModal } from "@/components/settings/QuickConfigModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function AppShell() {
  const { t } = useTranslation();
  const port = useAppStore((s) => s.gatewayPort);
  const installMode = useAppStore((s) => s.installMode);
  const currentPage = useAppStore((s) => s.currentPage);
  const setGatewayConnected = useAppStore((s) => s.setGatewayConnected);
  const loadAgents = useChatStore((s) => s.loadAgents);
  const loadConfig = useSettingsStore((s) => s.loadConfig);
  const loadModels = useSettingsStore((s) => s.loadModels);
  const showQuickConfig = useSettingsStore((s) => s.showQuickConfig);
  const hasProvider = useSettingsStore((s) => s.configuredProviders.size > 0);

  const [startupStatus, setStartupStatus] = useState("startingGateway");
  const [ready, setReady] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Listen for gateway log events from the Rust backend
  useEffect(() => {
    const unlisten = listen<string>("gateway-log", (event) => {
      setLogs((prev) => [...prev.slice(-100), event.payload]);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    // Connect to gateway WebSocket
    gateway.setStatusCallback((connected) => {
      setGatewayConnected(connected);
      if (connected) {
        setReady(true);
        // loadAgents internally triggers loadHistory + loadSessions for the selected agent
        void loadAgents();
        void loadConfig();
        void loadModels();
      }
    });

    // Ensure the gateway is running, then connect
    const ensureGatewayAndConnect = async () => {
      try {
        setStartupStatus("checkingGateway");
        if (installMode === "docker") {
          const status = await dockerGatewayStatus(port);
          if (!status.running) {
            setStartupStatus("startingGateway");
            await startDockerGateway(port);
          }
        } else {
          const status = await getGatewayStatus();
          if (!status.running) {
            setStartupStatus("startingGateway");
            await startGateway(port);
          }
        }
      } catch {
        setStartupStatus("startingGateway");
        try {
          if (installMode === "docker") {
            await startDockerGateway(port);
          } else {
            await startGateway(port);
          }
        } catch {
          setStartupStatus("waitingForGateway");
        }
      }

      setStartupStatus("connecting");
      try {
        const token = await getGatewayToken();
        gateway.connect(port, token);
      } catch {
        gateway.connect(port);
      }
    };

    void ensureGatewayAndConnect();

    // Use health events only as fallback source for agents (if initial load missed them)
    const unsubHealth = gateway.on("health", (payload) => {
      const data = payload as {
        agents?: Array<{ agentId: string; isDefault?: boolean }>;
        defaultAgentId?: string;
      };
      if (data.agents && data.agents.length > 0) {
        const store = useChatStore.getState();
        if (store.agents.length === 0) {
          store.setAgents(
            data.agents.map((a) => ({
              agentId: a.agentId,
              name: a.agentId,
            })),
          );
          if (!store.selectedAgentId && data.defaultAgentId) {
            store.selectAgent(data.defaultAgentId);
          }
        }
      }
    });

    // Timer for delayed error finalization (allows retry to cancel it)
    let errorFinalizeTimer: ReturnType<typeof setTimeout> | null = null;

    // Listen for chat streaming events
    const unsubChat = gateway.on("chat", (payload) => {
      const data = payload as {
        runId?: string;
        sessionKey?: string;
        state?: string;
        errorMessage?: string;
        message?: {
          content?: Array<{ type: string; text?: string }> | string;
        };
      };

      const store = useChatStore.getState();

      if (data.runId && !store.currentRunId) {
        store.setCurrentRunId(data.runId);
      }

      if (data.state === "delta" && data.message?.content) {
        // Extract text from content blocks array
        let text = "";
        if (Array.isArray(data.message.content)) {
          text = data.message.content
            .filter((b) => b.type === "text" && b.text)
            .map((b) => b.text!)
            .join("");
        } else {
          text = String(data.message.content);
        }
        if (text) {
          if (errorFinalizeTimer) {
            clearTimeout(errorFinalizeTimer);
            errorFinalizeTimer = null;
          }
          store.updateStreamingMessage(text);
        }
      } else if (data.state === "final" || data.state === "aborted") {
        if (errorFinalizeTimer) {
          clearTimeout(errorFinalizeTimer);
          errorFinalizeTimer = null;
        }
        // Use finalizeWithContent if the final event carries message content
        if (data.state === "final" && data.message?.content) {
          store.finalizeWithContent(data.message);
        } else {
          store.finalizeStreaming();
        }
      } else if (data.state === "error") {
        // Don't finalize immediately — OpenClaw may retry.
        // Set a delayed finalization that gets cancelled if a retry starts.
        if (errorFinalizeTimer) {
          clearTimeout(errorFinalizeTimer);
        }
        errorFinalizeTimer = setTimeout(() => {
          errorFinalizeTimer = null;
          const s = useChatStore.getState();
          if (s.streaming) {
            // Update the streaming message with the error
            s.updateStreamingMessage(data.errorMessage ?? "Request failed. Retrying...");
          }
        }, 5000);
      }
    });

    // Listen for agent events (lifecycle + streaming text from retries + tool use)
    const unsubAgent = gateway.on("agent", (payload) => {
      const data = payload as {
        runId?: string;
        stream?: string;
        data?: {
          phase?: string;
          text?: string;
          delta?: string;
          error?: string;
          name?: string;
          toolCallId?: string;
          args?: Record<string, unknown>;
          meta?: string;
          isError?: boolean;
        };
      };

      const store = useChatStore.getState();

      if (data.stream === "lifecycle") {
        if (data.data?.phase === "start") {
          // A new attempt started (possibly a retry after error).
          // Cancel any pending error finalization.
          if (errorFinalizeTimer) {
            clearTimeout(errorFinalizeTimer);
            errorFinalizeTimer = null;
          }
          // Re-enable streaming if it was not active
          if (!store.streaming) {
            store.setStreaming(true);
          }
          if (data.runId) {
            store.setCurrentRunId(data.runId);
          }
          // Show "working" indicator — agent is starting execution
          store.setToolActivity({ name: "thinking", phase: "start" });
        } else if (data.data?.phase === "end") {
          // Agent finished — clear any working indicator
          if (store.toolActivity) {
            store.setToolActivity(null);
          }
        } else if (data.data?.phase === "error") {
          // Agent attempt errored — don't finalize yet, OpenClaw may retry.
        }
      } else if (data.stream === "tool" && data.data) {
        const phase = data.data.phase as "start" | "partial" | "result";
        const toolName = data.data.name ?? "tool";
        const toolCallId = data.data.toolCallId ?? "";

        if (phase === "start") {
          // Add tool card to the streaming message
          store.addStreamingToolCall({
            name: toolName,
            toolCallId,
            args: data.data.args,
          });
          store.setToolActivity({ name: toolName, phase: "start" });
        } else if (phase === "result") {
          // Update the tool card with result
          const resultText = data.data.meta ?? "";
          store.updateStreamingToolResult(toolCallId, resultText, data.data.isError ?? false);
          // Show "thinking" again until next text or tool
          store.setToolActivity({ name: "thinking", phase: "start" });
        } else if (phase === "partial") {
          store.setToolActivity({ name: toolName, phase: "partial" });
        }
      } else if (data.stream === "assistant" && data.data) {
        // Streaming text from the agent
        const text = data.data.text ?? data.data.delta ?? "";
        if (text && store.streaming) {
          // Clear tool activity when text starts flowing
          if (store.toolActivity) {
            store.setToolActivity(null);
          }
          // Use appendStreamingText which handles content blocks properly
          store.appendStreamingText(text);
        }
      }
    });

    return () => {
      unsubHealth();
      unsubChat();
      unsubAgent();
      if (errorFinalizeTimer) {
        clearTimeout(errorFinalizeTimer);
      }
      gateway.disconnect();
    };
  }, [port, installMode]);

  // Auto-check for updates 3s after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      void useUpdateStore.getState().checkForUpdate();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Intercept window close — ask user to hide or quit
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      setShowCloseDialog(true);
    });
    return () => { void unlisten.then((fn) => fn()); };
  }, []);

  if (!ready) {
    return (
      <div className="flex flex-col h-screen items-center justify-center gap-4 px-8">
        <h1 className="text-xl font-semibold text-foreground">{t("app.title")}</h1>
        <div className="flex items-center gap-3">
          <svg
            className="animate-spin h-5 w-5 text-primary"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm text-muted-foreground">
            {t(`app.${startupStatus}`)}
          </span>
        </div>
        {logs.length > 0 && (
          <div className="w-full max-w-lg mt-2 bg-card border border-border rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs text-muted-foreground">
            {logs.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all leading-relaxed">
                {line}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <UpdateBanner />
      <div className="flex flex-1 overflow-hidden">
        {currentPage === "home" && <Sidebar />}
        <div className="flex-1 flex flex-col">
          {currentPage === "home" ? <ChatPanel /> : <SettingsPage />}
          {currentPage === "home" && <GatewayStatus />}
        </div>
      </div>
      {showQuickConfig && hasProvider && <QuickConfigModal />}

      {/* Close confirmation dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("app.closeDialog.title")}</DialogTitle>
            <DialogDescription>{t("app.closeDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                setShowCloseDialog(false);
                const appWindow = getCurrentWindow();
                await appWindow.hide();
              }}
            >
              {t("app.closeDialog.minimize")}
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => void exit(0)}
            >
              {t("app.closeDialog.quit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
