import { create } from "zustand";
import { gateway } from "../api/gateway-client";
import { getPlatformInfo } from "../api/tauri-commands";

export interface ContentBlock {
  type: "text" | "toolCall" | "toolResult";
  text?: string;
  toolName?: string;
  toolCallId?: string;
  args?: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  contentBlocks?: ContentBlock[];
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

export interface ToolActivity {
  name: string;
  phase: "start" | "partial" | "result";
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
  toolActivity: ToolActivity | null;

  setAgents: (agents: Agent[]) => void;
  selectAgent: (agentId: string) => void;
  addMessage: (msg: ChatMessage) => void;
  updateStreamingMessage: (content: string) => void;
  addStreamingToolCall: (tool: { name: string; toolCallId: string; args?: Record<string, unknown> }) => void;
  updateStreamingToolResult: (toolCallId: string, result: string, isError: boolean) => void;
  appendStreamingText: (text: string) => void;
  finalizeStreaming: () => void;
  finalizeWithContent: (message: {
    content?: Array<{ type: string; text?: string; id?: string; name?: string; arguments?: Record<string, unknown> }> | string;
  }) => void;
  clearMessages: () => void;
  setStreaming: (v: boolean) => void;
  setSessionKey: (key: string | null) => void;
  setCurrentRunId: (id: string | null) => void;
  setSidebarTab: (tab: "agents" | "chats") => void;
  setToolActivity: (activity: ToolActivity | null) => void;

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
  toolActivity: null,

