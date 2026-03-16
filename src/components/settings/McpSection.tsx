import { Loader2, Plus, Trash2, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gateway } from "@/api/gateway-client";
import { patchConfig, waitForReconnect } from "@/api/config-helpers";
import { useAppStore } from "@/stores/app-store";

type McpServerEntry = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

type McpServersMap = Record<string, McpServerEntry>;

export function McpSection() {
  const { t } = useTranslation();
  const gatewayConnected = useAppStore((s) => s.gatewayConnected);
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<McpServersMap>({});
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  // Add form state
  const [newName, setNewName] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [newArgs, setNewArgs] = useState("");
  const [newEnvPairs, setNewEnvPairs] = useState<{ key: string; value: string }[]>([]);

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

  const handleAdd = async () => {
    const name = newName.trim();
    const command = newCommand.trim();
    if (!name || !command) return;

    setBusy(true);
    try {
      const entry: McpServerEntry = { command };

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

      // Reset form
      setNewName("");
      setNewCommand("");
      setNewArgs("");
      setNewEnvPairs([]);
      setShowAdd(false);
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
        <Button
          onClick={() => setShowAdd(!showAdd)}
          disabled={busy}
          size="sm"
        >
          <Plus size={14} />
          {t("settings.mcp.addServer")}
        </Button>
      </div>

      {/* Add server form */}
      {showAdd && (
        <Card className="mb-6 p-4 space-y-3">
          <h2 className="text-sm font-medium text-foreground">
            {t("settings.mcp.addServer")}
          </h2>

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

          {/* Command */}
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

          {/* Args (one per line) */}
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

          {/* Env vars */}
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

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleAdd}
              disabled={!newName.trim() || !newCommand.trim() || busy}
              size="sm"
            >
              {busy ? t("common.saving") : t("common.add")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAdd(false);
                setNewName("");
                setNewCommand("");
                setNewArgs("");
                setNewEnvPairs([]);
              }}
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
          {serverEntries.map(([key, server]) => (
            <Card
              key={key}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {key}
                  </span>
                  <Badge variant="success" className="text-[10px] px-1.5 py-0.5">
                    stdio
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
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-muted-foreground w-16 shrink-0 pt-0.5">
                    {t("settings.mcp.command")}
                  </span>
                  <span className="text-xs font-mono text-foreground break-all">
                    {server.command}
                  </span>
                </div>
                {server.args && server.args.length > 0 && (
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
          ))}
        </div>
      )}
    </div>
  );
}
