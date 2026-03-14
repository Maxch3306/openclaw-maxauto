---
phase: 2
slug: skills-discovery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual verification (Tauri desktop app, no test framework configured) |
| **Config file** | none |
| **Quick run command** | Manual: open Skills section, verify card grid renders |
| **Full suite command** | Manual: verify all 3 success criteria |
| **Estimated runtime** | ~60 seconds manual |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit` (TypeScript compilation check)
- **After every plan wave:** Manual: open Skills settings section, verify rendering
- **Before `/gsd:verify-work`:** Full manual check of all 3 success criteria
- **Max feedback latency:** ~10 seconds (tsc), ~60 seconds (manual)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | SKIL-01 | manual + tsc | `npx tsc --noEmit` | N/A | ⬜ pending |
| 2-01-02 | 01 | 1 | SKIL-01, SKIL-04 | manual + tsc | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

No test framework setup needed — this phase creates UI components for a Tauri desktop app. TypeScript compilation checks verify structural correctness. Runtime behavior verified manually against live gateway.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skills list renders in grid | SKIL-01 | Requires running Tauri app + gateway | Open Settings → Skills, verify cards appear in multi-column grid |
| Status badges correct | SKIL-01 | Requires live skill status data | Verify enabled (green), disabled (gray), unavailable (dimmed + orange) |
| Unavailability explanation | SKIL-04 | Requires live gateway with mix of available/unavailable skills | Click unavailable skill card, verify expanded details show missing deps/keys/reqs |
| Live state updates | SKIL-01 | Requires gateway restart test | Change skill state, verify UI updates without app restart |

---

## Validation Sign-Off

- [ ] All tasks have TypeScript compilation verification
- [ ] Manual verification instructions provided for all requirements
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
