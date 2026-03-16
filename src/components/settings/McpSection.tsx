import { ExternalLink, Globe, Loader2, Plus, Terminal, Trash2, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gateway } from "@/api/gateway-client";
import { patchConfig, waitForReconnect } from "@/api/config-helpers";
import { openUrl } from "@/api/tauri-commands";
import { useAppStore } from "@/stores/app-store";

type McpServerEntry = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

type McpServersMap = Record<string, McpServerEntry>;

type ServerType = "local" | "remote";

/** Detect if a server entry was created via mcp-remote bridge */
function isRemoteEntry(entry: McpServerEntry): boolean {
  return (
    entry.args?.some((a) => a.includes("mcp-remote")) === true ||
    entry.command.includes("mcp-remote")
  );
}

/** Extract URL from mcp-remote args */
function extractRemoteUrl(entry: McpServerEntry): string {
  if (!entry.args) return "";
  // URL is the first arg after "mcp-remote" (or after "-y mcp-remote")
  const args = entry.args;
  for (let i = 0; i < args.length; i++) {
    if (args[i].includes("mcp-remote") && i + 1 < args.length) {
      return args[i + 1];
    }
    if (args[i].startsWith("http://") || args[i].startsWith("https://")) {
      return args[i];
    }
  }
  return "";
}

