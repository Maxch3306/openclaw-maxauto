import { Plus, ArrowUp, Square, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "@/stores/chat-store";
import { useSettingsStore } from "@/stores/settings-store";
import { Button } from "@/components/ui/button";

export function ChatInput() {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const streaming = useChatStore((s) => s.streaming);
  const abortGeneration = useChatStore((s) => s.abortGeneration);
  const selectedAgentId = useChatStore((s) => s.selectedAgentId);
  const setAgentModel = useChatStore((s) => s.setAgentModel);

  const models = useSettingsStore((s) => s.models);
  const configuredProviders = useSettingsStore((s) => s.configuredProviders);
  const defaultModelId = useSettingsStore((s) => s.defaultModelId);

  const availableModels = models.filter((m) => configuredProviders.has(m.provider));

  const [selectedModelId, setSelectedModelId] = useState("");

  useEffect(() => {
    if (availableModels.length > 0 && !selectedModelId) {
      if (defaultModelId) {
        const match = availableModels.find((m) => `${m.provider}/${m.id}` === defaultModelId);
        if (match) {
          setSelectedModelId(defaultModelId);
          return;
        }
      }
      const first = availableModels[0];
      setSelectedModelId(`${first.provider}/${first.id}`);
    }
  }, [availableModels.length, defaultModelId]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    if (selectedAgentId) {
      void setAgentModel(selectedAgentId, modelId);
    }
  };

  function handleSubmit() {
    if (streaming) {
      void abortGeneration();
      return;
    }
    if (!text.trim()) {
      return;
    }
    void sendMessage(text.trim());
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }

  return (
    <div className="px-4 pb-3 pt-1">
      {/* Main input container */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {/* Textarea area */}
        <div className="relative px-4 pt-3 pb-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={t("chat.typeMessage")}
            rows={1}
            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none overflow-hidden min-h-[24px]"
          />
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-3 pb-2.5">
          <div className="flex items-center gap-1">
            {/* Attach button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <Plus size={16} />
            </Button>

            {/* Model selector */}
            {availableModels.length > 0 && (
              <div className="relative">
                <select
                  value={selectedModelId}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="appearance-none bg-transparent text-xs text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none pr-4 pl-2 py-1 rounded-md hover:bg-secondary transition-colors"
                >
                  {availableModels.map((m) => (
                    <option key={`${m.provider}/${m.id}`} value={`${m.provider}/${m.id}`}>
                      {m.name || m.id}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={10}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
              </div>
            )}
          </div>

          {/* Send / Stop button */}
          <Button
            onClick={handleSubmit}
            size="icon"
            variant={streaming ? "destructive" : "default"}
            className="h-8 w-8 rounded-full"
          >
            {streaming ? <Square size={14} /> : <ArrowUp size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
