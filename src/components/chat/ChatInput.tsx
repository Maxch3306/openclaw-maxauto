import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../stores/chat-store";
import { useSettingsStore } from "../../stores/settings-store";

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

  // Only show models from configured providers
  const availableModels = models.filter((m) => configuredProviders.has(m.provider));

  const [selectedModelId, setSelectedModelId] = useState("");

  // Set initial model: use default from config, or first available
  useEffect(() => {
    if (availableModels.length > 0 && !selectedModelId) {
      if (defaultModelId) {
        // Check if default model is in available models
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
    <div className="border-t border-[var(--color-border)] p-3 bg-[var(--color-surface)]">
      {/* Model selector row */}
      {availableModels.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs text-[var(--color-text-muted)] shrink-0">{t("chat.model")}</label>
          <select
            value={selectedModelId}
            onChange={(e) => handleModelChange(e.target.value)}
            className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] max-w-xs truncate"
          >
            {availableModels.map((m) => (
              <option key={`${m.provider}/${m.id}`} value={`${m.provider}/${m.id}`}>
                {m.name || m.id} ({m.provider})
              </option>
            ))}
          </select>
        </div>
      )}
      {/* Input row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={t("chat.typeMessage")}
          rows={1}
          className="flex-1 resize-none bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] overflow-hidden"
        />
        <button
          onClick={handleSubmit}
          className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
            streaming
              ? "bg-red-600 hover:bg-red-700"
              : "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]"
          }`}
        >
          {streaming ? t("chat.stop") : t("chat.send")}
        </button>
      </div>
    </div>
  );
}
