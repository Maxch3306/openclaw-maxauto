---
phase: 10
slug: multi-bot-config-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual verification (Tauri desktop app) |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | Manual: verify config structure after migration |
| **Estimated runtime** | ~10s (tsc), ~60s (manual) |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit`
- **After every plan wave:** Manual: check openclaw.json structure
- **Before `/gsd:verify-work`:** Full manual check of all 4 success criteria
- **Max feedback latency:** ~10 seconds (tsc)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | MBOT-05, MBOT-07 | manual + tsc | `npx tsc --noEmit` | N/A | ⬜ pending |

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration preserves settings | MBOT-07 | Requires live config | Add second bot, verify accounts.default has old settings |
| Binding scoping works | MBOT-05 | Requires multiple bots | Save bot 1 binding, verify bot 2 binding unchanged |
| Account ID from username | MBOT-05 | Requires getMe call | Add bot, verify account key matches username |

---

## Validation Sign-Off

- [ ] All tasks have TypeScript compilation verification
- [ ] Manual verification instructions provided
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
