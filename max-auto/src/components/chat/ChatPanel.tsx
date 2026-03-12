import { Shell, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAppStore } from "../../stores/app-store";
import { useChatStore, type ChatMessage as ChatMsg } from "../../stores/chat-store";
import { useSettingsStore } from "../../stores/settings-store";
import { AddModelDialog } from "../settings/AddModelDialog";
import { ChatInput } from "./ChatInput";

function ChatMessage({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[var(--color-accent)] text-white"
            : "bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]"
        }`}
      >
        {msg.content || (msg.streaming ? <TypingIndicator /> : "")}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1 px-1">
      <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

function WelcomeScreen() {
  const models = useSettingsStore((s) => s.models);
  const configuredProviders = useSettingsStore((s) => s.configuredProviders);
  const showAddDialog = useSettingsStore((s) => s.showAddModelDialog);
  const setShowAddDialog = useSettingsStore((s) => s.setShowAddModelDialog);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const setActiveSection = useSettingsStore((s) => s.setActiveSection);

  const hasProvider = configuredProviders.size > 0;

  const goToModelSettings = () => {
    setActiveSection("models");
    setCurrentPage("settings");
  };

  // Count available models from configured providers
  const availableModels = models.filter((m) => configuredProviders.has(m.provider));
  const providerCount = configuredProviders.size;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      {/* Branding */}
      <div className="flex flex-col items-center text-center">
        <Shell size={40} className="text-[var(--color-accent)] mb-3" />
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Max-Auto</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-md">
          Describe your goal, and Max-Auto will execute step by step with real-time feedback
        </p>
      </div>

      {/* When providers are configured: show provider summary + quick setup */}
      {hasProvider && (
        <div className="flex flex-col items-center gap-3 w-80">
          <button
            onClick={goToModelSettings}
            className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Configured Providers</p>
                <p className="text-sm font-medium text-[var(--color-text)] mt-0.5">
                  {providerCount} provider{providerCount !== 1 ? "s" : ""} ·{" "}
                  {availableModels.length} model{availableModels.length !== 1 ? "s" : ""}
                </p>
              </div>
              <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
            </div>
          </button>
        </div>
      )}

      {/* When no providers: show setup prompt */}
      {!hasProvider && (
        <button
          onClick={() => setShowAddDialog(true)}
          className="w-80 p-4 rounded-xl bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 hover:border-[var(--color-warning)] transition-colors text-left group"
        >
          <h3 className="text-sm font-medium text-[var(--color-warning)]">Set up a Provider</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            No provider configured yet. Add a provider with an API key to start chatting.
          </p>
        </button>
      )}

      {showAddDialog && <AddModelDialog />}
    </div>
  );
}

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const selectedAgentId = useChatStore((s) => s.selectedAgentId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!selectedAgentId) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
        <p>Select an agent to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && <WelcomeScreen />}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} msg={msg} />
        ))}
      </div>
      <ChatInput />
    </div>
  );
}
