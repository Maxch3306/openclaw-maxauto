# Domain Pitfalls

**Domain:** Adding Telegram channel management, skills management, and workspace configuration to a Tauri v2 desktop app wrapping OpenClaw
**Researched:** 2026-03-14

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Config Write Races Between UI Sections and Gateway

**What goes wrong:** The Telegram channel UI, skills UI, and workspace settings all need to read-modify-write `openclaw.json` via `config.get` / `config.set`. If two settings panels are open or a user rapidly switches between them, stale `baseHash` values cause `config.set` to silently overwrite changes made by the other panel. The current `IMChannelsSection` already does this -- it reads the full config, mutates the `channels.telegram` subtree, and writes the entire config back with the hash it fetched. If another section wrote config in between, those changes are lost.

**Why it happens:** The codebase uses a "read full config, merge one subtree, write full config" pattern in every settings section independently. There is no centralized config mutation layer, no retry-on-hash-mismatch, and the `CONCERNS.md` already flags this as a fragile area with no test coverage for write conflicts.

**Consequences:** User sets up Telegram bot token, switches to skills to enable a skill, and the skill config write overwrites the Telegram config (or vice versa). User has to reconfigure from scratch. Worse: the bot token could be silently lost, and the user discovers this only when Telegram stops working.

**Prevention:**
1. Use `config.patch` (merge semantics) instead of `config.set` (replace semantics) -- the gateway protocol supports it. This lets each section write only its subtree without clobbering others.
2. If `config.set` must be used, implement a centralized `configMutator` that serializes all config writes through a single queue with automatic hash refresh before each write.
3. On hash mismatch error from the gateway, re-read config, re-apply the mutation, and retry (max 3 attempts).

**Detection:** Test by rapidly saving Telegram config and skills config in alternation. If either section's changes disappear after the other saves, the race exists.

**Phase relevance:** Must be solved before building any new settings section (Telegram, Skills, or Workspace). This is a prerequisite for all three features.

---

### Pitfall 2: Gateway Restart Destroys Active Telegram Connection

**What goes wrong:** The current `saveTelegramConfig()` and `writeConfigAndRestart()` both fully stop and restart the gateway process after every config change. This kills the active Telegram long-polling connection. If the user is configuring Telegram settings iteratively (common during first setup), each save causes a full gateway restart (1.5s stop + 3s start + 2s reconnect = 6.5s minimum), and the Telegram bot goes offline during each restart.

**Why it happens:** The codebase has no concept of "hot config reload." Every config change triggers a full process restart via `stopGateway()` / `startGateway()`. The hardcoded delays (1.5s, 3s, 2s) in `writeConfigAndRestart()` are already flagged in `CONCERNS.md` as fragile.

**Consequences:** Poor UX during Telegram setup. Users may think the bot is broken because it drops offline for 6+ seconds after each save. On slow machines, the gateway may not be ready when the fixed timeout expires, causing "gateway not connected" errors in the UI.

**Prevention:**
1. Use `config.apply` with `restartDelayMs` parameter instead of manually stopping/starting the gateway. The gateway protocol supports `config.apply` which handles restart internally with proper sequencing.
2. For settings that do not require a restart (e.g., updating `allowFrom` list), use `config.patch` without any restart.
3. Replace fixed `setTimeout` delays with event-based readiness detection: listen for the `gateway-log` event containing a "ready" marker, or poll `channels.status` until Telegram shows as connected.

**Detection:** Time the save-to-reconnected cycle. If it exceeds 3 seconds or fails intermittently on slower hardware, the restart logic is too fragile.

**Phase relevance:** Should be fixed in the Telegram channel management phase, before adding skills/workspace (which will also need config writes).

---

### Pitfall 3: Telegram allowFrom/groupAllowFrom Confusion in UI

**What goes wrong:** OpenClaw's Telegram access control has a notoriously confusing split between `allowFrom` (DM user IDs), `groupAllowFrom` (group sender user IDs), and `groups` (group chat IDs, which are negative numbers). The current UI merges all of these into a single "Allowed User/Group IDs" text input, which is incorrect. Users will paste negative group chat IDs into `allowFrom` (which only accepts user IDs) or paste user IDs into the groups config where negative chat IDs belong.

**Why it happens:** The Telegram docs themselves include a warning about this exact confusion: "groupAllowFrom is not a Telegram group allowlist." The current UI does not distinguish these three separate concepts.

