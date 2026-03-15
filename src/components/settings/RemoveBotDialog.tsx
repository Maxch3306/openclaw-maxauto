import { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { gateway } from "../../api/gateway-client";
import {
  type TelegramConfig,
  type TelegramAccountConfig,
  type BindingEntry,
  buildUpdatedBindings,
  getAccountConfigs,
  getTelegramBindingForAccount,
  isMultiAccountConfig,
} from "../../api/telegram-accounts";
import { patchConfig, waitForReconnect } from "../../api/config-helpers";
import { useChatStore } from "../../stores/chat-store";

interface RemoveBotDialogProps {
  open: boolean;
  accountId: string;
  username: string;
  onClose: () => void;
  onRemoved: () => void;
}

interface BotSummary {
  boundAgentName: string | null;
  dmPolicy: string;
  groupPolicy: string;
  allowFromCount: number;
  groupAllowFromCount: number;
}

export function RemoveBotDialog({
  open,
  accountId,
  username,
  onClose,
  onRemoved,
}: RemoveBotDialogProps) {
  const agents = useChatStore((s) => s.agents);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<BotSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");

    void (async () => {
      try {
        const configResult = await gateway.request<{
          config: Record<string, unknown>;
          hash: string;
        }>("config.get", {});

        const cfg = configResult.config as {
          channels?: { telegram?: TelegramConfig };
          bindings?: BindingEntry[];
        };
        const tg = cfg.channels?.telegram ?? {};
        const accts = getAccountConfigs(tg);
        const acct: TelegramAccountConfig = accts.get(accountId) ?? {};
        const bindings = (cfg.bindings ?? []) as BindingEntry[];
        const binding = getTelegramBindingForAccount(bindings, accountId);
        const boundAgent = binding
          ? agents.find((a) => a.agentId === binding.agentId)
          : null;

        setSummary({
          boundAgentName: boundAgent?.name ?? (binding?.agentId ? `Agent ${binding.agentId}` : null),
          dmPolicy: acct.dmPolicy ?? "open",
          groupPolicy: acct.groupPolicy ?? "disabled",
          allowFromCount: (acct.allowFrom ?? []).length,
          groupAllowFromCount: (acct.groupAllowFrom ?? []).length,
        });
      } catch {
        setSummary(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, accountId, agents]);

  if (!open) return null;

  async function handleRemove() {
    setRemoving(true);
    setError("");

    try {
      const configResult = await gateway.request<{
        config: Record<string, unknown>;
        hash: string;
      }>("config.get", {});

      const cfg = configResult.config as {
        channels?: { telegram?: TelegramConfig };
        bindings?: BindingEntry[];
      };
      const tg = cfg.channels?.telegram ?? {};
      const currentBindings = (cfg.bindings ?? []) as BindingEntry[];

      // Build updated bindings: remove this account's binding
      const updatedBindings = buildUpdatedBindings(
        currentBindings,
        accountId,
        null,
      );

      // Build the config patch based on config shape
      let telegramPatch: Record<string, unknown>;

      if (isMultiAccountConfig(tg)) {
        // Multi-account: delete the specific account entry
        telegramPatch = { accounts: { [accountId]: null } };
      } else {
        // Legacy flat config: null out top-level telegram fields
        telegramPatch = {
          botToken: null,
          dmPolicy: null,
          groupPolicy: null,
          allowFrom: null,
          groupAllowFrom: null,
          groups: null,
          enabled: null,
        };
      }

      // Single atomic patchConfig: delete account + update bindings
      await patchConfig({
        channels: { telegram: telegramPatch },
        bindings: updatedBindings,
      });

      await waitForReconnect();
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRemoving(false);
    }
  }

  const displayUsername = username.startsWith("@") ? username : `@${username}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[400px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            Remove Telegram Bot
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg"
          >
            x
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Warning icon */}
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-[var(--color-error)]/10 flex items-center justify-center">
              <AlertTriangle
                size={24}
                className="text-[var(--color-error)]"
              />
            </div>
          </div>

          {/* Bot info */}
          <p className="text-sm text-center text-[var(--color-text)]">
            Are you sure you want to remove{" "}
            <span className="font-semibold">{displayUsername}</span>?
          </p>

          {/* Impact summary */}
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2
                size={14}
                className="animate-spin text-[var(--color-text-muted)]"
              />
            </div>
          ) : (
            summary && (
              <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">
                    Bot
                  </span>
                  <span className="text-[var(--color-text)]">
                    {displayUsername}
                  </span>
                </div>
                {summary.boundAgentName && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">
                      Bound Agent
                    </span>
                    <span className="text-[var(--color-text)]">
                      {summary.boundAgentName}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">
                    DM Policy
                  </span>
                  <span className="text-[var(--color-text)]">
                    {summary.dmPolicy}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">
                    Group Policy
                  </span>
                  <span className="text-[var(--color-text)]">
                    {summary.groupPolicy}
                  </span>
                </div>
                {(summary.allowFromCount > 0 ||
                  summary.groupAllowFromCount > 0) && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">
                      Access List Entries
                    </span>
                    <span className="text-[var(--color-text)]">
                      {summary.allowFromCount + summary.groupAllowFromCount}
                    </span>
                  </div>
                )}
              </div>
            )
          )}

          {/* Warning text */}
          <p className="text-xs text-[var(--color-text-muted)] text-center">
            This will permanently remove the bot configuration and its agent
            binding. This cannot be undone.
          </p>

          {/* Error display */}
          {error && (
            <p className="text-xs text-[var(--color-error)]">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--color-error)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
          >
            {removing && (
              <Loader2 size={14} className="animate-spin" />
            )}
            {removing ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
