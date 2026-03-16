import { Shell, ChevronRight, ChevronDown, FileText, Terminal, Pencil, Search, Globe, Code2, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/app-store";
import { useChatStore, type ChatMessage as ChatMsg, type ContentBlock } from "@/stores/chat-store";
import { useSettingsStore } from "@/stores/settings-store";
import { AddModelDialog } from "@/components/settings/AddModelDialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChatInput } from "./ChatInput";

const TOOL_LABEL_KEYS: Record<string, string> = {
  thinking: "tools.thinking",
  exec: "tools.exec",
  read: "tools.read",
  write: "tools.write",
  edit: "tools.edit",
  search: "tools.search",
  grep: "tools.grep",
  glob: "tools.glob",
  bash: "tools.bash",
  browser: "tools.browser",
  fetch: "tools.fetch",
};

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

function ToolActivityIndicator() {
  const { t } = useTranslation();
  const toolActivity = useChatStore((s) => s.toolActivity);
  if (!toolActivity) return null;

  const label = TOOL_LABEL_KEYS[toolActivity.name]
    ? t(TOOL_LABEL_KEYS[toolActivity.name])
    : t("tools.using", { name: toolActivity.name });

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground animate-pulse">
      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>{label}</span>
      {toolActivity.phase === "partial" && <span className="opacity-50">...</span>}
    </div>
  );
}

function ToolCallCard({ block }: { block: ContentBlock }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const toolName = block.toolName ?? "tool";
  const Icon = TOOL_ICONS[toolName] ?? Wrench;
  const hasResult = block.result !== undefined;
  const isError = block.isError;

  const toolLabel = TOOL_LABEL_KEYS[toolName]
    ? t(TOOL_LABEL_KEYS[toolName])
    : t("tools.using", { name: toolName });

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
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="my-1.5 rounded-lg border border-border overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary transition-colors"
          >
            <Icon size={14} className={`shrink-0 ${isError ? "text-destructive" : "text-primary"}`} />
            <span className="text-xs font-medium text-foreground">
              {toolLabel}
            </span>
            {summary && (
              <span className="text-xs text-muted-foreground truncate">
                {summary}
              </span>
            )}
            {hasResult && (
              <Badge
                variant={isError ? "destructive" : "success"}
                className="ml-auto text-[10px] px-1.5 py-0.5"
              >
                {isError ? t("common.error") : t("common.done")}
              </Badge>
            )}
            {!hasResult && (
              <Badge
                variant="warning"
                className="ml-auto text-[10px] px-1.5 py-0.5"
              >
                {t("common.pending")}
              </Badge>
            )}
            <span className="shrink-0 text-muted-foreground">
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 py-2 border-t border-border bg-black/20 text-[11px] font-mono space-y-2 max-h-60 overflow-y-auto">
            {block.args && (
              <div>
                <div className="text-muted-foreground mb-0.5">{t("chat.arguments")}</div>
                <pre className="text-foreground whitespace-pre-wrap break-all">
                  {JSON.stringify(block.args, null, 2)}
                </pre>
              </div>
            )}
            {hasResult && (
              <div>
                <div className="text-muted-foreground mb-0.5">{t("chat.result")}</div>
                <pre className={`whitespace-pre-wrap break-all ${isError ? "text-destructive" : "text-foreground"}`}>
                  {block.result}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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
                  className="rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-card text-foreground border border-border mb-1.5"
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
            ? "bg-primary text-primary-foreground"
            : "bg-card text-foreground border border-border"
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
      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

function WelcomeScreen() {
  const { t } = useTranslation();
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
        <Shell size={40} className="text-primary mb-3" />
        <h1 className="text-xl font-semibold text-foreground">{t("chat.welcome.title")}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          {t("chat.welcome.subtitle")}
        </p>
      </div>

      {/* When providers are configured: show provider summary + quick setup */}
      {hasProvider && (
        <div className="flex flex-col items-center gap-3 w-80">
          <button
            onClick={goToModelSettings}
            className="w-full px-4 py-3 rounded-xl bg-card border border-border hover:border-primary transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t("chat.welcome.configuredProviders")}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {t("chat.welcome.providerCount", { count: providerCount })} ·{" "}
                  {t("chat.welcome.modelCount", { count: availableModels.length })}
                </p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </div>
          </button>
        </div>
      )}

      {/* When no providers: show setup prompt */}
      {!hasProvider && (
        <button
          onClick={() => setShowAddDialog(true)}
          className="w-80 p-4 rounded-xl bg-warning/10 border border-warning/30 hover:border-warning transition-colors text-left group"
        >
          <h3 className="text-sm font-medium text-warning">{t("chat.welcome.setupProvider")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("chat.welcome.noProvider")}
          </p>
        </button>
      )}

      {showAddDialog && <AddModelDialog />}
    </div>
  );
}

export function ChatPanel() {
  const { t } = useTranslation();
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
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>{t("chat.selectAgent")}</p>
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
