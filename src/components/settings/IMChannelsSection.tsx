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
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { gateway } from "../../api/gateway-client";
import { patchConfig, waitForReconnect } from "../../api/config-helpers";
import { TagInput } from "./TagInput";
import {
  listPairingRequests,
  approvePairingRequest,
  rejectPairingRequest,
  type PairingRequest,
} from "../../api/tauri-commands";
import { useChatStore } from "../../stores/chat-store";

interface TelegramConfig {
  enabled?: boolean;
  botToken?: string;
  dmPolicy?: string;
  groupPolicy?: string;
  allowFrom?: Array<string | number>;
  groupAllowFrom?: Array<string | number>;
  groups?: Record<string, Record<string, unknown>>;
}

interface BindingEntry {
  type?: string;
  agentId: string;
  comment?: string;
  match: { channel: string; [key: string]: unknown };
}

interface ChannelAccountSnapshot {
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

export function IMChannelsSection() {
  const [telegramCfg, setTelegramCfg] = useState<TelegramConfig>({});
  const [channelStatus, setChannelStatus] = useState<ChannelAccountSnapshot | null>(null);
  const [botToken, setBotToken] = useState("");
  const [dmPolicy, setDmPolicy] = useState("open");
  const [groupPolicy, setGroupPolicy] = useState("disabled");
  const [allowFromList, setAllowFromList] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [groupAllowFromList, setGroupAllowFromList] = useState<string[]>([]);
  const [loadedGroupIds, setLoadedGroupIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // Agent binding state
  const [boundAgentId, setBoundAgentId] = useState<string | null>(null);
  const [allBindings, setAllBindings] = useState<BindingEntry[]>([]);
  const agents = useChatStore((s) => s.agents);

  // Validation state
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    botUsername?: string;
    error?: string;
  } | null>(null);

  // Pairing state
  const [pairingRequests, setPairingRequests] = useState<PairingRequest[]>([]);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingAction, setPairingAction] = useState<string | null>(null);