  setAgents: (agents) => set({ agents }),
  selectAgent: (agentId) => {
    const sessionKey = `agent:${agentId}:main`;
    set({ selectedAgentId: agentId, messages: [], sessionKey, sidebarTab: "chats" });
    // Load previous session history and sessions for this agent
    void get().loadHistory(sessionKey);
    void get().loadSessions();
  },
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateStreamingMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.streaming) {
        // If message has tool blocks, don't overwrite with chat delta's concatenated text
        if (last.contentBlocks?.some((b) => b.type === "toolCall")) {
          return { messages: msgs };
        }
        msgs[msgs.length - 1] = { ...last, content };
      }
      return { messages: msgs };
    }),
  addStreamingToolCall: (tool) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (!last?.streaming) return { messages: msgs };

      const updated = { ...last };
      if (!updated.contentBlocks) {
        updated.contentBlocks = [];
        // Snapshot existing text as a text block
        if (updated.content.trim()) {
          updated.contentBlocks.push({ type: "text", text: updated.content });
        }
      }
      updated.contentBlocks = [
        ...updated.contentBlocks,
        {
          type: "toolCall" as const,
          toolName: tool.name,
          toolCallId: tool.toolCallId,
          args: tool.args,
        },
      ];
      msgs[msgs.length - 1] = updated;
      return { messages: msgs };
    }),
  updateStreamingToolResult: (toolCallId, result, isError) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (!last?.streaming || !last.contentBlocks) return { messages: msgs };

      const updated = { ...last };
      updated.contentBlocks = (updated.contentBlocks ?? []).map((b) =>
        b.type === "toolCall" && b.toolCallId === toolCallId
          ? { ...b, result, isError }
          : b,
      );
      msgs[msgs.length - 1] = updated;
      return { messages: msgs };
    }),
  appendStreamingText: (text) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (!last?.streaming) return { messages: msgs };

      const updated = { ...last };
      // If we have content blocks (tool calls present), update/add trailing text block
      if (updated.contentBlocks?.some((b) => b.type === "toolCall")) {
        updated.contentBlocks = [...updated.contentBlocks];
        const lastBlock = updated.contentBlocks[updated.contentBlocks.length - 1];
        if (lastBlock?.type === "text") {
          // Update existing trailing text block
          updated.contentBlocks[updated.contentBlocks.length - 1] = {
            ...lastBlock,
            text,
          };
        } else {
          // Add new text block after tool blocks
          updated.contentBlocks.push({ type: "text", text });
        }
        // Also update plain content for finalization
        updated.content = updated.contentBlocks
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("");
      } else {
        // No tool blocks — just update content directly
        updated.content = text;
      }
      msgs[msgs.length - 1] = updated;
      return { messages: msgs };
    }),
  finalizeStreaming: () => {
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.streaming) {
        msgs[msgs.length - 1] = { ...last, streaming: false };
      }
      return { messages: msgs, streaming: false, currentRunId: null, toolActivity: null };
    });
    // Refresh session list so new/updated sessions appear in sidebar
    void get().loadSessions();
  },
  finalizeWithContent: (message) => {
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (!last?.streaming) {
        return { messages: msgs, streaming: false, currentRunId: null, toolActivity: null };
      }

      // Parse content blocks from the final message
      let text = "";
      const contentBlocks: ContentBlock[] = [];

      if (Array.isArray(message.content)) {
        for (const b of message.content) {
          if (b.type === "text" && b.text) {
            text += b.text;
            contentBlocks.push({ type: "text", text: b.text });
          } else if (b.type === "toolCall") {
            contentBlocks.push({
              type: "toolCall",
              toolName: b.name ?? "tool",
              toolCallId: b.id,
              args: b.arguments,
            });
          }
        }
      } else if (message.content) {
        text = String(message.content);
        if (text) contentBlocks.push({ type: "text", text });
      }

      // Merge: keep existing tool results that were streamed in real-time
      const existingBlocks = last.contentBlocks ?? [];
      const toolResultMap = new Map<string, { result?: string; isError?: boolean }>();
      for (const b of existingBlocks) {
        if (b.type === "toolCall" && b.toolCallId && b.result !== undefined) {
          toolResultMap.set(b.toolCallId, { result: b.result, isError: b.isError });
        }
      }

      // Apply streamed results to final content blocks
      for (const b of contentBlocks) {
        if (b.type === "toolCall" && b.toolCallId) {
          const streamed = toolResultMap.get(b.toolCallId);
          if (streamed) {
            b.result = streamed.result;
            b.isError = streamed.isError;
          }
        }
      }

      const hasToolBlocks = contentBlocks.some((b) => b.type === "toolCall");
      const updated: ChatMessage = {
        ...last,
        content: text || last.content,
        contentBlocks: hasToolBlocks || contentBlocks.length > 0 ? contentBlocks : last.contentBlocks,
        streaming: false,
      };

      msgs[msgs.length - 1] = updated;
      return { messages: msgs, streaming: false, currentRunId: null, toolActivity: null };
    });
    // Refresh session list
    void get().loadSessions();
  },
  clearMessages: () => set({ messages: [], sessionKey: null }),
  setStreaming: (v) => set({ streaming: v }),
  setSessionKey: (key) => set({ sessionKey: key }),
  setCurrentRunId: (id) => set({ currentRunId: id }),
  setToolActivity: (activity) => set({ toolActivity: activity }),

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
      const agentId = selectedAgentId ?? "main";
      const sessionKey = get().sessionKey ?? `agent:${agentId}:main`;

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
      const sessionKey = selectedAgentId ? `agent:${selectedAgentId}:main` : null;
      set({ agents, selectedAgentId, sessionKey });

      // Load history for the selected agent on first connect
      if (!prevSelected && sessionKey) {
        void get().loadHistory(sessionKey);
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
          role: "user" | "assistant" | "system" | "toolResult";
          content?: Array<{
            type: string;
            text?: string;
            thinking?: string;
            id?: string;
            name?: string;
            arguments?: Record<string, unknown>;
            partialJson?: string;
          }> | string;
          toolCallId?: string;
          toolName?: string;
          isError?: boolean;
          timestamp?: number;
        }>;
      }>("chat.history", { sessionKey, limit: 200 });

      // First pass: build ChatMessage list, collecting toolResult into preceding assistant
      const chatMessages: ChatMessage[] = [];
      // Map toolCallId → ContentBlock (toolCall) so we can attach results
      const toolCallMap = new Map<string, ContentBlock>();

      for (let i = 0; i < result.messages.length; i++) {
        const m = result.messages[i];

        // Skip system messages
        if (m.role === "system") continue;

        // Handle toolResult role — merge into the last assistant message
        if (m.role === "toolResult") {
          let resultText = "";
          if (typeof m.content === "string") {
            resultText = m.content;
          } else if (Array.isArray(m.content)) {
            resultText = m.content
              .filter((c) => c.type === "text" && c.text)
              .map((c) => c.text!)
              .join("");
          }

          // Try to find the matching toolCall block and attach result
          const callId = m.toolCallId ?? "";
          const existing = toolCallMap.get(callId);
          if (existing) {
            existing.result = resultText;
            existing.isError = m.isError ?? false;
          } else {
            // Orphan toolResult — attach to last assistant message as a standalone block
            const lastMsg = chatMessages[chatMessages.length - 1];
            if (lastMsg?.role === "assistant") {
              if (!lastMsg.contentBlocks) lastMsg.contentBlocks = [];
              lastMsg.contentBlocks.push({
                type: "toolResult",
                toolCallId: callId,
                toolName: m.toolName,
                result: resultText,
                isError: m.isError ?? false,
              });
            }
          }
          continue;
        }

        // Handle user and assistant messages
        let text = "";
        const contentBlocks: ContentBlock[] = [];

        if (Array.isArray(m.content)) {
          for (const b of m.content) {
            if (b.type === "text" && b.text) {
              text += b.text;
              contentBlocks.push({ type: "text", text: b.text });
            } else if (b.type === "toolCall") {
              const block: ContentBlock = {
                type: "toolCall",
                toolName: b.name ?? "tool",
                toolCallId: b.id,
                args: b.arguments,
              };
              contentBlocks.push(block);
              if (b.id) toolCallMap.set(b.id, block);
            }
            // Skip "thinking" blocks — don't render them
          }
        } else if (m.content) {
          text = String(m.content);
          if (text) contentBlocks.push({ type: "text", text });
        }

        const msg: ChatMessage = {
          id: `hist-${i}-${m.timestamp ?? Date.now()}`,
          role: m.role as "user" | "assistant",
          content: text,
          contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
          timestamp: m.timestamp ?? Date.now(),
        };

        chatMessages.push(msg);
      }

      // Filter out messages with no visible content
      const messages = chatMessages.filter(
        (m) => m.content.trim().length > 0 || (m.contentBlocks && m.contentBlocks.some(
          (b) => b.type === "toolCall" || (b.type === "text" && b.text?.trim()),
        )),
      );

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
    const scope = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const sessionKey = `agent:${agentId}:${scope}`;
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
      const agentId = selectedAgentId ?? "main";
      set({ messages: [], sessionKey: `agent:${agentId}:main`, streaming: false, currentRunId: null });
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
      // Normalize agent name to ID (matching OpenClaw's normalizeAgentId)
      const agentId = params.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "")
        .slice(0, 64) || "agent";

      // Auto-generate workspace under maxauto dir
      const platform = await getPlatformInfo();
      const workspace = `${platform.maxauto_dir}/workspace-${agentId}`;

      await gateway.request("agents.create", {
        ...params,
        workspace,
      });
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
        const nextAgent = remaining[0]?.agentId ?? null;
        set({
          selectedAgentId: nextAgent,
          messages: [],
          sessionKey: nextAgent ? `agent:${nextAgent}:main` : null,
        });
      }
      await get().loadAgents();
    } catch (err) {
      console.warn("[chat-store] deleteAgent failed:", err);
      throw err;
    }
  },
}));
