import { patchConfig, waitForReconnect } from "./config-helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-account Telegram configuration fields. */
export interface TelegramAccountConfig {
  enabled?: boolean;
  botToken?: string;
  dmPolicy?: string;
  groupPolicy?: string;
  allowFrom?: Array<string | number>;
  groupAllowFrom?: Array<string | number>;
  groups?: Record<string, Record<string, unknown>>;
}

/**
 * Full Telegram channel config.
 * Extends account-level fields (legacy flat shape) with multi-account support.
 */
export interface TelegramConfig extends TelegramAccountConfig {
  accounts?: Record<string, TelegramAccountConfig>;
  defaultAccount?: string;
}

/** A binding entry from the root `bindings` array in openclaw.json. */
export interface BindingEntry {
  type?: string;
  agentId: string;
  comment?: string;
  match: { channel: string; accountId?: string; [key: string]: unknown };
}

// ---------------------------------------------------------------------------
// Account ID normalisation
// ---------------------------------------------------------------------------

/**
 * Convert a bot @username to a canonical account ID.
 *
 * Matches OpenClaw's `canonicalizeAccountId`:
 * - Strip leading `@`
 * - Lowercase
 * - Replace characters outside `[a-z0-9_-]` with `-`
 * - Collapse consecutive dashes
 * - Strip leading/trailing dashes
 * - Truncate to 64 characters
 * - Return `"default"` if result is empty
 */
export function botUsernameToAccountId(username: string): string {
  let id = username
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return id || "default";
}

// ---------------------------------------------------------------------------
// Config shape detection
// ---------------------------------------------------------------------------

/** Returns `true` if the config already uses the multi-account structure. */
export function isMultiAccountConfig(tg: TelegramConfig): boolean {
  return !!tg.accounts && Object.keys(tg.accounts).length > 0;
}

/**
 * Returns `true` if the config is a legacy flat single-bot shape that needs
 * migration when a second bot is added.
 *
 * Flat = has `botToken` at top level AND no `accounts` map (or empty).
 */
export function needsMigration(tg: TelegramConfig): boolean {
  return !!tg.botToken && !isMultiAccountConfig(tg);
}

// ---------------------------------------------------------------------------
// Config reading helpers
// ---------------------------------------------------------------------------

/**
 * Extract per-account configs from either the multi-account or legacy flat shape.
 *
 * - Multi-account: iterates `tg.accounts`
 * - Legacy flat with `botToken`: returns single entry keyed `"default"`
 * - Neither: returns empty map
 */
export function getAccountConfigs(
  tg: TelegramConfig,
): Map<string, TelegramAccountConfig> {
  const map = new Map<string, TelegramAccountConfig>();

  if (isMultiAccountConfig(tg)) {
    for (const [id, acct] of Object.entries(tg.accounts!)) {
      map.set(id, acct);
    }
    return map;
  }

  if (tg.botToken) {
    // Destructure out multi-account-only fields; keep the account-level ones
    const { accounts: _a, defaultAccount: _d, ...accountFields } = tg;
    map.set("default", accountFields);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Binding helpers
// ---------------------------------------------------------------------------

/**
 * Find the telegram binding for a specific account.
 *
 * Matches by `channel === "telegram"` AND:
 * - `accountId === accountId`, OR
 * - binding has no `accountId` and we're looking for `"default"`
 */
export function getTelegramBindingForAccount(
  bindings: BindingEntry[],
  accountId: string,
): BindingEntry | undefined {
  return bindings.find(
    (b) =>
      b.match?.channel === "telegram" &&
      (b.match.accountId === accountId ||
        (!b.match.accountId && accountId === "default")),
  );
}

/**
 * Build updated bindings array by replacing only the binding for `accountId`.
 *
 * 1. Filters out ONLY this account's telegram binding (by channel + accountId,
 *    including legacy no-accountId for "default").
 * 2. If `agentId` is provided, appends a new binding with `accountId` in match.
 * 3. Returns the full array (other channels and other accounts untouched).
 */
export function buildUpdatedBindings(
  allBindings: BindingEntry[],
  accountId: string,
  agentId: string | null,
): BindingEntry[] {
  // Filter out only this account's telegram binding
  const filtered = allBindings.filter(
    (b) =>
      !(
        b.match?.channel === "telegram" &&
        (b.match.accountId === accountId ||
          (!b.match.accountId && accountId === "default"))
      ),
  );

  if (agentId) {
    filtered.push({
      agentId,
      match: { channel: "telegram", accountId },
    });
  }

  return filtered;
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/** Account-level field keys to copy during migration. */
const ACCOUNT_FIELDS: (keyof TelegramAccountConfig)[] = [
  "enabled",
  "botToken",
  "dmPolicy",
  "groupPolicy",
  "allowFrom",
  "groupAllowFrom",
  "groups",
];

/**
 * Migrate a flat single-bot Telegram config to the multi-account structure.
 *
 * Builds a single `patchConfig` call that:
 * 1. Copies all flat account fields into `channels.telegram.accounts.default`
 * 2. Sets `channels.telegram.defaultAccount` to `"default"`
 * 3. Sets `channels.telegram.botToken` to `null` (merge-patch delete)
 * 4. Updates any telegram binding without `accountId` to include `accountId: "default"`
 * 5. Calls `patchConfig()` then `waitForReconnect()`
 */
export async function migrateToMultiAccount(
  existingConfig: TelegramConfig,
  existingBindings: BindingEntry[],
): Promise<void> {
  // Build the default account from existing flat fields
  const defaultAccount: Record<string, unknown> = {};
  for (const key of ACCOUNT_FIELDS) {
    if (existingConfig[key] !== undefined) {
      defaultAccount[key] = existingConfig[key];
    }
  }

  // Update bindings: add accountId to any telegram binding that lacks it
  const updatedBindings = existingBindings.map((b) => {
    if (b.match?.channel === "telegram" && !b.match.accountId) {
      return {
        ...b,
        match: { ...b.match, accountId: "default" },
      };
    }
    return b;
  });

  const patch: Record<string, unknown> = {
    channels: {
      telegram: {
        accounts: { default: defaultAccount },
        defaultAccount: "default",
        // Delete top-level botToken via merge-patch null to prevent
        // it from acting as a fallback for all accounts
        botToken: null,
      },
    },
    bindings: updatedBindings,
  };

  await patchConfig(patch);
  await waitForReconnect();
}