**Consequences:** Users configure access control incorrectly, resulting in either: (a) the bot ignoring all group messages because group IDs are in `allowFrom` instead of `groups`, or (b) all users being blocked from groups because user IDs are in the wrong field. Debugging this is extremely frustrating because the bot appears to work in DMs but silently ignores groups.

**Prevention:**
1. Separate the UI into three distinct sections: "DM Access" (allowFrom with user IDs), "Allowed Groups" (groups with negative chat IDs), and "Group Sender Access" (groupAllowFrom with user IDs).
2. Validate input: user IDs are positive integers, group IDs are negative integers (prefixed with -100 for supergroups). Show inline validation errors.
3. Provide guidance text explaining each field's purpose, with examples from the OpenClaw docs.
4. Add a "Test Connection" button that calls `channels.status` with `probe: true` to verify the bot can reach Telegram and see configured groups.

**Detection:** User reports "bot works in DMs but not groups" -- almost always an allowFrom/groups/groupAllowFrom misconfiguration.

**Phase relevance:** Telegram channel management phase. Must be designed correctly from the start to avoid user confusion.

---

### Pitfall 4: Skills Install Runs on Gateway's Platform, Not UI's Expectation

**What goes wrong:** The skills system in OpenClaw determines install methods based on the platform where the gateway runs (`process.platform`). Since MaxAuto spawns OpenClaw as a child process on the same machine, this is currently the same platform. However, the `skills.install` gateway method installs binaries (brew, npm, uv, go) into the system or into OpenClaw's managed environment. If the UI does not account for: (a) which package managers are available, (b) whether installation requires elevated privileges, or (c) whether the installed binary ends up on the gateway's PATH, skills will appear to install successfully but fail silently at runtime.

**Why it happens:** The `skills-status.ts` code checks `hasBinary()` for local availability and filters install options by OS. But MaxAuto's isolated environment (`~/.openclaw-maxauto/`) uses its own Node.js -- the gateway process may not have `brew`, `go`, or `uv` on its PATH because MaxAuto sets up an isolated environment with custom PATH.

**Consequences:** User clicks "Install skill" in the UI, the gateway attempts `brew install X` or `npm install -g X`, and either: (a) the command fails because brew/go/uv is not available in the isolated environment, (b) the binary installs globally but the gateway process cannot find it because its PATH is restricted to `~/.openclaw-maxauto/`, or (c) the installation succeeds but requires a gateway restart to pick up the new binary.

**Prevention:**
1. Before showing install options, call `skills.status` which returns the `install` array with available install methods. Only show install methods that the gateway reports as viable.
2. After `skills.install` completes, re-fetch `skills.status` to verify the skill's `eligible` flag is now true. If not, show a diagnostic message.
3. For skills requiring system binaries not in the isolated environment, show a manual installation guide instead of a one-click button.
4. Consider adding the system PATH to the gateway's environment so it can find globally installed tools.

**Detection:** After installing a skill, check `skills.status` -- if `eligible` is still false and `missing` lists bins, the install did not work as expected.

**Phase relevance:** Skills management phase. Must be understood before building the install UI.

---

### Pitfall 5: Per-Agent Workspace Creates but Never Persists in Config

**What goes wrong:** The chat store's `createAgent()` function generates a workspace path (`~/.openclaw-maxauto/workspace-{agentId}`) and passes it to `agents.create`. However, `setAgentModel()` only persists `agents.defaults.model` globally -- it never writes per-agent workspace to the config. The `CONCERNS.md` already flags this: "per-agent workspace configuration is unused; all agents share default workspace." If the workspace settings UI exposes per-agent workspace editing, changes will appear to save but will not survive a gateway restart because they are never written to `openclaw.json`.

**Why it happens:** OpenClaw stores per-agent config in `config.agents.list[].workspace` or `config.agents.perAgent.{agentId}.workspace`, but MaxAuto's `setAgentModel()` only writes to `agents.defaults`. The workspace path is passed during `agents.create` (which sets it on the gateway's runtime state), but runtime state is lost on restart.

**Consequences:** User configures a custom workspace for an agent, restarts the app, and the agent reverts to the default workspace. Files created in the custom workspace become orphaned.

**Prevention:**
1. When updating an agent's workspace, write it to `config.agents.list` or `config.agents.perAgent.{agentId}.workspace` via `config.patch`, not just via the `agents.update` runtime call.
2. Use `agents.update` for runtime changes AND `config.patch` for persistent config changes. Both are needed.
3. On app startup, reconcile: compare `agents.list` runtime workspaces with persisted config workspaces and warn if they diverge.

**Detection:** Change an agent's workspace, restart the gateway, then check `agents.list` -- if the workspace reverted, persistence is broken.

