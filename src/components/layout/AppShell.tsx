import { useEffect } from "react";
import { gateway } from "../../api/gateway-client";
import {
  getGatewayStatus,
  getGatewayToken,
  startGateway,
} from "../../api/tauri-commands";
import { SettingsPage } from "../../pages/SettingsPage";
import { useAppStore } from "../../stores/app-store";
import { useChatStore } from "../../stores/chat-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useUpdateStore } from "../../stores/update-store";
import { ChatPanel } from "../chat/ChatPanel";
import { Sidebar } from "../chat/Sidebar";
import { GatewayStatus } from "../common/GatewayStatus";
import { UpdateBanner } from "../common/UpdateBanner";
import { QuickConfigModal } from "../settings/QuickConfigModal";

export function AppShell() {
  const port = useAppStore((s) => s.gatewayPort);
  const currentPage = useAppStore((s) => s.currentPage);
  const setGatewayConnected = useAppStore((s) => s.setGatewayConnected);
  const loadAgents = useChatStore((s) => s.loadAgents);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const loadConfig = useSettingsStore((s) => s.loadConfig);
  const loadModels = useSettingsStore((s) => s.loadModels);
  const showQuickConfig = useSettingsStore((s) => s.showQuickConfig);
  const hasProvider = useSettingsStore((s) => s.configuredProviders.size > 0);

  useEffect(() => {
    // Connect to gateway WebSocket
    gateway.setStatusCallback((connected) => {
      setGatewayConnected(connected);
      if (connected) {
        void loadAgents();
        void loadSessions();
        void loadConfig();
        void loadModels();
      }
    });

    // Ensure the gateway is running, then connect
    const ensureGatewayAndConnect = async () => {
      try {
        const status = await getGatewayStatus();
        if (!status.running) {
          await startGateway(port);
        }
      } catch {
        // Status check failed — try starting anyway
        try {
          await startGateway(port);
        } catch {
          // Will fail to connect below, which triggers retry in gateway client
        }
      }

      try {
        const token = await getGatewayToken();
        gateway.connect(port, token);
      } catch {
        gateway.connect(port);
      }
    };

    void ensureGatewayAndConnect();

    // Use health events to reload config/models and as fallback source for agents
    const unsubHealth = gateway.on("health", (payload) => {
      // Reload config & models on every health event (catches post-restart updates)
      void loadConfig();
      void loadModels();

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
        store.finalizeStreaming();
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

    // Listen for agent events (lifecycle + streaming text from retries)
    const unsubAgent = gateway.on("agent", (payload) => {
      const data = payload as {
        runId?: string;
        stream?: string;
        data?: {
          phase?: string;
          text?: string;
          delta?: string;
          error?: string;
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
        } else if (data.data?.phase === "error") {
          // Agent attempt errored — don't finalize yet, OpenClaw may retry.
          // A subsequent "start" phase means retry; if no retry comes,
          // the chat event with state "error" will be the final signal.
          // We use a delayed finalization that gets cancelled if a retry starts.
        }
      } else if (data.stream === "assistant" && data.data) {
        // Streaming text from the agent (works for retries too)
        const text = data.data.text ?? data.data.delta ?? "";
        if (text && store.streaming) {
          store.updateStreamingMessage(text);
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
  }, [port]);

  // Auto-check for updates 3s after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      void useUpdateStore.getState().checkForUpdate();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

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
    </div>
  );
}
