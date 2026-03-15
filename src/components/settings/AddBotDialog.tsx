import { useState } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { useChatStore } from "../../stores/chat-store";
import { gateway } from "../../api/gateway-client";
import {
  type TelegramConfig,
  type BindingEntry,
  botUsernameToAccountId,
  buildUpdatedBindings,
  getAccountConfigs,
  needsMigration,
  migrateToMultiAccount,
} from "../../api/telegram-accounts";
import { patchConfig, waitForReconnect } from "../../api/config-helpers";

interface AddBotDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  existingAccountIds: string[];
}

const TOKEN_REGEX = /^\d+:[A-Za-z0-9_-]{30,}$/;

interface ValidationResult {
  valid: boolean;
  botUsername?: string;
  error?: string;
}

async function validateBotToken(token: string): Promise<ValidationResult> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getMe`,
    );
    const data = await res.json();
    if (data.ok && data.result?.username) {
      return { valid: true, botUsername: data.result.username };
    }
    return {
      valid: false,
      error: data.description ?? "Invalid token",
    };
  } catch {
    return { valid: false, error: "Network error -- could not reach Telegram API" };
  }
}

export function AddBotDialog({
  open,
  onClose,
  onAdded,
  existingAccountIds,
}: AddBotDialogProps) {
  // Token step state
  const [token, setToken] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);

  // Agent step state
  const agents = useChatStore((s) => s.agents);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [allBindings, setAllBindings] = useState<BindingEntry[]>([]);

  // Save state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const tokenFormatValid = TOKEN_REGEX.test(token.trim());
  const isValidated = validationResult?.valid === true;
  const validatedUsername = validationResult?.botUsername ?? "";

  // 1:1 enforcement: find agents bound to other telegram accounts
  const boundAgentIds = new Map<string, string>();
  allBindings
    .filter((b) => b.match?.channel === "telegram")
    .forEach((b) => {
      boundAgentIds.set(b.agentId, b.match.accountId ?? "default");
    });

  function resetState() {
    setToken("");
    setValidating(false);
    setValidationResult(null);
    setSelectedAgentId(null);
    setAllBindings([]);
    setSaving(false);
    setError("");
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleValidate() {
    setValidating(true);
    setValidationResult(null);
    setError("");

    const result = await validateBotToken(token.trim());

    if (result.valid && result.botUsername) {
      const accountId = botUsernameToAccountId(result.botUsername);
      // Check if this account already exists
      // Also load existing config to get full account list
      const actualExisting = [...existingAccountIds];
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
        const existingAccounts = getAccountConfigs(tg);
        for (const key of existingAccounts.keys()) {
          if (!actualExisting.includes(key)) {
            actualExisting.push(key);
          }
        }
        setAllBindings((cfg.bindings ?? []) as BindingEntry[]);
      } catch {
        // If config load fails, proceed with prop-supplied list
      }

      if (actualExisting.includes(accountId)) {
        setValidationResult({
          valid: false,
          error: "This bot is already configured",
        });
        setValidating(false);
        return;
      }
    }

    setValidationResult(result);
    setValidating(false);
  }

  async function handleSave() {
    if (!validatedUsername || !selectedAgentId) return;
    setSaving(true);
    setError("");

    try {
      // Re-fetch current config for migration check
      const configResult = await gateway.request<{
        config: Record<string, unknown>;
        hash: string;
      }>("config.get", {});

      const cfg = configResult.config as {
        channels?: { telegram?: TelegramConfig };
        bindings?: BindingEntry[];
      };
      let tg = cfg.channels?.telegram ?? {};
      let currentBindings = (cfg.bindings ?? []) as BindingEntry[];

      // Check if migration is needed (flat config -> multi-account)
      if (needsMigration(tg)) {
        await migrateToMultiAccount(tg, currentBindings);

        // Re-fetch config after migration
        const postMigration = await gateway.request<{
          config: Record<string, unknown>;
          hash: string;
        }>("config.get", {});
        const postCfg = postMigration.config as {
          channels?: { telegram?: TelegramConfig };
          bindings?: BindingEntry[];
        };
        tg = postCfg.channels?.telegram ?? {};
        currentBindings = (postCfg.bindings ?? []) as BindingEntry[];
      }

      const accountId = botUsernameToAccountId(validatedUsername);

      // Build new account config
      const newAccount = {
        enabled: true,
        botToken: token.trim(),
        dmPolicy: "open",
        groupPolicy: "disabled",
      };

      // Build updated bindings
      const updatedBindings = buildUpdatedBindings(
        currentBindings,
        accountId,
        selectedAgentId,
      );

      // Single patchConfig call
      await patchConfig({
        channels: {
          telegram: {
            accounts: { [accountId]: newAccount },
          },
        },
        bindings: updatedBindings,
      });

      await waitForReconnect();
      onAdded();
      resetState();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[440px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            Add Telegram Bot
          </h2>
          <button
            onClick={handleClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg"
          >
            x
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Token input */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
              Bot Token
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  if (validationResult) setValidationResult(null);
                }}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyz..."
                disabled={isValidated}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-70"
                autoFocus
              />
              {!isValidated && (
                <button
                  onClick={handleValidate}
                  disabled={!tokenFormatValid || validating}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-accent)] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
                >
                  {validating && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  Validate
                </button>
              )}
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              Get a bot token from @BotFather on Telegram
            </p>
          </div>

          {/* Validation result */}
          {validationResult && !validationResult.valid && (
            <p className="text-xs text-[var(--color-error)]">
              {validationResult.error}
            </p>
          )}

          {/* Validated bot info + agent selection */}
          {isValidated && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                <CheckCircle
                  size={16}
                  className="text-[var(--color-success)] flex-shrink-0"
                />
                <span className="text-sm font-medium text-[var(--color-text)]">
                  @{validatedUsername}
                </span>
                <span className="text-xs text-[var(--color-success)]">
                  Verified
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                  * Agent
                </label>
                <select
                  value={selectedAgentId ?? ""}
                  onChange={(e) =>
                    setSelectedAgentId(e.target.value || null)
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
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
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Choose which agent handles messages from this bot
                </p>
              </div>
            </>
          )}

          {/* Error display */}
          {error && (
            <p className="text-xs text-[var(--color-error)]">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            Cancel
          </button>
          {isValidated && (
            <button
              onClick={handleSave}
              disabled={!selectedAgentId || saving}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && (
                <Loader2 size={14} className="animate-spin" />
              )}
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
