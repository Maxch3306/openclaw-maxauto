import { ChevronDown, ChevronUp, Zap } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../stores/chat-store";
import { useSettingsStore, BAILIAN_CODING_PRESET, BAILIAN_CODING_PROVIDER_KEY } from "../../stores/settings-store";

const DEFAULT_BASE_URL = BAILIAN_CODING_PRESET.baseUrl;

interface Props {
  isConfigured: boolean;
}

export function BailianCodingQuickSetup({ isConfigured }: Props) {
  const { t } = useTranslation();
  const addQuickProvider = useSettingsStore((s) => s.addQuickProvider);
  const removeQuickProvider = useSettingsStore((s) => s.removeQuickProvider);
  const defaultModelId = useSettingsStore((s) => s.defaultModelId);
  const setDefaultModelId = useSettingsStore((s) => s.setDefaultModelId);
  const setAgentModel = useChatStore((s) => s.setAgentModel);

  const [expanded, setExpanded] = useState(!isConfigured);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_BASE_URL);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!apiKey.trim()) {
      setError("API Key is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addQuickProvider(apiKey.trim(), baseUrl.trim() || undefined);
      setApiKey("");
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError("");
    try {
      await removeQuickProvider();
    } catch (err) {
      setError(String(err));
    } finally {
      setRemoving(false);
    }
  };

  const modelCount = BAILIAN_CODING_PRESET.models.length;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={14} className="text-[var(--color-warning)]" />
        <h2 className="text-sm font-medium text-[var(--color-text-muted)]">{t("settings.models.quickSetup")}</h2>
      </div>

      <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        {/* Header row */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--color-text)]">
              {t("settings.bailian.title")}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {t("settings.bailian.modelCount", { count: modelCount })}
            </span>
            {isConfigured && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-success)]/20 text-[var(--color-success)]">
                {t("settings.bailian.configured")}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronUp size={14} className="text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
          )}
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-[var(--color-border)] px-4 py-3 space-y-3">
            <p className="text-xs text-[var(--color-text-muted)]">
              {t("settings.bailian.description")}
            </p>

            {/* Model list */}
            {isConfigured ? (
              <div className="space-y-1">
                {BAILIAN_CODING_PRESET.models.map((m) => {
                  const qualifiedId = `${BAILIAN_CODING_PROVIDER_KEY}/${m.id}`;
                  const isDefault = defaultModelId === qualifiedId;
                  return (
                    <div key={m.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {m.name}
                        </span>
                        {m.input.map((type) => (
                          <span
                            key={type}
                            className="text-[10px] px-1 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isDefault ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-success)]/20 text-[var(--color-success)]">
                            {t("common.default")}
                          </span>
                        ) : (
                          <button
                            onClick={async () => {
                              await setAgentModel("main", qualifiedId);
                              setDefaultModelId(qualifiedId);
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors"
                          >
                            {t("settings.models.setDefault")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {BAILIAN_CODING_PRESET.models.map((m) => (
                  <span
                    key={m.id}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
                  >
                    {m.name}
                  </span>
                ))}
              </div>
            )}

            {isConfigured ? (
              <div className="space-y-2 pt-1">
                {confirmRemove ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/30">
                    <span className="text-xs text-[var(--color-error)]">
                      {t("settings.bailian.removeConfirm")}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConfirmRemove(false)}
                        disabled={removing}
                        className="text-xs px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        onClick={handleRemove}
                        disabled={removing}
                        className="text-xs px-2 py-1 rounded bg-[var(--color-error)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {removing ? t("common.removing") : t("common.confirm")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-success)]">
                      {t("settings.bailian.providerActive")}
                    </span>
                    <button
                      onClick={() => setConfirmRemove(true)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-error)]/30 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
                    >
                      {t("common.remove")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">
                    {t("settings.bailian.apiKey")}
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setError("");
                      }}
                      placeholder={t("settings.bailian.enterKey")}
                      className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)] pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs"
                    >
                      {showKey ? t("common.hide") : t("common.show")}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">
                    {t("settings.bailian.baseUrl")}
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={DEFAULT_BASE_URL}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="w-full py-2 text-sm rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? t("settings.bailian.settingUp") : t("settings.bailian.setup")}
                </button>
              </>
            )}

            {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
