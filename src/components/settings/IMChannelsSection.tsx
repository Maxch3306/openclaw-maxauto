import {
  Smartphone,
  Gamepad2,
  Briefcase,
  MessageCircleHeart,
  UserCheck,
  UserX,
  RefreshCw,
  Clock,
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listPairingRequests,
  approvePairingRequest,
  rejectPairingRequest,
  type PairingRequest,
} from "../../api/tauri-commands";
import { BotCardList } from "./BotCardList";
import { AddBotDialog } from "./AddBotDialog";
import { RemoveBotDialog } from "./RemoveBotDialog";

export function IMChannelsSection() {
  const { t } = useTranslation();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    accountId: string;
    username: string;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Pairing state
  const [pairingRequests, setPairingRequests] = useState<PairingRequest[]>([]);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingAction, setPairingAction] = useState<string | null>(null);

  useEffect(() => {
    void loadPairingRequests();
  }, []);

  // Auto-refresh pairing requests every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadPairingRequests, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadPairingRequests() {
    try {
      const requests = await listPairingRequests();
      setPairingRequests(requests);
    } catch (err) {
      console.warn("[im-channels] loadPairingRequests failed:", err);
    }
  }

  async function handleApprovePairing(code: string) {
    setPairingAction(code);
    try {
      const userId = await approvePairingRequest(code);
      console.log("[im-channels] Approved pairing for user:", userId);
      await loadPairingRequests();
    } catch (err) {
      console.error("[im-channels] approvePairing failed:", err);
    } finally {
      setPairingAction(null);
    }
  }

  async function handleRejectPairing(code: string) {
    setPairingAction(code);
    try {
      await rejectPairingRequest(code);
      await loadPairingRequests();
    } catch (err) {
      console.error("[im-channels] rejectPairing failed:", err);
    } finally {
      setPairingAction(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-[var(--color-text)]">
          {t("settings.channels.title")}
        </h1>
        <button
          onClick={() => setShowAddDialog(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--color-accent)] hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          {t("settings.channels.addBot")}
        </button>
      </div>

      {/* Telegram Bot Cards */}
      <section className="mb-6">
        <BotCardList
          key={reloadKey}
          onAddBot={() => setShowAddDialog(true)}
          onRemoveBot={(accountId, username) =>
            setRemoveTarget({ accountId, username })
          }
        />
      </section>

      {/* Pairing Requests */}
      <section className="mb-6">
        <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[var(--color-warning)]" />
              <h2 className="text-sm font-medium text-[var(--color-text)]">
                {t("settings.channels.pendingPairing")}
              </h2>
              {pairingRequests.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--color-warning)]/20 text-[var(--color-warning)] font-medium">
                  {pairingRequests.length}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setPairingLoading(true);
                void loadPairingRequests().finally(() =>
                  setPairingLoading(false),
                );
              }}
              disabled={pairingLoading}
              className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
              title={t("settings.channels.refresh")}
            >
              <RefreshCw
                size={14}
                className={pairingLoading ? "animate-spin" : ""}
              />
            </button>
          </div>

          <div className="px-4 py-3">
            {pairingRequests.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t("settings.channels.noPairing")}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  {t("settings.channels.pairingHint")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pairingRequests.map((req) => {
                  const meta = req.meta;
                  const displayName =
                    [meta?.firstName, meta?.lastName]
                      .filter(Boolean)
                      .join(" ") ||
                    meta?.username ||
                    req.id;
                  const username = meta?.username;
                  const createdAt = new Date(req.created_at);
                  const ageMin = Math.floor(
                    (Date.now() - createdAt.getTime()) / 60000,
                  );
                  const isActing = pairingAction === req.code;

                  return (
                    <div
                      key={req.code}
                      className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-text)] truncate">
                            {displayName}
                          </span>
                          {username && (
                            <span className="text-xs text-[var(--color-text-muted)]">
                              @{username}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs font-mono text-[var(--color-accent)]">
                            {req.code}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            ID: {req.id}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {ageMin < 1
                              ? t("settings.channels.justNow")
                              : ageMin < 60
                                ? t("settings.channels.minutesAgo", { count: ageMin })
                                : t("settings.channels.expired")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-3">
                        <button
                          onClick={() => handleApprovePairing(req.code)}
                          disabled={isActing}
                          title={t("settings.channels.approve")}
                          className="p-1.5 rounded-md text-[var(--color-success)] hover:bg-[var(--color-success)]/10 transition-colors disabled:opacity-50"
                        >
                          <UserCheck size={16} />
                        </button>
                        <button
                          onClick={() => handleRejectPairing(req.code)}
                          disabled={isActing}
                          title={t("settings.channels.reject")}
                          className="p-1.5 rounded-md text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors disabled:opacity-50"
                        >
                          <UserX size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Other Channels - Coming Soon */}
      <section>
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">
          {t("settings.channels.otherChannels")}
        </h2>
        <div className="space-y-2">
          {[
            {
              name: t("settings.channels.whatsapp"),
              icon: <Smartphone size={20} />,
              desc: t("settings.channels.whatsappDesc"),
            },
            {
              name: t("settings.channels.discord"),
              icon: <Gamepad2 size={20} />,
              desc: t("settings.channels.discordDesc"),
            },
            {
              name: t("settings.channels.slack"),
              icon: <Briefcase size={20} />,
              desc: t("settings.channels.slackDesc"),
            },
            {
              name: t("settings.channels.wechat"),
              icon: <MessageCircleHeart size={20} />,
              desc: t("settings.channels.wechatDesc"),
            },
          ].map((ch) => (
            <div
              key={ch.name}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] opacity-60"
            >
              <span className="text-[var(--color-text-muted)]">{ch.icon}</span>
              <div className="flex-1">
                <p className="text-sm text-[var(--color-text)]">{ch.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {ch.desc}
                </p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">
                {t("common.comingSoon")}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Dialogs */}
      {showAddDialog && (
        <AddBotDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onAdded={() => {
            setShowAddDialog(false);
            setReloadKey((k) => k + 1);
          }}
          existingAccountIds={[]}
        />
      )}
      {removeTarget && (
        <RemoveBotDialog
          open={!!removeTarget}
          accountId={removeTarget.accountId}
          username={removeTarget.username}
          onClose={() => setRemoveTarget(null)}
          onRemoved={() => {
            setRemoveTarget(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
