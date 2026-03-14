import {
  Send,
  Smartphone,
  Gamepad2,
  Briefcase,
  MessageCircleHeart,
  UserCheck,
  UserX,
  RefreshCw,
  Clock,
} from "lucide-react";
import { useEffect, useState } from "react";
import { gateway } from "../../api/gateway-client";
import { patchConfig, waitForReconnect } from "../../api/config-helpers";
import {
  listPairingRequests,
  approvePairingRequest,
  rejectPairingRequest,
  type PairingRequest,
} from "../../api/tauri-commands";

interface TelegramConfig {
  enabled?: boolean;
  botToken?: string;
  dmPolicy?: string;
  groupPolicy?: string;
  allowFrom?: string[];
  groupAllowFrom?: string[];
}

interface ChannelAccountSnapshot {
  enabled?: boolean;
  configured?: boolean;
  linked?: boolean;
  status?: string;
  label?: string;
}

export function IMChannelsSection() {
  const [telegramCfg, setTelegramCfg] = useState<TelegramConfig>({});
  const [channelStatus, setChannelStatus] = useState<ChannelAccountSnapshot | null>(null);
  const [botToken, setBotToken] = useState("");
  const [dmPolicy, setDmPolicy] = useState("open");
  const [groupPolicy, setGroupPolicy] = useState("disabled");
  const [allowFrom, setAllowFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // Pairing state
  const [pairingRequests, setPairingRequests] = useState<PairingRequest[]>([]);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingAction, setPairingAction] = useState<string | null>(null);

  // Load config + status + pairing on mount
  useEffect(() => {
    void loadTelegramConfig();
    void loadChannelStatus();
    void loadPairingRequests();
  }, []);

  // Auto-refresh pairing requests every 10 seconds when pairing policy is active
  useEffect(() => {
    if (dmPolicy !== "pairing") {
      return;
    }
    const interval = setInterval(loadPairingRequests, 10000);
    return () => clearInterval(interval);
  }, [dmPolicy]);

  async function loadTelegramConfig() {
    try {
      const result = await gateway.request<{
        config: Record<string, unknown>;
        hash: string;
      }>("config.get", {});
      const cfg = result.config as {
        channels?: { telegram?: TelegramConfig };
      };
      const tg = cfg.channels?.telegram ?? {};
      setTelegramCfg(tg);
      setBotToken(tg.botToken ?? "");
      setDmPolicy(tg.dmPolicy ?? "open");
      setGroupPolicy(tg.groupPolicy ?? "disabled");
      setAllowFrom((tg.allowFrom ?? []).join(", "));
    } catch (err) {
      console.warn("[im-channels] loadTelegramConfig failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadChannelStatus() {
    try {
      const result = await gateway.request<{
        channels?: Record<string, unknown>;
        channelAccounts?: Record<string, Record<string, ChannelAccountSnapshot>>;
      }>("channels.status", { probe: false });
      const tgAccounts = result.channelAccounts?.telegram;
      if (tgAccounts) {
        const firstAccount = Object.values(tgAccounts)[0];
        setChannelStatus(firstAccount ?? null);
      }
    } catch (err) {
      console.warn("[im-channels] loadChannelStatus failed:", err);
    }
  }

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

  async function saveTelegramConfig() {
    setSaving(true);
    setSavedMsg("");
    try {
      const allowFromList = allowFrom
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const telegramConfig: TelegramConfig = {
        enabled: true,
        botToken: botToken.trim() || undefined,
        dmPolicy,
        groupPolicy,
        ...(allowFromList.length > 0 ? { allowFrom: allowFromList } : {}),
      };

      await patchConfig({
        channels: { telegram: telegramConfig },
      });

      setSavedMsg("Saved! Restarting gateway...");
      await waitForReconnect();
      await loadTelegramConfig();
      await loadChannelStatus();
      setSavedMsg("Saved and reconnected.");
    } catch (err) {
      setSavedMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function disableTelegram() {
    setSaving(true);
    try {
      await patchConfig({
        channels: { telegram: { enabled: false } },
      });

      setSavedMsg("Telegram disabled. Restarting gateway...");
      await waitForReconnect();
      await loadTelegramConfig();
      setSavedMsg("Telegram disabled and reconnected.");
    } catch (err) {
      setSavedMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  const isConfigured = !!telegramCfg.botToken;
  const isEnabled = telegramCfg.enabled !== false && isConfigured;
  const isPairingMode = dmPolicy === "pairing";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-[var(--color-text)]">Channels</h1>
      </div>

      {/* Telegram Card */}
      <section className="mb-6">
        <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <Send size={24} className="text-[var(--color-accent)]" />
              <div>
                <h2 className="text-sm font-medium text-[var(--color-text)]">Telegram</h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Connect a Telegram bot to chat with your agent
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {channelStatus?.linked && (
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-success)]/20 text-[var(--color-success)]">
                  Connected
                </span>
              )}
              {isEnabled && !channelStatus?.linked && (
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-warning)]/20 text-[var(--color-warning)]">
                  Configured
                </span>
              )}
              {!isConfigured && (
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-text-muted)]/20 text-[var(--color-text-muted)]">
                  Not Set Up
                </span>
              )}
            </div>
          </div>

          {/* Config Form */}
          <div className="px-4 py-4 space-y-4">
            {/* Bot Token */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                Bot Token
              </label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456789:ABCdefGhIjKlMnOpQrStUvWxYz..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
              />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Get a bot token from <span className="text-[var(--color-accent)]">@BotFather</span>{" "}
                on Telegram
              </p>
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
                <option value="open">Open — anyone can DM the bot</option>
                <option value="allowlist">Allowlist — only listed users</option>
                <option value="pairing">Pairing — users must pair first</option>
                <option value="disabled">Disabled — no DMs</option>
              </select>
            </div>

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
                <option value="open">Open — respond in any group</option>
                <option value="allowlist">Allowlist — only listed groups</option>
                <option value="disabled">Disabled — no group messages</option>
              </select>
            </div>

            {/* Allow From (shown for allowlist policies) */}
            {(dmPolicy === "allowlist" || groupPolicy === "allowlist") && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                  Allowed User/Group IDs
                </label>
                <input
                  type="text"
                  value={allowFrom}
                  onChange={(e) => setAllowFrom(e.target.value)}
                  placeholder="123456789, 987654321"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Comma-separated Telegram user or group IDs
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={saveTelegramConfig}
                disabled={saving || !botToken.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-accent)] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving..." : isConfigured ? "Update" : "Enable Telegram"}
              </button>
              {isEnabled && (
                <button
                  onClick={disableTelegram}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-error)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
                >
                  Disable
                </button>
              )}
            </div>

            {/* Save feedback */}
            {savedMsg && (
              <p
                className={`text-xs ${savedMsg.startsWith("Error") ? "text-[var(--color-error)]" : "text-[var(--color-success)]"}`}
              >
                {savedMsg}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Pairing Requests — shown when DM policy is "pairing" and Telegram is configured */}
      {isPairingMode && isConfigured && (
        <section className="mb-6">
          <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[var(--color-warning)]" />
                <h2 className="text-sm font-medium text-[var(--color-text)]">
                  Pending Pairing Requests
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
                  void loadPairingRequests().finally(() => setPairingLoading(false));
                }}
                disabled={pairingLoading}
                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw size={14} className={pairingLoading ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="px-4 py-3">
              {pairingRequests.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-[var(--color-text-muted)]">
                    No pending pairing requests
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    When someone messages your bot, they'll receive a pairing code. Their request
                    will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pairingRequests.map((req) => {
                    const meta = req.meta;
                    const displayName =
                      [meta?.firstName, meta?.lastName].filter(Boolean).join(" ") ||
                      meta?.username ||
                      req.id;
                    const username = meta?.username;
                    const createdAt = new Date(req.created_at);
                    const ageMin = Math.floor((Date.now() - createdAt.getTime()) / 60000);
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
                              {ageMin < 1 ? "just now" : ageMin < 60 ? `${ageMin}m ago` : "expired"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3">
                          <button
                            onClick={() => handleApprovePairing(req.code)}
                            disabled={isActing}
                            title="Approve"
                            className="p-1.5 rounded-md text-[var(--color-success)] hover:bg-[var(--color-success)]/10 transition-colors disabled:opacity-50"
                          >
                            <UserCheck size={16} />
                          </button>
                          <button
                            onClick={() => handleRejectPairing(req.code)}
                            disabled={isActing}
                            title="Reject"
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
      )}

      {/* Other Channels - Coming Soon */}
      <section>
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Other Channels</h2>
        <div className="space-y-2">
          {[
            {
              name: "WhatsApp",
              icon: <Smartphone size={20} />,
              desc: "Connect via WhatsApp Business",
            },
            { name: "Discord", icon: <Gamepad2 size={20} />, desc: "Add a Discord bot" },
            { name: "Slack", icon: <Briefcase size={20} />, desc: "Install as a Slack app" },
            {
              name: "WeChat",
              icon: <MessageCircleHeart size={20} />,
              desc: "Connect WeChat Official Account",
            },
          ].map((ch) => (
            <div
              key={ch.name}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] opacity-60"
            >
              <span className="text-[var(--color-text-muted)]">{ch.icon}</span>
              <div className="flex-1">
                <p className="text-sm text-[var(--color-text)]">{ch.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{ch.desc}</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">Coming Soon</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