**Phase relevance:** Workspace settings phase. Must be addressed before exposing workspace editing in the UI.

## Moderate Pitfalls

### Pitfall 6: Telegram Bot Token Stored in Plaintext Config

**What goes wrong:** The `saveTelegramConfig()` function writes the bot token directly into `openclaw.json` as plaintext (`botToken: "123:abc"`). The `CONCERNS.md` already flags gateway tokens and API keys as security concerns. Telegram bot tokens are permanent credentials that grant full control of the bot.

**Prevention:**
1. OpenClaw supports `SecretRef` type for sensitive fields and `tokenFile` for reading tokens from a file. Use `tokenFile` pointing to a separate credentials file in `~/.openclaw-maxauto/credentials/telegram-token` with restrictive file permissions.
2. At minimum, do not display the full token in the UI after initial entry. Show a masked version (e.g., `123:***...xyz`).
3. Consider using Tauri's plugin-keyring for platform-native secret storage.

**Phase relevance:** Telegram channel management phase.

---

### Pitfall 7: Skills Status Shows Bundled Skills That Cannot Be Modified

**What goes wrong:** OpenClaw has 50+ bundled skills that are always present. The `skills.status` response includes all of them with their `bundled: true` flag. If the skills management UI shows all 50+ skills as a flat list with toggle switches, users will be overwhelmed. Worse, some bundled skills have `always: true` (cannot be disabled) or `blockedByAllowlist: true` (disabled by admin policy). If the UI shows toggle switches for these, users will click them and nothing will happen.

**Prevention:**
1. Group skills by category: "Active" (eligible + enabled), "Available" (eligible + disabled), "Requires Setup" (missing requirements), and "Restricted" (blocked by allowlist or always-on).
2. For `always: true` skills, show them as informational only (no toggle).
3. For skills with `missing` requirements (bins or env vars), show what is needed before the toggle can be enabled.
4. For skills with `configChecks`, show which config paths need to be set.
5. Implement search/filter since 50+ skills is too many to browse.

**Phase relevance:** Skills management phase.

---

### Pitfall 8: Channel-Agent Binding Requires Config AND Runtime Coordination

**What goes wrong:** The PROJECT.md specifies "1:1 mapping of Telegram bot to agent." OpenClaw supports this via per-topic `agentId` routing and via `bindings[]` config. But simply setting `agentId` in the Telegram topic config is not enough -- the agent must exist, have a workspace, and the session key format changes when a non-default agent is routed (`agent:{id}:telegram:...`). If the UI allows binding a Telegram channel to an agent but does not verify the agent exists or handle the session key change, messages will fail silently.

**Prevention:**
1. When creating a channel-agent binding, verify the agent exists via `agents.list` before writing the binding config.
2. Use the simplest binding mechanism first: set `channels.telegram.dmPolicy` agent routing via config, not the complex `bindings[]` array (which is designed for ACP/persistent harness scenarios).
3. For DM-to-agent routing, the most straightforward approach is the default agent (`agents.defaults.id`), not per-channel binding. Only introduce per-channel binding if multi-agent is truly needed.
4. Test the full flow: create agent, bind to Telegram, send a DM, verify the correct agent handles it and the session appears under that agent.

**Phase relevance:** Telegram channel management phase (channel-agent binding feature).

---

### Pitfall 9: Workspace Path Validation on Windows vs macOS

**What goes wrong:** MaxAuto targets both Windows and macOS. Workspace paths have different constraints: Windows has 260-char path limits (unless long paths are enabled), uses backslashes, and has reserved characters (`<>:"|?*`). macOS uses forward slashes and has different case sensitivity rules. If the workspace settings UI accepts any path string without validation, users will enter paths that work on one platform but fail on the other, or paths that are too long for Windows.