  // Status refresh state
  const [refreshing, setRefreshing] = useState(false);

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
        bindings?: BindingEntry[];
      };
      const tg = cfg.channels?.telegram ?? {};
      setTelegramCfg(tg);
      setBotToken(tg.botToken ?? "");
      setDmPolicy(tg.dmPolicy ?? "open");
      setGroupPolicy(tg.groupPolicy ?? "disabled");
      setAllowFromList((tg.allowFrom ?? []).map(String));
      setGroupIds(Object.keys(tg.groups ?? {}));
      setGroupAllowFromList((tg.groupAllowFrom ?? []).map(String));
      setLoadedGroupIds(Object.keys(tg.groups ?? {}));

      // Read bindings for agent binding
      const bindings = cfg.bindings ?? [];
      const tgBinding = bindings.find((b) => b.match?.channel === "telegram");
      setBoundAgentId(tgBinding?.agentId ?? null);
      setAllBindings(bindings);
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
      }>("channels.status", { probe: true });
      const tgAccounts = result.channelAccounts?.telegram;
      if (tgAccounts) {
        // channelAccounts is Record<accountId, snapshot> — get first account (usually "default")
        const firstAccount = Object.values(tgAccounts)[0];
        if (firstAccount) {
          setChannelStatus(firstAccount);
        }
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

  async function validateBotToken(
    token: string
  ): Promise<{ valid: boolean; botUsername?: string; error?: string }> {
    const trimmed = token.trim();
    if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(trimmed)) {
      return {
        valid: false,
        error: "Invalid token format. Expected: 123456789:ABCdef...",
      };
    }
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${trimmed}/getMe`
      );
      const data = (await res.json()) as {
        ok?: boolean;
        description?: string;
        result?: { username?: string };
      };
      if (res.ok && data.ok) {
        return { valid: true, botUsername: data.result?.username };
      }
      return {
        valid: false,
        error: data.description ?? "Invalid bot token",
      };
    } catch {
      return {
        valid: false,
        error: "Could not reach Telegram API. Check your network.",
      };
    }
  }

  async function saveTelegramConfig() {
    setSaving(true);
    setSavedMsg("");

    // Validate token if it changed (skip if unchanged — already validated)
    const tokenChanged = botToken.trim() !== (telegramCfg.botToken ?? "");
    if (tokenChanged && botToken.trim()) {
      setValidating(true);
      setValidationResult(null);
      const result = await validateBotToken(botToken);
      setValidationResult(result);
      setValidating(false);
      if (!result.valid) {
        setSaving(false);
        return; // Do NOT save invalid token
      }
    }

    try {
      // Build groups Record with merge-patch deletion support
      const groupsRecord: Record<string, Record<string, unknown> | null> = {};
      for (const id of groupIds) { groupsRecord[id] = {}; }
      for (const id of loadedGroupIds) {
        if (!groupIds.includes(id)) { groupsRecord[id] = null; }  // delete via merge-patch
      }

      const telegramConfig: Record<string, unknown> = {
        enabled: true,
        botToken: botToken.trim() || undefined,
        dmPolicy,
        groupPolicy,
        allowFrom: allowFromList.length > 0 ? allowFromList : null,
        groupAllowFrom: groupAllowFromList.length > 0 ? groupAllowFromList : null,
        groups: Object.keys(groupsRecord).length > 0 ? groupsRecord : undefined,
      };

      const otherBindings = allBindings.filter((b) => b.match?.channel !== "telegram");
      const updatedBindings = boundAgentId
        ? [...otherBindings, { agentId: boundAgentId, match: { channel: "telegram" } }]
        : otherBindings;

      await patchConfig({
        channels: { telegram: telegramConfig },
        bindings: updatedBindings,
      });

      setSavedMsg("Saved! Restarting gateway...");
      await waitForReconnect();
      setLoadedGroupIds([...groupIds]);
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

  function getStatusDisplay(status: ChannelAccountSnapshot | null) {
    if (!isConfigured) {
      return { label: "Not Set Up", colorClass: "text-[var(--color-text-muted)]", dotClass: "bg-[var(--color-text-muted)]" };
    }
    if (!isEnabled) {
      return { label: "Disabled", colorClass: "text-[var(--color-text-muted)]", dotClass: "bg-[var(--color-text-muted)]" };
    }
    if (status?.lastError) {
      return { label: "Error", colorClass: "text-[var(--color-error)]", dotClass: "bg-[var(--color-error)]" };
    }
    if (status?.connected || status?.linked) {
      return { label: "Connected", colorClass: "text-[var(--color-success)]", dotClass: "bg-[var(--color-success)]" };
    }
    if (isConfigured && isEnabled) {
      return { label: "Disconnected", colorClass: "text-[var(--color-warning)]", dotClass: "bg-[var(--color-warning)]" };
    }
    return { label: "Unknown", colorClass: "text-[var(--color-text-muted)]", dotClass: "bg-[var(--color-text-muted)]" };
  }

  async function handleRefreshStatus() {
    setRefreshing(true);
    try {
      await loadChannelStatus();
    } finally {
      setRefreshing(false);
    }
  }

  const statusDisplay = getStatusDisplay(channelStatus);
  const probeBotUsername = channelStatus?.probe?.bot?.username;

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
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${statusDisplay.dotClass}`} />
                <span className={`text-xs font-medium ${statusDisplay.colorClass}`}>
                  {statusDisplay.label}
                </span>
              </div>
              {probeBotUsername && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  @{probeBotUsername}
                </span>
              )}
              <button
                onClick={handleRefreshStatus}
                disabled={refreshing}
                className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
                title="Refresh status"
              >
                <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Status Detail */}
          {isConfigured && channelStatus && (
            <div className="px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                {probeBotUsername && (
                  <span>Bot: <span className="text-[var(--color-text)] font-medium">@{probeBotUsername}</span></span>
                )}
                {channelStatus.lastConnectedAt && (
                  <span>Connected since: {new Date(channelStatus.lastConnectedAt).toLocaleString()}</span>
                )}
                {channelStatus.lastInboundAt && (
                  <span>Last message: {new Date(channelStatus.lastInboundAt).toLocaleString()}</span>
                )}
              </div>
              {channelStatus.lastError && (
                <p className="text-xs text-[var(--color-error)] mt-1">{channelStatus.lastError}</p>
              )}
            </div>
          )}

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
                onChange={(e) => {
                  setBotToken(e.target.value);
                  setValidationResult(null);
                }}
                placeholder="123456789:ABCdefGhIjKlMnOpQrStUvWxYz..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
              />
              {/* Validation feedback */}
              {validating && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Loader2 size={12} className="animate-spin text-[var(--color-accent)]" />
                  <span className="text-xs text-[var(--color-text-muted)]">Validating token...</span>
                </div>
              )}
              {validationResult && !validating && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  {validationResult.valid ? (
                    <>
                      <CheckCircle2 size={12} className="text-[var(--color-success)]" />
                      <span className="text-xs text-[var(--color-success)]">
                        Connected as @{validationResult.botUsername}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={12} className="text-[var(--color-error)]" />
                      <span className="text-xs text-[var(--color-error)]">
                        {validationResult.error}
                      </span>
                    </>
                  )}
                </div>
              )}
              {!validating && !validationResult && (
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Get a bot token from <span className="text-[var(--color-accent)]">@BotFather</span>{" "}
                  on Telegram
                </p>
              )}
            </div>

            {/* Agent Binding */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                Agent
              </label>
              <select
                value={boundAgentId ?? ""}
                onChange={(e) => setBoundAgentId(e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                <option value="">Select an agent...</option>
                {agents.map((a) => (
                  <option key={a.agentId} value={a.agentId}>
                    {a.emoji ? `${a.emoji} ` : ""}{a.name}
                  </option>
                ))}
              </select>
              {boundAgentId && !agents.some((a) => a.agentId === boundAgentId) && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <AlertTriangle size={12} className="text-[var(--color-warning)]" />
                  <span className="text-xs text-[var(--color-warning)]">
                    Bound agent no longer exists. Please select a different agent.
                  </span>
                </div>
              )}
              {!boundAgentId && (
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Choose which agent handles messages from this Telegram bot
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
                <option value="open">Open — anyone can DM the bot</option>
                <option value="allowlist">Allowlist — only listed users</option>
                <option value="pairing">Pairing — users must pair first</option>
                <option value="disabled">Disabled — no DMs</option>
              </select>
            </div>

            {/* DM Allow-List (shown when dmPolicy is allowlist) */}
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
                  Telegram user IDs allowed to message the bot directly. Find your ID by messaging @userinfobot on Telegram.
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
                <option value="open">Open — respond in any group</option>
                <option value="allowlist">Allowlist — only listed groups</option>
                <option value="disabled">Disabled — no group messages</option>
              </select>
            </div>

            {/* Allowed Groups (shown when groupPolicy is allowlist) */}
            {groupPolicy === "allowlist" && (
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
                  Group chat IDs where the bot will respond. Group IDs are negative numbers (e.g. -1001234567890). Add the bot to the group first.
                </p>
              </div>
            )}

            {/* Group Sender Allow-List (shown when groupPolicy is allowlist) */}
            {groupPolicy === "allowlist" && (
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
                  User IDs allowed to interact with the bot in group chats. Leave empty to allow all group members.
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
                {saving
                  ? validating
                    ? "Validating..."
                    : "Saving..."
                  : isConfigured
                    ? "Validate & Update"
                    : "Validate & Save"}
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
