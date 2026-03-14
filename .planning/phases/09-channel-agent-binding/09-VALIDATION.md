---
phase: 9
slug: channel-agent-binding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual verification (Tauri desktop app) |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | Manual: bind agent, verify config, test message routing |
| **Estimated runtime** | ~10s (tsc), ~60s (manual) |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit`
- **After every plan wave:** Manual: select agent in dropdown, verify binding in config
- **Before `/gsd:verify-work`:** Full manual check of all 3 success criteria
- **Max feedback latency:** ~10 seconds (tsc)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | TELE-04 | manual + tsc | `npx tsc --noEmit` | N/A | ⬜ pending |

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agent dropdown populates from agent list | TELE-04 | Requires running app with agents | Open Channels, verify agents appear in dropdown |
| Binding saves to config | TELE-04 | Requires gateway | Select agent, save, check openclaw.json bindings |
| Binding takes effect without restart | TELE-04 | Requires Telegram bot | Send message to bot, verify correct agent responds |
| Deleted agent warning | TELE-04 | Requires deleting bound agent | Delete bound agent, check warning appears |

---

## Validation Sign-Off

- [ ] All tasks have TypeScript compilation verification
- [ ] Manual verification instructions provided
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
