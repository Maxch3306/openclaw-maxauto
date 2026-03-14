---
phase: 4
slug: skills-installation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual verification (Tauri desktop app) |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | Manual: click install on unavailable skill, verify completion |
| **Estimated runtime** | ~10s (tsc), ~120s (manual with real install) |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit`
- **After every plan wave:** Manual: verify install button appears on correct skills
- **Before `/gsd:verify-work`:** Full manual check of all 3 success criteria
- **Max feedback latency:** ~10 seconds (tsc)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | SKIL-05 | manual + tsc | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Install button appears on installable skills | SKIL-05 | Requires live gateway with installable skills | Open Skills, find unavailable skill with install option |
| Install spinner during install | SKIL-05 | Requires real install execution | Click install, verify spinner replaces button |
| Card updates after install | SKIL-05 | Requires successful install | After install, verify card status changes |
| No install button when no option | SKIL-05 | Requires skill without install path | Find unavailable skill without install, verify no button |

---

## Validation Sign-Off

- [ ] All tasks have TypeScript compilation verification
- [ ] Manual verification instructions provided
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
