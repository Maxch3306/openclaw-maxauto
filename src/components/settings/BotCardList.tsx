import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { gateway } from "../../api/gateway-client";
import {
  type TelegramConfig,
  type TelegramAccountConfig,
  type BindingEntry,
  getAccountConfigs,
} from "../../api/telegram-accounts";
import { BotCard } from "./BotCard";

/** Per-account status snapshot from channels.status probe. */
export interface ChannelAccountSnapshot {
  enabled?: boolean;
  configured?: boolean;
  linked?: boolean;
  connected?: boolean;
  running?: boolean;
  status?: string;
  label?: string;
  lastConnectedAt?: number;
  lastError?: string;
  lastStartAt?: number;
  lastStopAt?: number;
  lastInboundAt?: number;
  lastOutboundAt?: number;
  botTokenSource?: string;
  probe?: {
    ok: boolean;
    error?: string | null;
    elapsedMs: number;
    bot?: {
      id?: number | null;
      username?: string | null;
      canJoinGroups?: boolean | null;
      canReadAllGroupMessages?: boolean | null;
    };
  };
}

interface BotCardListProps {
  onAddBot: () => void;
  onRemoveBot: (accountId: string, username: string) => void;
}

export function BotCardList({ onAddBot, onRemoveBot }: BotCardListProps) {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Map<string, TelegramAccountConfig>>(
    new Map(),
  );
  const [statusMap, setStatusMap] = useState<
    Map<string, ChannelAccountSnapshot>
  >(new Map());
  const [allBindings, setAllBindings] = useState<BindingEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      // Load config
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
      setAccounts(accts);
      setAllBindings((cfg.bindings ?? []) as BindingEntry[]);

      // Load channel status
      const statusResult = await gateway.request<{
        channels?: Record<string, ChannelAccountSnapshot>;
        channelAccounts?: Record<
          string,
          | ChannelAccountSnapshot[]
          | Record<string, ChannelAccountSnapshot>
        >;
      }>("channels.status", { probe: true });

      const map = new Map<string, ChannelAccountSnapshot>();
      const tgAccounts = statusResult.channelAccounts?.telegram;
      if (tgAccounts) {
        if (Array.isArray(tgAccounts)) {
          // Array shape: match by label/username to account keys
          for (const snap of tgAccounts) {
            const username = snap.probe?.bot?.username;
            const label = snap.label;
            // Try to match against account keys
            const matchKey = [...accts.keys()].find(
              (k) =>
                k === label ||
                k === username?.toLowerCase() ||
                (k === "default" && accts.size === 1),
            );
            if (matchKey) {
              map.set(matchKey, snap);
            }
          }
        } else {
          // Record shape: keys match account IDs directly
          for (const [key, snap] of Object.entries(tgAccounts)) {
            map.set(key, snap);
          }
        }
      } else if (statusResult.channels?.telegram && accts.size === 1) {
        // Fallback: single-channel snapshot for single account
        const firstKey = accts.keys().next().value;
        if (firstKey) {
          map.set(firstKey, statusResult.channels.telegram);
        }
      }
      setStatusMap(map);
    } catch (err) {
      console.warn("[bot-card-list] reload failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-[var(--color-text-muted)]">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-sm">Loading bots...</span>
      </div>
    );
  }

  if (accounts.size === 0) {
    return (
      <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center">
        <p className="text-sm text-[var(--color-text)]">
          No Telegram bots configured
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Add a bot to connect your agent to Telegram
        </p>
        <button
          onClick={onAddBot}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-accent)] hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          Add Bot
        </button>
      </div>
    );
  }

  const accountEntries = [...accounts.entries()];

  return (
    <div className="space-y-3">
      {accountEntries.map(([accountId, config]) => (
        <BotCard
          key={accountId}
          accountId={accountId}
          config={config}
          status={statusMap.get(accountId) ?? null}
          boundAgentId={
            allBindings.find(
              (b) =>
                b.match?.channel === "telegram" &&
                (b.match.accountId === accountId ||
                  (!b.match.accountId && accountId === "default")),
            )?.agentId ?? null
          }
          allBindings={allBindings}
          expanded={expandedId === accountId}
          onToggleExpand={() =>
            setExpandedId((prev) => (prev === accountId ? null : accountId))
          }
          onRemove={() => {
            const username =
              statusMap.get(accountId)?.probe?.bot?.username ?? accountId;
            onRemoveBot(accountId, username);
          }}
          onReload={reload}
        />
      ))}
    </div>
  );
}
