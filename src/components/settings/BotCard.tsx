import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import {
  type TelegramAccountConfig,
  type BindingEntry,
  buildUpdatedBindings,
} from "../../api/telegram-accounts";
import { patchConfig, waitForReconnect } from "../../api/config-helpers";
import { useChatStore } from "../../stores/chat-store";
import { TagInput } from "./TagInput";
import type { ChannelAccountSnapshot } from "./BotCardList";

interface BotCardProps {
  accountId: string;
  config: TelegramAccountConfig;
  status: ChannelAccountSnapshot | null;
  boundAgentId: string | null;
  allBindings: BindingEntry[];
  expanded: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onReload: () => void;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function getStatusDisplay(
  config: TelegramAccountConfig,
  status: ChannelAccountSnapshot | null,
): { label: string; dotClass: string; colorClass: string } {
  const isConfigured = !!config.botToken;
  const isEnabled = config.enabled !== false && isConfigured;

  if (!isConfigured) {
    return {
      label: "Not Set Up",
      colorClass: "text-[var(--color-text-muted)]",
      dotClass: "bg-[var(--color-text-muted)]",
    };
  }
  if (!isEnabled) {
    return {
      label: "Disabled",
      colorClass: "text-[var(--color-text-muted)]",
      dotClass: "bg-[var(--color-text-muted)]",
    };
  }
  if (status?.lastError) {
    return {
      label: "Error",
      colorClass: "text-[var(--color-error)]",
      dotClass: "bg-[var(--color-error)]",
    };
  }
  if (status?.connected || status?.linked || status?.running) {
    return {
      label: "Connected",
      colorClass: "text-[var(--color-success)]",
      dotClass: "bg-[var(--color-success)]",
    };
  }
  if (isConfigured && isEnabled) {
    return {
      label: "Disconnected",
      colorClass: "text-[var(--color-warning)]",
      dotClass: "bg-[var(--color-warning)]",
    };
  }
  return {
    label: "Unknown",
    colorClass: "text-[var(--color-text-muted)]",
    dotClass: "bg-[var(--color-text-muted)]",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BotCard({
  accountId,
  config,
  status,
  boundAgentId,
  allBindings,
  expanded,
  onToggleExpand,
  onRemove,
  onReload,
}: BotCardProps) {
  const agents = useChatStore((s) => s.agents);
  const statusDisplay = getStatusDisplay(config, status);
  const botUsername = status?.probe?.bot?.username ?? null;
  const displayName = botUsername ? `@${botUsername}` : accountId;

  // Bound agent display
  const boundAgent = boundAgentId
    ? agents.find((a) => a.agentId === boundAgentId)
    : null;

  // Toggle state
  const [toggling, setToggling] = useState(false);

  // Expanded form state
  const [dmPolicy, setDmPolicy] = useState(config.dmPolicy ?? "open");
  const [groupPolicy, setGroupPolicy] = useState(
    config.groupPolicy ?? "disabled",
  );
  const [allowFromList, setAllowFromList] = useState<string[]>(
    (config.allowFrom ?? []).map(String),
  );
  const [groupIds, setGroupIds] = useState<string[]>(
    Object.keys(config.groups ?? {}),
  );
  const [groupAllowFromList, setGroupAllowFromList] = useState<string[]>(
    (config.groupAllowFrom ?? []).map(String),
  );
  const [loadedGroupIds] = useState<string[]>(
    Object.keys(config.groups ?? {}),
  );
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    boundAgentId,
  );
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  // 1:1 enforcement: find agents already bound to OTHER telegram accounts
  const telegramBindings = allBindings.filter(
    (b) => b.match?.channel === "telegram",
  );
  const boundAgentIds = new Map<string, string>(); // agentId -> accountId
  telegramBindings
    .filter(
      (b) =>
        b.match.accountId !== accountId &&
        !(accountId === "default" && !b.match.accountId),
    )
    .forEach((b) =>
      boundAgentIds.set(b.agentId, b.match.accountId ?? "default"),
    );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleToggleEnabled(e: React.MouseEvent) {
    e.stopPropagation();
    setToggling(true);
    try {
      await patchConfig({
        channels: {
          telegram: {
            accounts: {
              [accountId]: { enabled: !config.enabled },
            },
          },
        },
      });
      await waitForReconnect();
      onReload();
    } catch (err) {
      console.error("[bot-card] toggle failed:", err);
    } finally {
      setToggling(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSavedMsg("");
    try {
      // Build groups Record with merge-patch deletion support
      const groupsRecord: Record<string, Record<string, unknown> | null> = {};
      for (const id of groupIds) {
        groupsRecord[id] = {};
      }
      for (const id of loadedGroupIds) {
        if (!groupIds.includes(id)) {
          groupsRecord[id] = null; // delete via merge-patch
        }
      }

      const telegramConfig: Record<string, unknown> = {
        enabled: config.enabled !== false,
        botToken: config.botToken ?? undefined,
        dmPolicy,
        groupPolicy,
        allowFrom: allowFromList.length > 0 ? allowFromList : null,
        groupAllowFrom:
          groupAllowFromList.length > 0 ? groupAllowFromList : null,
        groups:
          Object.keys(groupsRecord).length > 0 ? groupsRecord : undefined,
      };

      const updatedBindings = buildUpdatedBindings(
        allBindings,
        accountId,
        selectedAgentId,
      );

      await patchConfig({
        channels: {
          telegram: {
            accounts: {
              [accountId]: telegramConfig,
            },
          },
        },
        bindings: updatedBindings,
      });

      setSavedMsg("Saved! Restarting gateway...");
      await waitForReconnect();
      onReload();
      setSavedMsg("Saved and reconnected.");
    } catch (err) {
      setSavedMsg(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isEnabled = config.enabled !== false && !!config.botToken;

  return (
    <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      {/* Compact header */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Status dot */}
          <span
            className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusDisplay.dotClass}`}
          />
          {/* Bot name */}
          <span className="text-sm font-medium text-[var(--color-text)] truncate">
            {displayName}
          </span>
          {/* Bound agent */}
          {boundAgent && (
            <span className="text-xs text-[var(--color-text-muted)] truncate">
              {boundAgent.emoji ? `${boundAgent.emoji} ` : ""}
              {boundAgent.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status label */}
          <span
            className={`text-xs font-medium ${statusDisplay.colorClass}`}
          >
            {statusDisplay.label}
          </span>
          {/* Enable/disable toggle */}
          <div
            role="switch"
            aria-checked={isEnabled}
            tabIndex={0}
            onClick={handleToggleEnabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleToggleEnabled(
                  e as unknown as React.MouseEvent,
                );
              }
            }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
              toggling
                ? "opacity-50"
                : isEnabled
                  ? "bg-[var(--color-accent)]"
                  : "bg-[var(--color-border)]"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                isEnabled ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
          {/* Expand chevron */}
          {expanded ? (
            <ChevronUp
              size={14}
              className="text-[var(--color-text-muted)]"
            />
          ) : (
            <ChevronDown
              size={14}
              className="text-[var(--color-text-muted)]"
            />
          )}
        </div>
      </button>

      {/* Expanded form */}
      {expanded && (
        <div className="border-t border-[var(--color-border)] px-4 py-4 space-y-4">
          {/* Bot Token (read-only display) */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
              Bot Token
            </label>
            <input
              type="password"
              value={config.botToken ?? ""}
              readOnly
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] opacity-70 cursor-default"
            />
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              Token is set during bot creation. Remove and re-add to change.
            </p>
          </div>

          {/* Agent Binding with 1:1 enforcement */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
              Agent
            </label>
            <select
              value={selectedAgentId ?? ""}
              onChange={(e) =>
                setSelectedAgentId(e.target.value || null)
              }
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">Select an agent...</option>
              {agents.map((a) => {
                const boundTo = boundAgentIds.get(a.agentId);
                return (
                  <option
                    key={a.agentId}
                    value={a.agentId}
                    disabled={!!boundTo}
                  >
                    {a.emoji ? `${a.emoji} ` : ""}
                    {a.name}
                    {boundTo
                      ? ` (bound to @${boundTo})`
                      : ""}
                  </option>
                );
              })}
            </select>
            {!selectedAgentId && (
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Choose which agent handles messages from this
                bot
              </p>
            )}
          </div>

          {/* DM Policy */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
              DM Policy
            </label>
            <select
              value={dmPolicy}
              onChange={(e) => setDmPolicy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="open">
                Open -- anyone can DM the bot
              </option>
              <option value="allowlist">
                Allowlist -- only listed users
              </option>
              <option value="pairing">
                Pairing -- users must pair first
              </option>
              <option value="disabled">
                Disabled -- no DMs
              </option>
            </select>
          </div>

          {/* DM Allow-List */}
          {dmPolicy === "allowlist" && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                DM Allow-List
              </label>
              <TagInput
                tags={allowFromList}
                onChange={setAllowFromList}
                placeholder="Enter user ID..."
              />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Telegram user IDs allowed to message the bot
                directly.
              </p>
            </div>
          )}

          {/* Group Policy */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
              Group Policy
            </label>
            <select
              value={groupPolicy}
              onChange={(e) => setGroupPolicy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="open">
                Open -- respond in any group
              </option>
              <option value="allowlist">
                Allowlist -- only listed groups
              </option>
              <option value="disabled">
                Disabled -- no group messages
              </option>
            </select>
          </div>

          {/* Allowed Groups */}
          {groupPolicy === "allowlist" && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                  Allowed Groups
                </label>
                <TagInput
                  tags={groupIds}
                  onChange={setGroupIds}
                  placeholder="Enter group chat ID..."
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Group chat IDs where the bot will respond.
                </p>
              </div>

              {/* Group Sender Allow-List */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                  Group Sender Allow-List
                </label>
                <TagInput
                  tags={groupAllowFromList}
                  onChange={setGroupAllowFromList}
                  placeholder="Enter user ID..."
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  User IDs allowed to interact in group chats.
                  Leave empty to allow all.
                </p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-accent)] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-error)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors inline-flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              Remove
            </button>
          </div>

          {/* Save feedback */}
          {savedMsg && (
            <p
              className={`text-xs ${
                savedMsg.startsWith("Error")
                  ? "text-[var(--color-error)]"
                  : "text-[var(--color-success)]"
              }`}
            >
              {savedMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
