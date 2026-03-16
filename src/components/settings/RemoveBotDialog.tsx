import { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { gateway } from "@/api/gateway-client";
import {
  type TelegramConfig,
  type TelegramAccountConfig,
  type BindingEntry,
  buildUpdatedBindings,
  getAccountConfigs,
  getTelegramBindingForAccount,
  isMultiAccountConfig,
} from "@/api/telegram-accounts";
import { patchConfig, waitForReconnect } from "@/api/config-helpers";
import { useChatStore } from "@/stores/chat-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Remove Telegram Bot</DialogTitle>
          <DialogDescription className="sr-only">
            Confirm removal of Telegram bot {displayUsername}
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="space-y-4">
          {/* Warning icon */}
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle
                size={24}
                className="text-destructive"
              />
            </div>
          </div>

          {/* Bot info */}
          <p className="text-sm text-center text-foreground">
            Are you sure you want to remove{" "}
            <span className="font-semibold">{displayUsername}</span>?
          </p>

          {/* Impact summary */}
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2
                size={14}
                className="animate-spin text-muted-foreground"
              />
            </div>
          ) : (
            summary && (
              <Card className="p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Bot
                  </span>
                  <span className="text-foreground">
                    {displayUsername}
                  </span>
                </div>
                {summary.boundAgentName && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Bound Agent
                    </span>
                    <span className="text-foreground">
                      {summary.boundAgentName}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    DM Policy
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {summary.dmPolicy}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Group Policy
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {summary.groupPolicy}
                  </Badge>
                </div>
                {(summary.allowFromCount > 0 ||
                  summary.groupAllowFromCount > 0) && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Access List Entries
                    </span>
                    <span className="text-foreground">
                      {summary.allowFromCount + summary.groupAllowFromCount}
                    </span>
                  </div>
                )}
              </Card>
            )
          )}

          {/* Warning text */}
          <p className="text-xs text-muted-foreground text-center">
            This will permanently remove the bot configuration and its agent
            binding. This cannot be undone.
          </p>

          {/* Error display */}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        {/* Footer */}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRemove}
            disabled={removing}
          >
            {removing && (
              <Loader2 size={14} className="animate-spin" />
            )}
            {removing ? "Removing..." : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
