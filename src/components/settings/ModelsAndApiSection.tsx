import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { gateway } from "@/api/gateway-client";
import { useAppStore } from "@/stores/app-store";
import { useChatStore } from "@/stores/chat-store";
import { useSettingsStore, PROVIDER_DEFAULTS, GLM_MCP_PROVIDER_KEY, type CustomModel } from "@/stores/settings-store";
import { AddModelDialog } from "./AddModelDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export function ModelsAndApiSection() {
  const { t } = useTranslation();
  const models = useSettingsStore((s) => s.models);
  const customModels = useSettingsStore((s) => s.customModels);
  const configuredProviders = useSettingsStore((s) => s.configuredProviders);
  const builtInProviderModels = useSettingsStore((s) => s.builtInProviderModels);
  const showAddDialog = useSettingsStore((s) => s.showAddModelDialog);
  const setShowAddDialog = useSettingsStore((s) => s.setShowAddModelDialog);
  const loadConfig = useSettingsStore((s) => s.loadConfig);
  const loadModels = useSettingsStore((s) => s.loadModels);
  const removeCustomModel = useSettingsStore((s) => s.removeCustomModel);
  const removeProvider = useSettingsStore((s) => s.removeProvider);
  const defaultModelId = useSettingsStore((s) => s.defaultModelId);
  const glmMcpEnabled = useSettingsStore((s) => s.glmMcpEnabled);
  const setGlmMcpServer = useSettingsStore((s) => s.setGlmMcpServer);
  const gatewayConnected = useAppStore((s) => s.gatewayConnected);
  const gatewayPort = useAppStore((s) => s.gatewayPort);
  const setAgentModel = useChatStore((s) => s.setAgentModel);

  useEffect(() => {
    void loadConfig();
    void loadModels();
  }, []);

  const handleReconnect = () => {
    gateway.reconnect();
  };

  const [reloading, setReloading] = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [togglingMcp, setTogglingMcp] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const [removingProvider, setRemovingProvider] = useState<string | null>(null);
  const handleReload = async () => {
    setReloading(true);
    try {
      await loadConfig();
      await loadModels();
    } finally {
      setReloading(false);
    }
  };

  const handleSetDefault = async (qualifiedId: string) => {
    setSettingDefault(qualifiedId);
    try {
      await setAgentModel("main", qualifiedId);
      await loadConfig();
    } catch (err) {
      console.warn("Failed to set default model:", err);
    } finally {
      setSettingDefault(null);
    }
  };

  // Group models from models.list by configured provider
  const modelsByProvider = useMemo(() => {
    const map = new Map<string, typeof models>();
    for (const m of models) {
      if (!configuredProviders.has(m.provider)) {
        continue;
      }
      const list = map.get(m.provider) ?? [];
      list.push(m);
      map.set(m.provider, list);
    }
    return map;
  }, [models, configuredProviders]);

  // Collect custom provider keys so we can exclude them from the built-in list
  const customProviderKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const m of customModels) {
      keys.add(m.provider.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
    }
    return keys;
  }, [customModels]);

  // Providers that have models.list entries (built-in with auth), excluding custom ones
  const builtInProviderKeys = Array.from(configuredProviders).filter(
    (key) => modelsByProvider.has(key) && !customProviderKeys.has(key),
  );

  // Group custom models by provider name (excluding quick-setup provider)
  const customProviderGroups = useMemo(() => {
    const map = new Map<string, CustomModel[]>();
    for (const m of customModels) {
      const list = map.get(m.provider) ?? [];
      list.push(m);
      map.set(m.provider, list);
    }
    return map;
  }, [customModels]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-foreground">{t("settings.models.title")}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReconnect}
        >
          {t("common.reconnect")}
        </Button>
      </div>

      {/* Configured providers */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{t("settings.models.providers")}</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleReload}
              disabled={reloading}
              title="Reload providers"
            >
              <RefreshCw size={14} className={reloading ? "animate-spin" : ""} />
            </Button>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
          >
            {t("settings.models.setupProvider")}
          </Button>
        </div>

        {configuredProviders.size === 0 && customModels.length === 0 ? (
          <div className="text-center py-8 rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground mb-3">
              {t("settings.models.noProviders")}
            </p>
            <Button
              size="sm"
              onClick={() => setShowAddDialog(true)}
            >
              {t("settings.models.setupProvider")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Built-in providers (from models.list, auth configured) */}
            {builtInProviderKeys.map((provKey) => {
              const providerModels = modelsByProvider.get(provKey) ?? [];
              return (
                <Card
                  key={provKey}
                  className="overflow-hidden relative"
                >
                  {removingProvider === provKey && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 backdrop-blur-sm rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 size={16} className="animate-spin" />
                        <span>{t("settings.models.updatingConfig")}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {PROVIDER_DEFAULTS[provKey]?.displayName ?? provKey}
                      </span>
                      <Badge variant="success" className="text-[10px] px-1.5 py-0.5">
                        {t("settings.models.modelCount", { count: providerModels.length })}
                      </Badge>
                    </div>
                    {removingProvider === provKey ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 size={12} className="animate-spin" />
                        <span>{t("common.removing")}</span>
                      </div>
                    ) : confirmingRemove === provKey ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setConfirmingRemove(null)}
                        >
                          {t("common.cancel")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={async () => {
                            setConfirmingRemove(null);
                            setRemovingProvider(provKey);
                            try {
                              await removeProvider(provKey);
                            } catch (err) {
                              console.error("[settings] removeProvider failed:", err);
                            }
                            setRemovingProvider(null);
                          }}
                        >
                          {t("common.confirm")}
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingRemove(provKey)}
                        className="text-xs text-destructive hover:underline"
                      >
                        {t("common.remove")}
                      </button>
                    )}
                  </div>
                  {/* Provider description and signup link */}
                  {PROVIDER_DEFAULTS[provKey]?.signupUrl && (
                    <div className="border-t border-border px-3 py-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {PROVIDER_DEFAULTS[provKey]?.description}
                      </span>
                      <a
                        href={PROVIDER_DEFAULTS[provKey]!.signupUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline shrink-0"
                      >
                        <ExternalLink size={10} />
                        {t("settings.models.getApiKey")}
                      </a>
                    </div>
                  )}
                  {providerModels.length > 0 && (
                    <div className="border-t border-border px-3 py-2 space-y-1">
                      {providerModels.map((m) => {
                        const qualifiedId = `${provKey}/${m.id}`;
                        const isDefault = defaultModelId === qualifiedId;
                        // Prefer resolved models from config.get, fall back to hardcoded defaults
                        const resolvedModels = builtInProviderModels.get(provKey);
                        const resolvedDef = resolvedModels?.find((d) => d.id === m.id);
                        const provDef = PROVIDER_DEFAULTS[provKey];
                        const hardcodedDef = provDef?.models.find((d) => d.id === m.id);
                        const modelDef = resolvedDef ?? hardcodedDef;
                        const inputTypes = modelDef?.input ?? [];
                        return (
                          <div key={m.id} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-xs text-muted-foreground truncate">
                                {m.name || m.id}
                              </span>
                              {inputTypes.map((type) => (
                                <Badge
                                  key={type}
                                  variant="outline"
                                  className="text-[10px] px-1 py-0.5 bg-primary/10 text-primary border-transparent"
                                >
                                  {type}
                                </Badge>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isDefault ? (
                                <Badge variant="success" className="text-[10px] px-1.5 py-0.5">
                                  {t("common.default")}
                                </Badge>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="xs"
                                  className="text-[10px] h-5"
                                  onClick={() => handleSetDefault(qualifiedId)}
                                  disabled={settingDefault === qualifiedId}
                                >
                                  {settingDefault === qualifiedId ? "..." : t("settings.models.setDefault")}
                                </Button>
                              )}
                              {m.reasoning && (
                                <Badge variant="warning" className="text-[10px] px-1 py-0.5">
                                  {t("settings.models.reasoning")}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* MCP Server toggle for GLM Coding provider */}
                  {provKey === GLM_MCP_PROVIDER_KEY && (
                    <div className="border-t border-border px-3 py-2 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-foreground">{t("settings.models.mcpServer")}</span>
                        <p className="text-[10px] text-muted-foreground">{t("settings.models.mcpServerDesc")}</p>
                      </div>
                      <Switch
                        checked={glmMcpEnabled}
                        disabled={togglingMcp}
                        onCheckedChange={async () => {
                          setTogglingMcp(true);
                          try {
                            await setGlmMcpServer(!glmMcpEnabled);
                          } catch (err) {
                            console.warn("Failed to toggle MCP server:", err);
                          } finally {
                            setTogglingMcp(false);
                          }
                        }}
                      />
                    </div>
                  )}
                </Card>
              );
            })}

            {/* Custom providers (grouped by baseUrl, same card style as built-in) */}
            {Array.from(customProviderGroups.entries()).map(([providerName, group]) => {
              const provSlug = providerName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
              return (
              <Card
                key={providerName}
                className="overflow-hidden relative"
              >
                {removingProvider === `custom:${providerName}` && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 backdrop-blur-sm rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t("settings.models.updatingConfig")}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{providerName}</span>
                    <Badge variant="default" className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary">
                      {t("settings.models.modelCount", { count: group.length })}
                    </Badge>
                    <Badge variant="warning" className="text-[10px] px-1.5 py-0.5">
                      {t("settings.models.custom")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddDialog(true, group[0], group)}
                      className="text-xs text-primary hover:underline"
                    >
                      {t("common.edit")}
                    </button>
                    {removingProvider === `custom:${providerName}` ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 size={12} className="animate-spin" />
                        <span>{t("common.removing")}</span>
                      </div>
                    ) : confirmingRemove === `custom:${providerName}` ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setConfirmingRemove(null)}
                        >
                          {t("common.cancel")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={async () => {
                            const removeKey = `custom:${providerName}`;
                            setConfirmingRemove(null);
                            setRemovingProvider(removeKey);
                            try {
                              for (const m of group) {
                                await removeCustomModel(m.id);
                              }
                            } catch (err) {
                              console.error("[settings] removeCustomProvider failed:", err);
                            }
                            setRemovingProvider(null);
                          }}
                        >
                          {t("common.confirm")}
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingRemove(`custom:${providerName}`)}
                        className="text-xs text-destructive hover:underline"
                      >
                        {t("common.remove")}
                      </button>
                    )}
                  </div>
                </div>
                <div className="border-t border-border px-3 py-2 space-y-1">
                  {group.map((m) => {
                    const qualifiedId = `${provSlug}/${m.id}`;
                    const isDefault = defaultModelId === qualifiedId;
                    const inputTypes = m.input ?? [];
                    return (
                    <div key={m.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs text-muted-foreground truncate">
                          {m.displayName || m.id}
                        </span>
                        {inputTypes.map((type) => (
                          <Badge
                            key={type}
                            variant="outline"
                            className="text-[10px] px-1 py-0.5 bg-primary/10 text-primary border-transparent"
                          >
                            {type}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isDefault ? (
                          <Badge variant="success" className="text-[10px] px-1.5 py-0.5">
                            {t("common.default")}
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="xs"
                            className="text-[10px] h-5"
                            onClick={() => handleSetDefault(qualifiedId)}
                            disabled={settingDefault === qualifiedId}
                          >
                            {settingDefault === qualifiedId ? "..." : t("settings.models.setDefault")}
                          </Button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Gateway URL */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("settings.models.gatewayUrl")}</h2>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Badge
              variant={gatewayConnected ? "success" : "destructive"}
              className="text-xs"
            >
              {gatewayConnected ? t("common.connected") : t("common.disconnected")}
            </Badge>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={handleReconnect}
              >
                {t("common.reconnect")}
              </Button>
            </div>
          </div>
          <div className="px-3 py-2 rounded bg-background border border-border text-sm text-muted-foreground font-mono">
            ws://127.0.0.1:{gatewayPort}
          </div>
        </Card>
      </section>

      {showAddDialog && <AddModelDialog />}
    </div>
  );
}
