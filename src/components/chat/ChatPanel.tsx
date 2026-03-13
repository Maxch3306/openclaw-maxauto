import { Shell, ChevronRight, ChevronDown, FileText, Terminal, Pencil, Search, Globe, Code2, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../stores/app-store";
import { useChatStore, type ChatMessage as ChatMsg, type ContentBlock } from "../../stores/chat-store";
import { useSettingsStore } from "../../stores/settings-store";
import { AddModelDialog } from "../settings/AddModelDialog";
import { ChatInput } from "./ChatInput";

const TOOL_LABELS: Record<string, string> = {
  thinking: "Agent is working",
  exec: "Running command",
  read: "Reading file",
  write: "Writing file",
  edit: "Editing file",
  search: "Searching",
  grep: "Searching code",
  glob: "Finding files",
  bash: "Running command",
  browser: "Browsing web",
  fetch: "Fetching URL",
};

function ToolActivityIndicator() {
  const toolActivity = useChatStore((s) => s.toolActivity);
  if (!toolActivity) return null;

  const label = TOOL_LABELS[toolActivity.name] ?? `Using ${toolActivity.name}`;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-[var(--color-text-muted)] animate-pulse">
      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>{label}</span>
      {toolActivity.phase === "partial" && <span className="opacity-50">...</span>}
    </div>
  );
}

const TOOL_ICONS: Record<string, typeof Wrench> = {
  read: FileText,
  write: Pencil,
  edit: Pencil,
  bash: Terminal,
  exec: Terminal,
  search: Search,
  grep: Code2,
  glob: Search,
  browser: Globe,
  fetch: Globe,
};

function getToolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

function ToolCallCard({ block }: { block: ContentBlock }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = block.toolName ?? "tool";
  const Icon = TOOL_ICONS[toolName] ?? Wrench;
  const hasResult = block.result !== undefined;
  const isError = block.isError;

  // Extract a short summary from args (e.g. file_path)
  let summary = "";
  if (block.args) {
    const fp = block.args.file_path ?? block.args.filePath ?? block.args.path ?? block.args.command;
    if (typeof fp === "string") {
      // Show just the filename or last part
      const parts = fp.replace(/\\/g, "/").split("/");
      summary = parts[parts.length - 1] || fp;
      if (summary.length > 40) summary = "..." + summary.slice(-37);
    }
  }

  return (
    <div className="my-1.5 rounded-lg border border-[var(--color-border)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <Icon size={14} className={`shrink-0 ${isError ? "text-[var(--color-error)]" : "text-[var(--color-accent)]"}`} />
        <span className="text-xs font-medium text-[var(--color-text)]">
          {getToolLabel(toolName)}
        </span>
        {summary && (
          <span className="text-xs text-[var(--color-text-muted)] truncate">
            {summary}
          </span>
        )}
        {hasResult && (
          <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${
            isError
              ? "bg-[var(--color-error)]/15 text-[var(--color-error)]"
              : "bg-[var(--color-success)]/15 text-[var(--color-success)]"
          }`}>
            {isError ? "error" : "done"}
          </span>
        )}
        {!hasResult && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-warning)]/15 text-[var(--color-warning)]">
            pending
          </span>
        )}
        <span className="shrink-0 text-[var(--color-text-muted)]">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-[var(--color-border)] bg-black/20 text-[11px] font-mono space-y-2 max-h-60 overflow-y-auto">
          {block.args && (
            <div>
              <div className="text-[var(--color-text-muted)] mb-0.5">Arguments:</div>
              <pre className="text-[var(--color-text)] whitespace-pre-wrap break-all">
                {JSON.stringify(block.args, null, 2)}
              </pre>
            </div>
          )}
          {hasResult && (
            <div>
              <div className="text-[var(--color-text-muted)] mb-0.5">Result:</div>
              <pre className={`whitespace-pre-wrap break-all ${isError ? "text-[var(--color-error)]" : "text-[var(--color-text)]"}`}>
                {block.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChatMessage({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  const blocks = msg.contentBlocks;
  const hasToolBlocks = blocks?.some((b) => b.type === "toolCall");

  // If message has structured content blocks with tool calls, render them
  if (!isUser && blocks && hasToolBlocks) {
    return (
      <div className="flex justify-start mb-3">
        <div className="max-w-[80%] w-full">
          {blocks.map((block, i) => {
            if (block.type === "text" && block.text?.trim()) {
              return (
                <div
                  key={i}
                  className="rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] mb-1.5"
                >
                  {block.text}
                </div>
              );
            }
            if (block.type === "toolCall") {
              return <ToolCallCard key={i} block={block} />;
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  // Default: simple text bubble
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
      <ToolActivityIndicator />
      <ChatInput />
    </div>
  );
}
