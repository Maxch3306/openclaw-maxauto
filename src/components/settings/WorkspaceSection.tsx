import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { gateway } from "../../api/gateway-client";
import { openFolder } from "../../api/tauri-commands";

const DEFAULT_WORKSPACE = "~/.openclaw-maxauto/workspace";

interface AgentWorkspaceInfo {
  agentId: string;
  name: string;
  emoji?: string;
  status: "default" | "custom" | "auto-assigned";
  effectivePath: string;
}

export function WorkspaceSection() {
  const [workspacePath, setWorkspacePath] = useState(DEFAULT_WORKSPACE);
  const [agentWorkspaces, setAgentWorkspaces] = useState<AgentWorkspaceInfo[]>([]);

  const isMac = navigator.platform.includes("Mac");

  useEffect(() => {
    loadWorkspacePath();
    loadAgentWorkspaces();
  }, []);

  async function loadWorkspacePath() {
    try {
      const { config } = await gateway.request<{
        config: { agents?: { defaults?: { workspace?: string } } };
        hash: string;
      }>("config.get", {});
      const path = config?.agents?.defaults?.workspace;
      if (path) setWorkspacePath(path);
    } catch (err) {
      console.error("[workspace] failed to load config:", err);
    }
  }

  async function loadAgentWorkspaces() {
    try {
      const { config } = await gateway.request<{
        config: {
          agents?: {
            defaults?: { workspace?: string };
            list?: Array<{ id: string; workspace?: string; [key: string]: unknown }>;
          };
        };
        hash: string;
      }>("config.get", {});

      const { agents } = await gateway.request<{
        agents: Array<{ agentId?: string; id?: string; name?: string; emoji?: string; workspace?: string }>;
      }>("agents.list", {});

      const defaultWs = config?.agents?.defaults?.workspace || DEFAULT_WORKSPACE;
      const configList = config?.agents?.list ?? [];

      const infos: AgentWorkspaceInfo[] = agents.map((agent, index) => {
        const agentId = agent.agentId ?? agent.id ?? "unknown";
        const agentName = agent.name ?? agentId ?? "Agent";
        const configEntry = configList.find((c) => c.id === agentId);
        const explicitWorkspace = configEntry?.workspace || agent.workspace;

        if (explicitWorkspace) {
          return {
            agentId,
            name: agentName,
            emoji: agent.emoji,
            status: "custom" as const,
            effectivePath: explicitWorkspace,
          };
        }

        if (index === 0) {
          return {
            agentId,
            name: agentName,
            emoji: agent.emoji,
            status: "default" as const,
            effectivePath: defaultWs,
          };
        }

        // Non-default agents get auto-assigned workspace: {defaultWs}-{agentName}
        const agentWsName = agentName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
        return {
          agentId,
          name: agentName,
          emoji: agent.emoji,
          status: "auto-assigned" as const,
          effectivePath: `${defaultWs}-${agentWsName}`,
        };
      });

      setAgentWorkspaces(infos);
    } catch (err) {
      console.error("[workspace] failed to load agent workspaces:", err);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-lg font-semibold text-[var(--color-text)] mb-6">Workspace</h1>

      <section className="mb-6">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">
          Default Workspace
        </h2>
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            The workspace is the directory where agents read and write files. All agents use this
            default workspace unless overridden.
          </p>

          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-sm text-[var(--color-text)] truncate min-w-0">
              {workspacePath}
            </span>
            <button
              onClick={() => void openFolder(workspacePath)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors shrink-0"
            >
              <ExternalLink size={14} />
              {isMac ? "Open in Finder" : "Open in Explorer"}
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">
          Per-Agent Workspaces
        </h2>
        {agentWorkspaces.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No agents found.</p>
        ) : (
          <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {agentWorkspaces.map((info) => (
              <div
                key={info.agentId}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                {/* Agent identity */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-base">{info.emoji || "🤖"}</span>
                  <span className="text-sm font-medium text-[var(--color-text)]">
                    {info.name}
                  </span>
                </div>

                {/* Workspace path / status */}
                <div className="flex-1 min-w-0 text-right">
                  {info.status === "custom" ? (
                    <span className="font-mono text-xs text-[var(--color-text)] truncate block">
                      {info.effectivePath}
                    </span>
                  ) : info.status === "default" ? (
                    <span className="text-xs text-[var(--color-text-muted)] italic">
                      Default
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)] italic">
                      Auto-assigned
                    </span>
                  )}
                </div>

                {/* Open in Explorer */}
                <button
                  onClick={() => void openFolder(info.effectivePath)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors shrink-0"
                >
                  <ExternalLink size={12} />
                  {isMac ? "Finder" : "Explorer"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
