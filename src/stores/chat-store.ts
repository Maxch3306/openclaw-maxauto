import { create } from "zustand";
import { gateway } from "../api/gateway-client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  streaming?: boolean;
}

export interface Agent {
  agentId: string;
  name: string;
  emoji?: string;
  avatar?: string;
  workspace?: string;
}

export interface SessionItem {
  key: string;
  title: string;
  updatedAt: number | null;
}

interface ChatState {
  messages: ChatMessage[];
  agents: Agent[];
  sessions: SessionItem[];
  selectedAgentId: string | null;
  sessionKey: string | null;
  streaming: boolean;
  currentRunId: string | null;
  sidebarTab: "agents" | "chats";

  setAgents: (agents: Agent[]) => void;
  selectAgent: (agentId: string) => void;
  addMessage: (msg: ChatMessage) => void;
  updateStreamingMessage: (content: string) => void;
  finalizeStreaming: () => void;
  clearMessages: () => void;
  setStreaming: (v: boolean) => void;
  setSessionKey: (key: string | null) => void;
  setCurrentRunId: (id: string | null) => void;
  setSidebarTab: (tab: "agents" | "chats") => void;

  // Actions
  sendMessage: (text: string) => Promise<void>;
  loadAgents: () => Promise<void>;
  loadHistory: (sessionKey: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  switchSession: (sessionKey: string) => void;
  newSession: () => void;
  deleteSession: (sessionKey: string) => Promise<void>;
  abortGeneration: () => Promise<void>;
  setAgentModel: (agentId: string, modelId: string) => Promise<void>;
  createAgent: (params: { name: string; emoji?: string; workspace?: string }) => Promise<void>;
  updateAgent: (params: { agentId: string; name?: string; emoji?: string; workspace?: string }) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
}

let idCounter = 0;
function nextId() {
  return `msg-${++idCounter}-${Date.now()}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  agents: [],
  sessions: [],
  selectedAgentId: null,
  sessionKey: null,
  streaming: false,
  currentRunId: null,
  sidebarTab: "agents",

  setAgents: (agents) => set({ agents }),
  selectAgent: (agentId) => {
    set({ selectedAgentId: agentId, messages: [], sessionKey: agentId, sidebarTab: "chats" });
    // Load previous session history and sessions for this agent
    void get().loadHistory(agentId);
    void get().loadSessions();
  },
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateStreamingMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.streaming) {
        msgs[msgs.length - 1] = { ...last, content };
      }
      return { messages: msgs };
    }),
  finalizeStreaming: () => {
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.streaming) {
        msgs[msgs.length - 1] = { ...last, streaming: false };
      }
      return { messages: msgs, streaming: false, currentRunId: null };
    });
    // Refresh session list so new/updated sessions appear in sidebar
    void get().loadSessions();
  },
  clearMessages: () => set({ messages: [], sessionKey: null }),
  setStreaming: (v) => set({ streaming: v }),
  setSessionKey: (key) => set({ sessionKey: key }),
  setCurrentRunId: (id) => set({ currentRunId: id }),

  sendMessage: async (text) => {
    const { selectedAgentId } = get();
    if (!text.trim() || !gateway.connected) {
      return;
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, userMsg] }));

    // Create streaming placeholder
    const assistantMsg: ChatMessage = {
      id: nextId(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      streaming: true,
    };
    set((s) => ({
      messages: [...s.messages, assistantMsg],
      streaming: true,
    }));

    try {
      // Use stored sessionKey (supports new sessions with unique keys)
      const sessionKey = get().sessionKey ?? selectedAgentId ?? "main";

      const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      console.log("[chat] sendMessage:", { sessionKey, idempotencyKey, textLen: text.length });

      const result = await gateway.request("chat.send", {
        sessionKey,
        message: text,
        idempotencyKey,
      });

      console.log("[chat] chat.send response:", result);
    } catch (err) {
      // If send fails, update the streaming message with error
      set((s) => {
        const msgs = [...s.messages];
        const last = msgs[msgs.length - 1];
        if (last?.streaming) {
          msgs[msgs.length - 1] = {
            ...last,
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
            streaming: false,
          };
        }
        return { messages: msgs, streaming: false };
      });
    }
  },

  loadAgents: async () => {
    try {
      const result = await gateway.request<{
        defaultId: string;
        agents: Array<{
          id?: string;
          agentId?: string;
          name?: string;
          emoji?: string;
          avatar?: string;
          workspace?: string;
        }>;
      }>("agents.list", {});
      const agents: Agent[] = result.agents.map((a) => ({
        agentId: a.agentId ?? a.id ?? "unknown",
        name: a.name ?? a.agentId ?? a.id ?? "Agent",
        emoji: a.emoji,
        avatar: a.avatar,
        workspace: a.workspace,
      }));
      const prevSelected = get().selectedAgentId;
      const selectedAgentId = prevSelected ?? result.defaultId;
      set({ agents, selectedAgentId, sessionKey: selectedAgentId });

      // Load history for the selected agent on first connect
      if (!prevSelected && selectedAgentId) {
        void get().loadHistory(selectedAgentId);
        void get().loadSessions();
      }
    } catch (err) {
      console.warn("[chat-store] loadAgents failed:", err);
    }
  },

  loadHistory: async (sessionKey) => {
    try {
      const result = await gateway.request<{
        sessionKey: string;
        messages: Array<{
          role: "user" | "assistant" | "system";
          content: Array<{ type: string; text?: string }> | string;
          timestamp?: number;
        }>;
      }>("chat.history", { sessionKey, limit: 200 });

      const messages: ChatMessage[] = result.messages
        .map((m, i) => {
          let text = "";
          if (Array.isArray(m.content)) {
            text = m.content
              .filter((b) => b.type === "text" && b.text)
              .map((b) => b.text!)
              .join("");
          } else {
            text = String(m.content ?? "");
          }
          return {
            id: `hist-${i}-${m.timestamp ?? Date.now()}`,
            role: m.role,
            content: text,
            timestamp: m.timestamp ?? Date.now(),
          };
        })
        .filter((m) => m.content.trim().length > 0); // skip empty messages

      // Only set if we're still on the same session
      if (get().sessionKey === sessionKey) {
        set({ messages });
      }
      console.log("[chat-store] loadHistory: loaded", messages.length, "messages for", sessionKey);
    } catch (err) {
      console.warn("[chat-store] loadHistory failed:", err);
    }
  },

  loadSessions: async () => {
    try {
      const { selectedAgentId } = get();
      const result = await gateway.request<{
        sessions: Array<{
          key: string;
          derivedTitle?: string;
          displayName?: string;
          label?: string;
          lastMessagePreview?: string;
          updatedAt?: number | null;
        }>;
      }>("sessions.list", {
        limit: 50,
        includeLastMessage: true,
        ...(selectedAgentId ? { agentId: selectedAgentId } : {}),
      });

      const sessions: SessionItem[] = result.sessions
        .filter((s) => s.updatedAt) // skip empty sessions
        .map((s) => {
          // Use last message preview as session title — most reliable
          let title = "";

          // Try lastMessagePreview first (actual message content)
          if (s.lastMessagePreview) {
            title = s.lastMessagePreview.trim();
          }

          // Fall back to label
          if (!title && s.label) {
            title = s.label;
          }

          // Fall back to cleaned session key
          if (!title) {
            // key is like "agent:main:main" or "agent:main:main-1234-xxxx"
            const parts = s.key.split(":");
            title = parts[parts.length - 1] || s.key;
          }

          // Truncate
          if (title.length > 50) {
            title = title.slice(0, 50) + "...";
          }

          return {
            key: s.key,
            title,
            updatedAt: s.updatedAt ?? null,
          };
        })
        .sort((a: { updatedAt: number | null }, b: { updatedAt: number | null }) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

      set({ sessions });
      console.log("[chat-store] loadSessions: loaded", sessions.length, "sessions");
    } catch (err) {
      console.warn("[chat-store] loadSessions failed:", err);
    }
  },

  switchSession: (sessionKey) => {
    set({ sessionKey, messages: [], streaming: false, currentRunId: null });
    void get().loadHistory(sessionKey);
  },

  newSession: () => {
    const { selectedAgentId } = get();
    const agentId = selectedAgentId ?? "main";
    const sessionKey = `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set({ messages: [], sessionKey, streaming: false, currentRunId: null });
    console.log("[chat-store] newSession:", sessionKey);
  },

