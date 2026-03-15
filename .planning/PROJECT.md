# MaxAuto

## What This Is

A vendor-free, open-source desktop app that wraps OpenClaw. No login, no credits, no vendor lock-in — just a double-click installer that manages OpenClaw's setup and provides a polished GUI for managing AI agents, messaging channels, and skills.

## Core Value

Users can install, configure, and use OpenClaw without touching a terminal or reading documentation — everything is managed through a clean desktop UI.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ First-run setup flow — auto-installs Git, Node.js 24, OpenClaw
- ✓ Gateway lifecycle management — start/stop/restart OpenClaw gateway as child process
- ✓ Device identity — Ed25519 keypair per device for authenticated WebSocket
- ✓ WebSocket protocol (v3) — connect, authenticate, request/response, event streaming
- ✓ Chat with agents — send messages, stream responses, view tool call UI cards
- ✓ Agent CRUD — create, edit (name/emoji), delete, set per-agent model
- ✓ Session management — per-agent chat sessions, history loading
- ✓ Model provider management — add/configure providers with API keys, built-in provider defaults
- ✓ Bailian Coding quick setup — one-click multi-vendor config via single API key
- ✓ Settings UI — General, Models & API, Channels, Skills, Workspace, About sections
- ✓ System tray — tray icon with menu
- ✓ Auto-updates — check/download/install via GitHub Releases
- ✓ Telegram pairing — approve/reject pairing requests with 1hr TTL
- ✓ Config infrastructure — merge-patch semantics via patchConfig()
- ✓ Skills discovery — card grid with status badges, grouped by category
- ✓ Skills control — toggle on/off, API key input with masked reveal
- ✓ Skills installation — install dependencies from UI
- ✓ Workspace defaults — view/change/open default workspace via folder picker
- ✓ Per-agent workspace — assign workspace directories per agent
- ✓ Telegram bot setup — token validation via getMe, connection status display
- ✓ Telegram access control — tag-based DM/group/sender allow-lists
- ✓ Channel-agent binding — 1:1 mapping of Telegram bot to agent

- ✓ Multi-bot Telegram — add/remove multiple Telegram bot accounts — v1.1
- ✓ Strict 1:1 binding enforcement — one bot per agent, one agent per bot — v1.1
- ✓ Per-bot access control and connection status — v1.1

### Active

<!-- Current scope. Building toward these. -->

(None — planning next milestone)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- MCP service management — defer until skills management is solid
- Mobile app — desktop-first product

## Shipped Milestones

- **v1.0 MVP** — Phases 1-9: Config infrastructure, skills management, workspace management, Telegram channel management (shipped 2026-03-14)
- **v1.1 Multi-Bot Telegram** — Phases 10-12: Multi-bot config foundation, bot account management, per-bot access control (shipped 2026-03-15)

## Context

- OpenClaw is the upstream runtime — MaxAuto manages its lifecycle but doesn't modify it
- All runtime files isolated under `~/.openclaw-maxauto/` (node, git, openclaw, config, credentials, sessions, workspace)
- OpenClaw gateway config lives at `~/.openclaw-maxauto/config/openclaw.json`
- Settings UI has 9 sections — General, Models & API, MCP Services, Skills, Channels, Workspace, Data & Privacy, Feedback, About
- Implemented sections: General, Models & API, Skills (discovery/toggle/install), Channels (multi-bot Telegram), Workspace (default + per-agent), About
- Remaining placeholders: MCP Services, Data & Privacy, Feedback
- OpenClaw supports 50+ built-in skills and multiple IM channels natively
- 41 TS/TSX files, 26 Rust files

## Constraints

- **Tech stack**: Tauri v2 (Rust) + React 19 + TypeScript — established, no changes
- **Communication**: All agent/chat/config operations go through OpenClaw gateway WebSocket or Tauri IPC
- **Isolation**: Must not touch global Node.js/Git/OpenClaw installations
- **Platform**: Windows (.msi) + macOS (.dmg)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Telegram first | Most common channel for OpenClaw users, pairing backend already exists | ✓ Good |
| 1:1 channel-agent binding | Simpler UX, avoids complex routing rules | ✓ Good — expanding to multi-bot in v1.1 |
| Full in-app Telegram setup | No need to leave the app, better onboarding experience | ✓ Good |
| Install & toggle for skills | Users need both discovery and control over skill packages | ✓ Good |

| Multi-bot Telegram | Most requested feature after single-bot, OpenClaw already supports accounts | ✓ Good — clean decomposition |

---

*Last updated: 2026-03-15 after v1.1 milestone*
