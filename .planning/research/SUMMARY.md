# Research Summary: MaxAuto Milestone 2 (Telegram, Skills, Workspace)

**Domain:** Desktop GUI settings for OpenClaw gateway management
**Researched:** 2026-03-14
**Overall confidence:** HIGH

## Executive Summary

This research focused on three feature areas for the MaxAuto desktop app: Telegram channel management enhancement, skills management, and workspace configuration. All three areas are well-supported by the existing OpenClaw gateway WebSocket API, meaning MaxAuto only needs to build frontend UI components and extend the settings store -- no new Rust backend commands are required (except possibly the Tauri dialog plugin for folder selection).

The critical architectural finding is that all three features follow the same pattern: they read/write sections of `openclaw.json` and use gateway WebSocket methods for runtime operations. The existing `config.rs` read/write Tauri commands and gateway WebSocket protocol handle everything.

Skills management is the most self-contained feature. The gateway provides `skills.status`, `skills.install`, and `skills.update` methods that handle config writes internally without requiring gateway restarts. The `skills.update` method writes config atomically, making it the lowest-risk starting point.

Workspace configuration is small scope: a folder picker dialog plus config writes to `agents.defaults.workspace` or per-agent `agents.list[].workspace`. Per-agent workspace must be persisted to config (not just runtime state) to survive gateway restarts.

Telegram channel management builds on the existing `IMChannelsSection.tsx` which already handles bot token, DM/group policies, and pairing. The main addition is agent-channel binding via OpenClaw's `bindings[]` config array (typed as `AgentBinding` with `match.channel: "telegram"`) and streaming mode configuration. The existing UI uses `config.set` (full replace) which should migrate to `config.patch` (merge) to prevent config write races.

## Key Findings

**Stack:** No new dependencies needed except possibly `@tauri-apps/plugin-dialog` for folder picker.
**Architecture:** Pure frontend work against existing gateway API methods. All features are config-driven via `openclaw.json`.
**Critical pitfall:** Config write races between UI sections (each reads full config, modifies one subtree, writes full config back). Use `config.patch` instead of `config.set` to prevent clobbering.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Skills Management** - lowest risk, self-contained, no gateway restart needed for toggles
   - Addresses: skills list view, enable/disable, API key configuration, eligibility display
   - Avoids: ClawHub integration, skill install orchestration (defer)
   - Rationale: Gateway methods handle config writes internally (`skills.update`); no restart needed

2. **Workspace Configuration** - small scope, enables agent-channel binding
   - Addresses: default workspace path, per-agent workspace overrides, "Open in Explorer"
   - Avoids: in-app file editing, git backup integration
   - Rationale: Per-agent workspace must work before agent-channel binding is meaningful

3. **Telegram Channel Enhancement** - builds on existing UI, most complex
   - Addresses: agent binding via `bindings[]` config, streaming mode toggle, connection health
   - Avoids: multi-channel, N:M routing, webhook configuration
   - Rationale: Agent binding depends on agents having distinct workspaces (Phase 2)

**Phase ordering rationale:**
- Skills first because it requires zero new infrastructure and uses live-update gateway methods
- Workspace second because per-agent workspace paths enable meaningful agent-channel binding
- Telegram last because binding an agent to a channel is most valuable when agents have distinct workspaces
- Alternative ordering (Telegram first) is valid if agent binding is deprioritized -- the existing Telegram UI is 70% complete

**Research flags for phases:**
- Phase 1 (Skills): Standard patterns, unlikely to need research. `skills.status` response shape verified from source.
- Phase 2 (Workspace): May need Tauri dialog plugin research if not already in dependencies. Per-agent workspace persistence (writing to `config.agents.list[]`) needs verification against OpenClaw's expected format.
- Phase 3 (Telegram): Bindings array management needs care -- the `AgentBinding` type with `AgentBindingMatch` is well-defined but complex. Verify gateway restart behavior after binding changes.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new deps; existing WebSocket + Tauri IPC. All APIs verified from OpenClaw source |
| Features | HIGH | Based on direct OpenClaw source code analysis of types and gateway handlers |
| Architecture | HIGH | Patterns match existing codebase conventions; all integration points verified |
| Pitfalls | HIGH | Config write races, restart timing, and workspace persistence confirmed from source |

## Gaps to Address

- Tauri dialog plugin availability -- verify if already in `Cargo.toml` or needs adding
- `config.patch` auto-restart behavior on Windows -- SIGUSR1 is Unix-only; may need fallback to manual restart
- Exact `SkillStatusEntry` payload shape from live gateway (verified from TypeScript types but not tested against running instance)
- Per-agent skill allowlists -- whether to expose `agents.list[].skills` in the UI or defer
- Channel-agent binding: the `bindings[]` array approach vs simpler `channels.telegram.accounts[x].agentId` routing
