import {
  UserCheck,
  UserX,
  RefreshCw,
  Clock,
  Plus,
} from "lucide-react";

// Brand icons as inline SVGs (lucide doesn't include brand logos)
function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function DiscordIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
    </svg>
  );
}

function SlackIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" />
    </svg>
  );
}

function WeChatIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zM14.53 13.39c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.969-.982z" />
    </svg>
  );
}
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  listPairingRequests,
  approvePairingRequest,
  rejectPairingRequest,
  type PairingRequest,
} from "@/api/tauri-commands";
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
        <h1 className="text-lg font-semibold text-foreground">
          {t("settings.channels.title")}
        </h1>
        <Button
          onClick={() => setShowAddDialog(true)}
          size="sm"
        >
          <Plus size={14} />
          {t("settings.channels.addBot")}
        </Button>
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
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-warning" />
              <h2 className="text-sm font-medium text-foreground">
                {t("settings.channels.pendingPairing")}
              </h2>
              {pairingRequests.length > 0 && (
                <Badge variant="warning" className="text-xs px-1.5 py-0.5 rounded-full">
                  {pairingRequests.length}
                </Badge>
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
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
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
                <p className="text-xs text-muted-foreground">
                  {t("settings.channels.noPairing")}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
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
                      className="flex items-center justify-between p-3 rounded-lg bg-background border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {displayName}
                          </span>
                          {username && (
                            <span className="text-xs text-muted-foreground">
                              @{username}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs font-mono text-primary">
                            {req.code}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ID: {req.id}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
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
                          className="p-1.5 rounded-md text-success hover:bg-success/10 transition-colors disabled:opacity-50"
                        >
                          <UserCheck size={16} />
                        </button>
                        <button
                          onClick={() => handleRejectPairing(req.code)}
                          disabled={isActing}
                          title={t("settings.channels.reject")}
                          className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
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
        </Card>
      </section>

      {/* Other Channels - Coming Soon */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          {t("settings.channels.otherChannels")}
        </h2>
        <div className="space-y-2">
          {[
            {
              name: t("settings.channels.whatsapp"),
              icon: <WhatsAppIcon size={20} />,
              desc: t("settings.channels.whatsappDesc"),
            },
            {
              name: t("settings.channels.discord"),
              icon: <DiscordIcon size={20} />,
              desc: t("settings.channels.discordDesc"),
            },
            {
              name: t("settings.channels.slack"),
              icon: <SlackIcon size={20} />,
              desc: t("settings.channels.slackDesc"),
            },
            {
              name: t("settings.channels.wechat"),
              icon: <WeChatIcon size={20} />,
              desc: t("settings.channels.wechatDesc"),
            },
          ].map((ch) => (
            <Card
              key={ch.name}
              className="flex items-center gap-3 px-4 py-3 opacity-60"
            >
              <span className="text-muted-foreground">{ch.icon}</span>
              <div className="flex-1">
                <p className="text-sm text-foreground">{ch.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ch.desc}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {t("common.comingSoon")}
              </span>
            </Card>
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