  deleteSession: async (sessionKey) => {
    try {
      await gateway.request("sessions.delete", { key: sessionKey });
    } catch (err) {
      console.warn("[chat-store] deleteSession gateway call failed, removing locally:", err);
    }
    // Remove from local list
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.key !== sessionKey),
    }));
    // If we deleted the active session, clear the chat
    if (get().sessionKey === sessionKey) {
      const { selectedAgentId } = get();
      set({ messages: [], sessionKey: selectedAgentId, streaming: false, currentRunId: null });
    }
  },

  abortGeneration: async () => {
    const { sessionKey, currentRunId } = get();
    if (!sessionKey) {
      return;
    }
    try {
      await gateway.request("chat.abort", { sessionKey, runId: currentRunId });
    } catch {
      // ignore
    }
    get().finalizeStreaming();
  },

  setAgentModel: async (_agentId, modelId) => {
    try {
      // Set the default model for all agents via config
      const fullConfig = await gateway.request<{
        config: Record<string, unknown>;
        hash: string;
      }>("config.get", {});
      const cfg = fullConfig.config as {
        agents?: { defaults?: Record<string, unknown>; [k: string]: unknown };
        [k: string]: unknown;
      };
      const agents = {
        ...cfg.agents,
        defaults: {
          ...cfg.agents?.defaults,
          model: modelId,
        },
      };
      const newConfig = { ...fullConfig.config, agents };
      await gateway.request("config.set", {
        baseHash: fullConfig.hash,
        raw: JSON.stringify(newConfig, null, 2),
      });
      console.log("[chat-store] setAgentModel: set agents.defaults.model =", modelId);
    } catch (err) {
      console.warn("[chat-store] setAgentModel failed:", err);
    }
  },

  createAgent: async (params) => {
    try {
      await gateway.request("agents.create", params);
      await get().loadAgents();
    } catch (err) {
      console.warn("[chat-store] createAgent failed:", err);
      throw err;
    }
  },

  updateAgent: async (params) => {
    try {
      await gateway.request("agents.update", params);
      await get().loadAgents();
    } catch (err) {
      console.warn("[chat-store] updateAgent failed:", err);
      throw err;
    }
  },

  deleteAgent: async (agentId) => {
    try {
      await gateway.request("agents.delete", { agentId });
      if (get().selectedAgentId === agentId) {
        const remaining = get().agents.filter((a) => a.agentId !== agentId);
        set({
          selectedAgentId: remaining[0]?.agentId ?? null,
          messages: [],
          sessionKey: remaining[0]?.agentId ?? null,
        });
      }
      await get().loadAgents();
    } catch (err) {
      console.warn("[chat-store] deleteAgent failed:", err);
      throw err;
    }
  },
}));
