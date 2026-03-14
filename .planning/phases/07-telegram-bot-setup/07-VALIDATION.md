---
phase: 7
slug: telegram-bot-setup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual verification (Tauri desktop app) |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | Manual: enter token, verify validation, check status display |
| **Estimated runtime** | ~10s (tsc), ~60s (manual) |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit`
- **After every plan wave:** Manual: enter bot token, check validation + status
- **Before `/gsd:verify-work`:** Full manual check of all 3 success criteria
- **Max feedback latency:** ~10 seconds (tsc)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | TELE-01, TELE-05 | manual + tsc | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Token validation via Telegram API | TELE-01 | Requires network call to api.telegram.org | Enter valid/invalid token, verify validation feedback |
| Auto-save after validation | TELE-01 | Requires running gateway | Enter valid token, verify config saved + bot connected |
| Connection status display | TELE-05 | Requires running gateway with Telegram | Check status shows connected/disconnected + bot info |
| Invalid token rejection | TELE-01 | Requires network call | Enter garbage token, verify error shown, not saved |

---

## Validation Sign-Off

- [ ] All tasks have TypeScript compilation verification
- [ ] Manual verification instructions provided
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