/** Build a stdio entry that uses mcp-remote as bridge */
function buildRemoteEntry(
  url: string,
  headers: { key: string; value: string }[],
): McpServerEntry {
  const args = ["-y", "mcp-remote@latest", url];
  const env: Record<string, string> = {};

  for (const h of headers) {
    const k = h.key.trim();
    const v = h.value.trim();
    if (!k || !v) continue;
    // If value references an env var like ${TOKEN}, add it to env
    const envMatch = v.match(/\$\{(\w+)\}/);
    if (envMatch) {
      args.push("--header", `${k}: ${v}`);
    } else {
      // Use env var for the value to avoid leaking secrets in args
      const envKey = `MCP_HEADER_${k.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
      args.push("--header", `${k}: \${${envKey}}`);
      env[envKey] = v;
    }
  }

  const entry: McpServerEntry = { command: "npx", args };
  if (Object.keys(env).length > 0) entry.env = env;
  return entry;
}

export function McpSection() {
  const { t } = useTranslation();
  const gatewayConnected = useAppStore((s) => s.gatewayConnected);
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<McpServersMap>({});
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  // Add form state
  const [serverType, setServerType] = useState<ServerType>("local");
  const [newName, setNewName] = useState("");
  // Local fields
  const [newCommand, setNewCommand] = useState("");
  const [newArgs, setNewArgs] = useState("");
  const [newEnvPairs, setNewEnvPairs] = useState<{ key: string; value: string }[]>([]);
  // Remote fields
  const [newUrl, setNewUrl] = useState("");
  const [newHeaders, setNewHeaders] = useState<{ key: string; value: string }[]>([]);

  const loadMcpServers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gateway.request<{
        config: Record<string, unknown>;
      }>("config.get", {});
      const cfg = result.config as {
        plugins?: {
          entries?: {
            acpx?: { config?: { mcpServers?: McpServersMap } };
          };
        };
      };
      setServers(cfg.plugins?.entries?.acpx?.config?.mcpServers ?? {});
    } catch {
      // Gateway not ready
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (gatewayConnected) {
      void loadMcpServers();
    } else {
      setLoading(false);
    }
  }, [gatewayConnected, loadMcpServers]);

  const handleRemove = async (serverKey: string) => {
    setRemovingKey(serverKey);
    setBusy(true);
    try {
      await patchConfig({
        plugins: {
          entries: {
            acpx: {
              config: {
                mcpServers: { [serverKey]: null },
              },
            },
          },
        },
      });
      await waitForReconnect();
      await loadMcpServers();
    } catch (err) {
      console.warn("Failed to remove MCP server:", err);
    } finally {
      setBusy(false);
      setRemovingKey(null);
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewCommand("");
    setNewArgs("");
    setNewEnvPairs([]);
    setNewUrl("");
    setNewHeaders([]);
    setShowAdd(false);
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;

    let entry: McpServerEntry;

    if (serverType === "remote") {
      const url = newUrl.trim();
      if (!url) return;
      entry = buildRemoteEntry(url, newHeaders);
    } else {
      const command = newCommand.trim();
      if (!command) return;

      entry = { command };
      const args = newArgs
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
      if (args.length > 0) entry.args = args;

      const env: Record<string, string> = {};
      for (const pair of newEnvPairs) {
        const k = pair.key.trim();
        if (k) env[k] = pair.value;
      }
      if (Object.keys(env).length > 0) entry.env = env;
    }

    setBusy(true);
    try {
      await patchConfig({
        plugins: {
          entries: {
            acpx: {
              config: {
                mcpServers: { [name]: entry },
              },
            },
          },
        },
      });
      await waitForReconnect();
      await loadMcpServers();
      resetForm();
    } catch (err) {
      console.warn("Failed to add MCP server:", err);
    } finally {
      setBusy(false);
    }
  };

  if (!gatewayConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <WifiOff size={32} />
        <p className="text-sm font-medium">{t("settings.mcp.gatewayRequired")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 size={24} className="animate-spin" />
        <p className="text-sm">{t("settings.mcp.loading")}</p>
      </div>
    );
  }

  const serverEntries = Object.entries(servers);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-foreground">
          {t("settings.mcp.title")}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openUrl("https://smithery.ai/servers")}
          >
            <ExternalLink size={13} />
            {t("settings.mcp.browseSmithery")}
          </Button>
          <Button
            onClick={() => setShowAdd(!showAdd)}
            disabled={busy}
            size="sm"
          >
            <Plus size={14} />
            {t("settings.mcp.addServer")}
          </Button>
        </div>
      </div>

      {/* Add server form */}
      {showAdd && (
        <Card className="mb-6 p-4 space-y-3">
          <h2 className="text-sm font-medium text-foreground">
            {t("settings.mcp.addServer")}
          </h2>

          {/* Server type toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setServerType("local")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                serverType === "local"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Terminal size={13} />
              {t("settings.mcp.typeLocal")}
            </button>
            <button
              onClick={() => setServerType("remote")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                serverType === "remote"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Globe size={13} />
              {t("settings.mcp.typeRemote")}
            </button>
          </div>

          {/* Server name */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {t("settings.mcp.serverName")}
            </label>
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="my-mcp-server"
              className="h-8"
            />
          </div>

          {/* Local server fields */}
          {serverType === "local" && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {t("settings.mcp.command")}
                </label>
                <Input
                  type="text"
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                  placeholder="npx"
                  className="h-8 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {t("settings.mcp.args")}
                </label>
                <Textarea
                  value={newArgs}
                  onChange={(e) => setNewArgs(e.target.value)}
                  placeholder={"-y\n@z_ai/mcp-server"}
                  rows={3}
                  className="font-mono resize-none"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t("settings.mcp.argsHint")}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted-foreground">
                    {t("settings.mcp.envVars")}
                  </label>
                  <button
                    onClick={() =>
                      setNewEnvPairs((prev) => [...prev, { key: "", value: "" }])
                    }
                    className="text-[10px] text-primary hover:underline"
                  >
                    + {t("common.add")}
                  </button>
                </div>
                {newEnvPairs.map((pair, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <Input
                      type="text"
                      value={pair.key}
                      onChange={(e) => {
                        const updated = [...newEnvPairs];
                        updated[i] = { ...pair, key: e.target.value };
                        setNewEnvPairs(updated);
                      }}
                      placeholder="KEY"
                      className="flex-1 h-7 text-xs font-mono"
                    />
                    <Input
                      type="text"
                      value={pair.value}
                      onChange={(e) => {
                        const updated = [...newEnvPairs];
                        updated[i] = { ...pair, value: e.target.value };
                        setNewEnvPairs(updated);
                      }}
                      placeholder="value"
                      className="flex-[2] h-7 text-xs font-mono"
                    />
                    <button
                      onClick={() =>
                        setNewEnvPairs((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Remote server fields */}
          {serverType === "remote" && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {t("settings.mcp.serverUrl")}
                </label>
                <Input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://mcp.example.com/mcp"
                  className="h-8 font-mono"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t("settings.mcp.serverUrlHint")}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted-foreground">
                    {t("settings.mcp.headers")}
                  </label>
                  <button
                    onClick={() =>
                      setNewHeaders((prev) => [...prev, { key: "", value: "" }])
                    }
                    className="text-[10px] text-primary hover:underline"
                  >
                    + {t("common.add")}
                  </button>
                </div>
                {newHeaders.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {t("settings.mcp.headersHint")}
                  </p>
                )}
                {newHeaders.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <Input
                      type="text"
                      value={h.key}
                      onChange={(e) => {
                        const updated = [...newHeaders];
                        updated[i] = { ...h, key: e.target.value };
                        setNewHeaders(updated);
                      }}
                      placeholder="Authorization"
                      className="flex-1 h-7 text-xs font-mono"
                    />
                    <Input
                      type="text"
                      value={h.value}
                      onChange={(e) => {
                        const updated = [...newHeaders];
                        updated[i] = { ...h, value: e.target.value };
                        setNewHeaders(updated);
                      }}
                      placeholder="Bearer your-token"
                      className="flex-[2] h-7 text-xs font-mono"
                    />
                    <button
                      onClick={() =>
                        setNewHeaders((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="px-3 py-2 rounded-lg bg-muted text-[10px] text-muted-foreground">
                {t("settings.mcp.remoteBridgeNote")}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleAdd}
              disabled={
                !newName.trim() ||
                (serverType === "local" && !newCommand.trim()) ||
                (serverType === "remote" && !newUrl.trim()) ||
                busy
              }
              size="sm"
            >
              {busy ? t("common.saving") : t("common.add")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetForm}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </Card>
      )}

      {/* Server list */}
      {serverEntries.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground mb-1">
            {t("settings.mcp.noServers")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("settings.mcp.noServersHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {serverEntries.map(([key, server]) => {
            const remote = isRemoteEntry(server);
            const remoteUrl = remote ? extractRemoteUrl(server) : "";

            return (
              <Card key={key} className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {remote ? (
                      <Globe size={14} className="text-primary shrink-0" />
                    ) : (
                      <Terminal size={14} className="text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-medium text-foreground truncate">
                      {key}
                    </span>
                    <Badge
                      variant={remote ? "default" : "success"}
                      className="text-[10px] px-1.5 py-0.5"
                    >
                      {remote ? "remote" : "stdio"}
                    </Badge>
                  </div>
                  <button
                    onClick={() => handleRemove(key)}
                    disabled={busy}
                    className="text-xs text-destructive hover:underline disabled:opacity-50"
                  >
                    {removingKey === key ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      t("common.remove")
                    )}
                  </button>
                </div>
                <div className="border-t border-border px-4 py-2 space-y-1.5">
                  {remote && remoteUrl ? (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-muted-foreground w-16 shrink-0 pt-0.5">
                        URL
                      </span>
                      <span className="text-xs font-mono text-primary break-all">
                        {remoteUrl}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-muted-foreground w-16 shrink-0 pt-0.5">
                        {t("settings.mcp.command")}
                      </span>
                      <span className="text-xs font-mono text-foreground break-all">
                        {server.command}
                      </span>
                    </div>
                  )}
                  {!remote && server.args && server.args.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-muted-foreground w-16 shrink-0 pt-0.5">
                        {t("settings.mcp.args")}
                      </span>
                      <span className="text-xs font-mono text-foreground break-all">
                        {server.args.join(" ")}
                      </span>
                    </div>
                  )}
                  {server.env && Object.keys(server.env).length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-muted-foreground w-16 shrink-0 pt-0.5">
                        {t("settings.mcp.envVars")}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(server.env).map((envKey) => (
                          <span
                            key={envKey}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background text-muted-foreground"
                          >
                            {envKey}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
