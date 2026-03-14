---
phase: 1
slug: config-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual verification (Tauri desktop app, no test framework configured) |
| **Config file** | none |
| **Quick run command** | Manual: change a setting, verify config file merged correctly |
| **Full suite command** | Manual: rapid-click two different settings sections, verify no clobber |
| **Estimated runtime** | ~30 seconds manual |

---

## Sampling Rate

- **After every task commit:** Manual verification — change a setting, verify config file has correct merged content
- **After every plan wave:** Manual verification — rapidly change settings in different sections, verify no data loss
- **Before `/gsd:verify-work`:** Verify all call sites use config.patch; verify writeConfigAndRestart removed
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INFR-01 | manual-only | Manual: verify config.patch helper works | N/A | ⬜ pending |
| 1-01-02 | 01 | 1 | INFR-01 | manual-only | Manual: verify rapid writes don't clobber | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

No test framework setup needed — this phase migrates API call patterns. OpenClaw already has comprehensive tests for `applyMergePatch` in its own codebase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Config merge semantics | INFR-01 | Requires running gateway + WebSocket connection | 1. Open MaxAuto, 2. Change a model provider setting, 3. Verify openclaw.json has merged content (not full replace) |
| No clobber on rapid writes | INFR-01 | Requires live Tauri app with real gateway | 1. Change setting in Models section, 2. Immediately change setting in Channels section, 3. Verify both changes persist |

---

## Validation Sign-Off

- [ ] All tasks have manual verification instructions
- [ ] Sampling continuity: manual verify after each task
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
