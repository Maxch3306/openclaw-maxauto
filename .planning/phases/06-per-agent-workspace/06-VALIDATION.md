---
phase: 6
slug: per-agent-workspace
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual verification (Tauri desktop app) |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | Manual: set per-agent workspace, verify persistence |
| **Estimated runtime** | ~10s (tsc), ~60s (manual) |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit`
- **After every plan wave:** Manual: set agent workspace, restart, verify persists
- **Before `/gsd:verify-work`:** Full manual check of all 3 success criteria
- **Max feedback latency:** ~10 seconds (tsc)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | WORK-02 | manual + tsc | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-agent workspace set via folder picker | WORK-02 | Requires native dialog + gateway | Edit agent, pick workspace folder, verify config |
| Agent list shows default vs custom | WORK-02 | Requires running app with agents | Open Workspace settings, check agent list |
| Workspace persists across restart | WORK-02 | Requires gateway restart | Set workspace, restart gateway, verify persists |

---

## Validation Sign-Off

- [ ] All tasks have TypeScript compilation verification
- [ ] Manual verification instructions provided
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
