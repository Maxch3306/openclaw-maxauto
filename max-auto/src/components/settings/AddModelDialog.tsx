import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useSettingsStore, PROVIDER_DEFAULTS } from "../../stores/settings-store";

const DEFAULT_BASE_URL = "https://coding.dashscope.aliyuncs.com/v1";
const API_PROTOCOLS = ["OpenAI", "Anthropic"];

interface ModelEntry {
  id: string;
  displayName: string;
  contextWindow: string;
  maxTokens: string;
  inputText: boolean;
  inputImage: boolean;
  reasoning: boolean;
}

const emptyEntry = (): ModelEntry => ({
  id: "",
  displayName: "",
  contextWindow: "128000",
  maxTokens: "8192",
  inputText: true,
  inputImage: false,
  reasoning: false,
});

export function AddModelDialog() {
  const setShowAddDialog = useSettingsStore((s) => s.setShowAddModelDialog);
  const addCustomModel = useSettingsStore((s) => s.addCustomModel);
  const replaceProviderModels = useSettingsStore((s) => s.replaceProviderModels);
  const setProviderAuth = useSettingsStore((s) => s.setProviderAuth);
  const editingModel = useSettingsStore((s) => s.editingModel);
  const editingProviderGroup = useSettingsStore((s) => s.editingProviderGroup);
  const models = useSettingsStore((s) => s.models);
  const configuredProviders = useSettingsStore((s) => s.configuredProviders);

  // Combine providers from models.list and PROVIDER_DEFAULTS (union of both)
  const builtInProviders = useMemo(() => {
    const keys = new Set<string>(Object.keys(PROVIDER_DEFAULTS));
    for (const m of models) {
      keys.add(m.provider);
    }
    return Array.from(keys).sort();
  }, [models]);

  const isEditing = !!editingModel;
  const isEditingProvider = !!editingProviderGroup && editingProviderGroup.length > 0;

  const [mode, setMode] = useState<"builtin" | "custom">(isEditing ? "custom" : "builtin");
  const [selectedProvider, setSelectedProvider] = useState(builtInProviders[0] ?? "");
  const [apiKey, setApiKey] = useState("");
  const [builtInBaseUrl, setBuiltInBaseUrl] = useState<string>(DEFAULT_BASE_URL);
  const [showKey, setShowKey] = useState(false);

  // When editing a provider, load ALL models from the group
  const initialEntries: ModelEntry[] = isEditingProvider
    ? editingProviderGroup.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        contextWindow: String(m.contextWindow ?? 128000),
        maxTokens: String(m.maxTokens ?? 8192),
        inputText: m.input ? m.input.includes("text") : true,
        inputImage: m.input ? m.input.includes("image") : false,
        reasoning: m.reasoning ?? false,
      }))
    : isEditing
      ? [{
          id: editingModel.id,
          displayName: editingModel.displayName,
          contextWindow: String(editingModel.contextWindow ?? 128000),
          maxTokens: String(editingModel.maxTokens ?? 8192),
          inputText: editingModel.input ? editingModel.input.includes("text") : true,
          inputImage: editingModel.input ? editingModel.input.includes("image") : false,
          reasoning: editingModel.reasoning ?? false,
        }]
      : [emptyEntry()];

  const [modelEntries, setModelEntries] = useState<ModelEntry[]>(initialEntries);
  const firstModel = isEditingProvider ? editingProviderGroup[0] : editingModel;
  const [providerName, setProviderName] = useState(firstModel?.provider ?? "");
  const [customApiKey, setCustomApiKey] = useState(firstModel?.apiKey ?? "");
  const [apiProtocol, setApiProtocol] = useState(firstModel?.apiProtocol ?? "OpenAI");
  const [baseUrl, setBaseUrl] = useState(firstModel?.baseUrl ?? "");
  const [showCustomKey, setShowCustomKey] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isAlreadyConfigured = configuredProviders.has(selectedProvider);

  const addModelEntry = () => {
    setModelEntries([...modelEntries, emptyEntry()]);
  };

  const removeModelEntry = (index: number) => {
    if (modelEntries.length <= 1) return;
    setModelEntries(modelEntries.filter((_, i) => i !== index));
  };

  const updateModelEntry = (index: number, field: keyof ModelEntry, value: string | boolean) => {
    const updated = [...modelEntries];
    updated[index] = { ...updated[index], [field]: value };
    setModelEntries(updated);
  };

  const handleSubmitBuiltIn = async () => {
    if (!selectedProvider) {
      setError("Select a provider");
      return;
    }
    if (!apiKey.trim()) {
      setError("API Key is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await setProviderAuth(
        selectedProvider,
        apiKey.trim(),
        selectedProvider === "modelstudio" ? builtInBaseUrl.trim() || undefined : undefined,
      );
      setShowAddDialog(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitCustom = async () => {
    const validEntries = modelEntries.filter((e) => e.id.trim());
    if (!providerName.trim()) {
      setError("Provider Name is required");
      return;
    }
    if (validEntries.length === 0) {
      setError("At least one Model ID is required");
      return;
    }
    if (!baseUrl.trim()) {
      setError("Base URL is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const newModels = validEntries.map((entry) => {
        const inputTypes: string[] = [];
        if (entry.inputText) inputTypes.push("text");
        if (entry.inputImage) inputTypes.push("image");
        if (inputTypes.length === 0) inputTypes.push("text");

        return {
          id: entry.id.trim(),
          displayName: entry.displayName.trim() || entry.id.trim(),
          provider: providerName.trim(),
          apiKey: customApiKey.trim() || undefined,
          apiProtocol,
          baseUrl: baseUrl.trim(),
          contextWindow: parseInt(entry.contextWindow, 10) || 128000,
          maxTokens: parseInt(entry.maxTokens, 10) || 8192,
          input: inputTypes,
          reasoning: entry.reasoning,
        };
      });

      if (isEditingProvider) {
        // Replace all models for this provider
        const oldIds = editingProviderGroup.map((m) => m.id);
        await replaceProviderModels(editingProviderGroup[0].provider, oldIds, newModels);
      } else {
        for (const modelData of newModels) {
          await addCustomModel(modelData);
        }
      }
      setShowAddDialog(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[480px] max-h-[90vh] overflow-y-auto bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            {isEditingProvider ? "Edit Provider" : isEditing ? "Edit Model" : "Set up Provider"}
          </h2>
          <button
            onClick={() => setShowAddDialog(false)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Mode tabs (only when not editing) */}
          {!isEditing && (
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              <button
                onClick={() => {
                  setMode("builtin");
                  setError("");
                }}
                className={`flex-1 px-3 py-2 text-sm transition-colors ${
                  mode === "builtin"
                    ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-r border-[var(--color-border)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] border-r border-[var(--color-border)]"
                }`}
              >
                Built-in Provider
              </button>
              <button
                onClick={() => {
                  setMode("custom");
                  setError("");
                }}
                className={`flex-1 px-3 py-2 text-sm transition-colors ${
                  mode === "custom"
                    ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
                }`}
              >
                Custom Provider
              </button>
            </div>
          )}

          {/* Built-in provider mode */}
          {mode === "builtin" && !isEditing && (
            <>
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                  Provider
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    setSelectedProvider(e.target.value);
                    setError("");
                  }}
                  className={inputClass}
                >
                  {builtInProviders.length === 0 && (
                    <option value="">No providers available</option>
                  )}
                  {builtInProviders.map((p: string) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {isAlreadyConfigured && (
                <div className="px-3 py-2 rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/30">
                  <p className="text-xs text-[var(--color-success)]">
                    This provider is already configured. Submitting will update the API key.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-1">API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter API Key"
                    className={`${inputClass} pr-14`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs"
                  >
                    {showKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {selectedProvider === "modelstudio" && (
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-1">Base URL</label>
                <input
                  type="text"
                  value={builtInBaseUrl}
                  onChange={(e) => setBuiltInBaseUrl(e.target.value)}
                  placeholder={DEFAULT_BASE_URL}
                  className={inputClass}
                />
              </div>
              )}
            </>
          )}

          {/* Custom model mode (or editing) */}
          {(mode === "custom" || isEditing) && (
            <>
              {!isEditing && (
                <div className="px-3 py-2 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30">
                  <p className="text-xs text-[var(--color-warning)]">
                    Adding an external model means you understand and accept the associated risks.
                  </p>
                </div>
              )}

              {/* Provider Name */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                  * Provider Name
                </label>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="e.g. MyProvider"
                  className={inputClass}
                />
              </div>

              {/* Models list */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm text-[var(--color-text-muted)]">* Models</label>
                  <button
                    type="button"
                    onClick={addModelEntry}
                    className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:opacity-80 transition-opacity"
                  >
                    <Plus size={12} />
                    Add Model
                  </button>
                </div>
                <div className="space-y-3">
                  {modelEntries.map((entry, i) => (
                    <div key={i} className="rounded-lg border border-[var(--color-border)] p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={entry.id}
                          onChange={(e) => updateModelEntry(i, "id", e.target.value)}
                          placeholder="Model ID *"
                          className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]"
                        />
                        <input
                          type="text"
                          value={entry.displayName}
                          onChange={(e) => updateModelEntry(i, "displayName", e.target.value)}
                          placeholder="Display Name"
                          className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]"
                        />
                        {modelEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeModelEntry(i)}
                            className="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-md transition-colors shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="block text-[10px] text-[var(--color-text-muted)] mb-0.5">Context Window</label>
                          <input
                            type="number"
                            value={entry.contextWindow}
                            onChange={(e) => updateModelEntry(i, "contextWindow", e.target.value)}
                            placeholder="128000"
                            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] text-[var(--color-text-muted)] mb-0.5">Max Tokens</label>
                          <input
                            type="number"
                            value={entry.maxTokens}
                            onChange={(e) => updateModelEntry(i, "maxTokens", e.target.value)}
                            placeholder="8192"
                            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="block text-[10px] text-[var(--color-text-muted)]">Options</label>
                        <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={entry.inputText}
                            onChange={(e) => updateModelEntry(i, "inputText", e.target.checked)}
                            className="rounded"
                          />
                          text
                        </label>
                        <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={entry.inputImage}
                            onChange={(e) => updateModelEntry(i, "inputImage", e.target.checked)}
                            className="rounded"
                          />
                          image
                        </label>
                        <label className="flex items-center gap-1 text-xs text-[var(--color-warning)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={entry.reasoning}
                            onChange={(e) => updateModelEntry(i, "reasoning", e.target.checked)}
                            className="rounded"
                          />
                          reasoning
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-1">API Key</label>
                <div className="relative">
                  <input
                    type={showCustomKey ? "text" : "password"}
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="Enter API Key (optional)"
                    className={`${inputClass} pr-14`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustomKey(!showCustomKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs"
                  >
                    {showCustomKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                  API Protocol
                </label>
                <select
                  value={apiProtocol}
                  onChange={(e) => setApiProtocol(e.target.value)}
                  className={inputClass}
                >
                  {API_PROTOCOLS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                  * Base URL
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={() => setShowAddDialog(false)}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={mode === "builtin" && !isEditing ? handleSubmitBuiltIn : handleSubmitCustom}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : isEditing
                ? "Save"
                : isAlreadyConfigured && mode === "builtin"
                  ? "Update"
                  : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
