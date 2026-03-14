---
phase: 3
slug: skills-control
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual verification (Tauri desktop app) |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | Manual: toggle skill, enter API key, verify state changes |
| **Estimated runtime** | ~10s (tsc), ~60s (manual) |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit`
- **After every plan wave:** Manual: toggle a skill, verify state change
- **Before `/gsd:verify-work`:** Full manual check of all 3 success criteria
- **Max feedback latency:** ~10 seconds (tsc)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | SKIL-02 | manual + tsc | `npx tsc --noEmit` | N/A | ⬜ pending |
| 3-01-02 | 01 | 1 | SKIL-03 | manual + tsc | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toggle flips skill state instantly | SKIL-02 | Requires live gateway | Toggle a skill, verify badge changes immediately |
| Toggle revert on failure | SKIL-02 | Requires error simulation | Disconnect gateway, toggle, verify revert + error |
| API key save enables skill | SKIL-03 | Requires live gateway | Enter API key for skill, save, verify status changes |
| Other skills unaffected | SKIL-02, SKIL-03 | Requires multiple skills visible | Toggle one skill, verify others unchanged |

---

## Validation Sign-Off

- [ ] All tasks have TypeScript compilation verification
- [ ] Manual verification instructions provided
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
