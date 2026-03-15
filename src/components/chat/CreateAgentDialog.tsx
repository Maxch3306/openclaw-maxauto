import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../stores/chat-store";

interface CreateAgentDialogProps {
  onClose: () => void;
}

export function CreateAgentDialog({ onClose }: CreateAgentDialogProps) {
  const { t } = useTranslation();
  const createAgent = useChatStore((s) => s.createAgent);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputClass =
    "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]";

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t("agent.create.nameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createAgent({
        name: name.trim(),
        emoji: emoji.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[400px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">{t("agent.create.title")}</h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">{t("agent.create.name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("agent.create.namePlaceholder")}
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">{t("agent.create.emoji")}</label>
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder={t("agent.create.emojiPlaceholder")}
              className={inputClass}
              maxLength={4}
            />
          </div>

          {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? t("agent.create.creating") : t("agent.create.title")}
          </button>
        </div>
      </div>
    </div>
  );
}
