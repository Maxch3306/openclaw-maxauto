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
- ✓ Settings UI — General, Models & API, Channels (placeholder), About sections
- ✓ System tray — tray icon with menu
- ✓ Auto-updates — check/download/install via GitHub Releases
- ✓ Telegram pairing — approve/reject pairing requests with 1hr TTL

### Active

<!-- Current scope. Building toward these. -->

- [ ] Telegram channel management — full in-app bot setup, token entry, configuration
- [ ] Channel-agent binding — 1:1 mapping of Telegram bot to agent
- [ ] Skills management — install and toggle skill packages per agent
- [ ] Workspace settings — per-agent workspace directory configuration

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- WhatsApp/Discord/Slack channels — focus on Telegram first, expand later
- MCP service management — defer until skills management is solid
- Multi-channel per agent (N:M binding) — keep 1:1 for simplicity in v1
- Mobile app — desktop-first product

## Context

- OpenClaw is the upstream runtime — MaxAuto manages its lifecycle but doesn't modify it
- All runtime files isolated under `~/.openclaw-maxauto/` (node, git, openclaw, config, credentials, sessions, workspace)
- OpenClaw gateway config lives at `~/.openclaw-maxauto/config/openclaw.json`
- Settings UI has 9 sections — General, Models & API, MCP Services, Skills, Channels, Workspace, Data & Privacy, Feedback, About — most show "Coming Soon" placeholders
- OpenClaw supports 50+ built-in skills and multiple IM channels natively
- Telegram pairing backend exists in Rust (`pairing.rs`) but the channel management UI is not built

## Constraints

- **Tech stack**: Tauri v2 (Rust) + React 19 + TypeScript — established, no changes
- **Communication**: All agent/chat/config operations go through OpenClaw gateway WebSocket or Tauri IPC
- **Isolation**: Must not touch global Node.js/Git/OpenClaw installations
- **Platform**: Windows (.msi) + macOS (.dmg)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Telegram first | Most common channel for OpenClaw users, pairing backend already exists | — Pending |
| 1:1 channel-agent binding | Simpler UX, avoids complex routing rules | — Pending |
| Full in-app Telegram setup | No need to leave the app, better onboarding experience | — Pending |
| Install & toggle for skills | Users need both discovery and control over skill packages | — Pending |

---
*Last updated: 2026-03-14 after initialization*
