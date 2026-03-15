---
phase: 11
slug: bot-account-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (Tauri desktop app — no unit test framework configured) |
| **Config file** | none |
| **Quick run command** | `pnpm build` (TypeScript type-check + Vite build) |
| **Full suite command** | `pnpm build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm build`
- **After every plan wave:** Run `pnpm build`
- **Before `/gsd:verify-work`:** Build must succeed + manual UI verification
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | MBOT-01, MBOT-04 | build | `pnpm build` | N/A | ⬜ pending |
| 11-01-02 | 01 | 1 | MBOT-02, MBOT-03 | build | `pnpm build` | N/A | ⬜ pending |
| 11-02-01 | 02 | 1 | MBOT-06 | build | `pnpm build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework setup needed — this is a UI-heavy phase verified via TypeScript compilation and manual testing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Add bot via modal dialog with token validation | MBOT-01 | Requires live Telegram API + gateway | Enter token, verify getMe validation, check config save |
| Remove bot with confirmation dialog | MBOT-02 | Requires live gateway + UI interaction | Click remove, verify confirmation details, check config cleanup |
| Enable/disable toggle preserves config | MBOT-03 | Requires live gateway restart cycle | Toggle off, verify config retained, toggle on, verify reconnect |
| Per-bot connection status display | MBOT-04 | Requires live Telegram connection | Check status dots match actual gateway channelAccounts state |
| 1:1 binding enforcement in dropdown | MBOT-06 | Requires multiple bots configured | Add 2 bots, verify bound agents greyed out in other dropdowns |

---

## Validation Sign-Off

- [x] All tasks have build verification
- [x] Sampling continuity: build check after every task
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