**Prevention:**
1. Default to `~/.openclaw-maxauto/workspace-{agentId}` and only allow customization within a constrained set of locations (e.g., under the user's home directory).
2. Validate paths before saving: check for invalid characters per platform, check path length on Windows, verify the parent directory exists.
3. Use Tauri's `dialog.open()` with `directory: true` for path selection instead of free-text input. This ensures the selected path is valid on the current platform.
4. Store paths using forward slashes internally and convert at the Rust layer, since OpenClaw (Node.js) normalizes to forward slashes.

**Phase relevance:** Workspace settings phase.

---

### Pitfall 10: Skills Update (Enable/Disable/API Key) Writes Config Without Hash Check

**What goes wrong:** The `skills.update` gateway method directly calls `writeConfigFile()` without using `baseHash` for optimistic locking. If a skill toggle is clicked while another config write is in flight (e.g., from the settings store), the writes conflict. Unlike `config.set` which supports `baseHash`, `skills.update` bypasses the hash mechanism entirely.

**Prevention:**
1. For skill enable/disable toggles, use `config.patch` with `baseHash` from the settings store instead of `skills.update`. This integrates with the existing optimistic locking.
2. If using `skills.update`, serialize it through the same config write queue as other config operations (see Pitfall 1).
3. After any `skills.update` call, reload the full config to refresh the hash.

**Phase relevance:** Skills management phase.

## Minor Pitfalls

### Pitfall 11: Telegram Channel Status Probe Timeout

**What goes wrong:** The `channels.status` call with `probe: true` makes a live API call to Telegram's servers to verify the bot token. This has a default 10-second timeout. If the user's network is slow or Telegram's API is rate-limited, the probe hangs and the UI appears frozen.

**Prevention:** Always call `channels.status` with `probe: false` for initial page load (fast, config-only status). Offer a separate "Test Connection" button that calls with `probe: true` and shows a loading spinner with a timeout message.

**Phase relevance:** Telegram channel management phase.

---

### Pitfall 12: Skills Install is Async and Can Be Long-Running

**What goes wrong:** The `skills.install` method downloads and installs packages, which can take 30+ seconds for large dependencies. If the UI does not show progress or allow cancellation, users will click the install button again (causing duplicate installs) or navigate away (losing track of the installation).

**Prevention:**
1. Show a progress indicator during installation.
2. Disable the install button while an installation is in progress.
3. Set a reasonable `timeoutMs` parameter (the `skills.install` method supports it).
4. After installation completes, automatically refresh `skills.status` to update the UI.

**Phase relevance:** Skills management phase.

---

### Pitfall 13: Telegram Groups Config Uses Negative String IDs

**What goes wrong:** Telegram group chat IDs are negative numbers (e.g., `-1001234567890`). In JSON config, these must be string keys in the `groups` object: `"groups": { "-1001234567890": { ... } }`. If the UI converts these to numbers or strips the negative sign, the config becomes invalid and the gateway ignores the group configuration.

**Prevention:** Always treat group IDs as strings. Validate that group IDs start with `-` and contain only digits after the minus sign. Display them with the minus sign visible.

**Phase relevance:** Telegram channel management phase (if group configuration is added).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Telegram channel setup | Config write races (Pitfall 1) | Implement centralized config mutation queue before building the UI |
| Telegram channel setup | Gateway restart on every save (Pitfall 2) | Use `config.apply` or `config.patch` instead of stop/start cycle |
| Telegram channel setup | allowFrom/groupAllowFrom confusion (Pitfall 3) | Separate UI fields with validation and examples |
| Telegram channel setup | Bot token in plaintext (Pitfall 6) | Use `tokenFile` or credentials file |
| Channel-agent binding | Agent must exist before binding (Pitfall 8) | Validate agent existence, use simplest binding mechanism |
| Skills management | Install fails in isolated env (Pitfall 4) | Check `skills.status` install options, verify post-install |
| Skills management | 50+ skills overwhelm UI (Pitfall 7) | Group by status, add search/filter |
| Skills management | Config write conflicts (Pitfall 10) | Serialize through config mutation queue |
| Skills management | Long-running installs (Pitfall 12) | Progress indicator, disable button, set timeout |
| Workspace settings | Per-agent workspace not persisted (Pitfall 5) | Write to config, not just runtime |
| Workspace settings | Cross-platform path issues (Pitfall 9) | Use file picker dialog, validate per platform |

## Sources

- OpenClaw Telegram channel documentation: `openclaw/docs/channels/telegram.md` (HIGH confidence -- primary source, included in repo)
- OpenClaw gateway server methods: `openclaw/src/gateway/server-methods/skills.ts`, `channels.ts` (HIGH confidence -- source code)
- OpenClaw skills status system: `openclaw/src/agents/skills-status.ts` (HIGH confidence -- source code)
- MaxAuto gateway protocol: `docs/gateway-protocol.md` (HIGH confidence -- project documentation)
- MaxAuto existing implementations: `src/components/settings/IMChannelsSection.tsx`, `src/stores/settings-store.ts`, `src/stores/chat-store.ts`, `src-tauri/src/commands/pairing.rs`, `src-tauri/src/commands/config.rs` (HIGH confidence -- project source)
- MaxAuto known concerns: `.planning/codebase/CONCERNS.md` (HIGH confidence -- project audit)
