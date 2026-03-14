---
phase: 04-skills-installation
verified: 2026-03-14T15:00:00Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "Open Skills settings, find a skill that has missing binaries AND install options — verify Download icon appears on its compact card"
    expected: "Download button visible between status badge and toggle switch; skills without install options show no button"
    why_human: "Requires a live gateway with at least one skill that has install.length > 0 and missing.bins.length > 0"
  - test: "Click the Download button on an installable skill"
    expected: "Button replaced by spinner + 'Installing...' text; all other Download buttons become disabled (opacity-40); toggle switches remain interactive"
    why_human: "Requires live gateway to trigger the skills.install call and observe real-time UI state"
  - test: "After a successful install completes"
    expected: "Spinner disappears, card transitions from unavailable (dimmed) to disabled (normal opacity, toggle off)"
    why_human: "Requires actual dependency installation to succeed through the gateway"
  - test: "Simulate or trigger an install failure"
    expected: "Inline error text appears below the skill description, auto-dismisses after 8 seconds"
    why_human: "Requires gateway to return an error for skills.install to observe the dismiss behavior"
---

# Phase 4: Skills Installation Verification Report

**Phase Goal:** Users can install missing skill dependencies directly from the UI
**Verified:** 2026-03-14T15:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Unavailable skills with install options show a download button on the compact card | VERIFIED | Lines 157-176 of SkillsSection.tsx: `canInstallSkill(skill)` gate renders `<Download size={14} />` button between badge and toggle |
| 2 | Clicking install triggers gateway skills.install call and shows inline spinner with 'Installing...' text | VERIFIED | `handleInstall` (lines 442-479) calls `gateway.request("skills.install", { name, installId, timeoutMs: 120000 })`; spinner branch at lines 158-162 renders `<Loader2 animate-spin />` + "Installing..." |
| 3 | Other skills remain interactive while one skill is installing | VERIFIED | `installingSkill` state is per-skillKey string; only the installing card shows spinner; other install buttons use `disabled={installingSkill !== null}` (line 166); toggle is a separate `ToggleSwitch` unaffected by `installingSkill` |
| 4 | After successful install, skill card transitions from unavailable to disabled | VERIFIED | `handleInstall` success path calls `loadSkills()` (line 460) which re-fetches `skills.status`; updated skill data with `eligible=true, disabled=true` causes `getSkillDisplayStatus()` to return "disabled" |
| 5 | Install failure shows inline error text that auto-dismisses | VERIFIED | Catch block (lines 461-473) sets `skillErrors[key]`; 8-second `setTimeout` clears it; `skillError` prop renders at lines 192-196 in SkillCard |
| 6 | Skills with no install options do not show an install button | VERIFIED | `canInstallSkill()` guard (line 157) returns false when `skill.install.length === 0` or `skill.missing.bins.length === 0`; no button rendered |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/settings/skills-utils.ts` | `canInstallSkill()` helper function | VERIFIED | Exported at line 137; returns `skill.install.length > 0 && skill.missing.bins.length > 0` |
| `src/components/settings/SkillsSection.tsx` | Install button, install state management, `handleInstall` function | VERIFIED | `installingSkill` state at line 328; `handleInstall` callback at lines 442-479; install button UI at lines 157-176 |

Both artifacts are substantive (not stubs) and fully wired.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SkillsSection.tsx` | `gateway skills.install` | `gateway.request('skills.install', { name, installId, timeoutMs })` | WIRED | Line 455: `await gateway.request("skills.install", { name: skill.name, installId: skill.install[0].id, timeoutMs: 120000 })` — exact match |
| `SkillsSection.tsx` | `skills-utils.ts canInstallSkill` | import and call in SkillCard render | WIRED | Line 24: imported as `canInstallSkill`; called at line 157 in SkillCard render and line 165 in button disabled check |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SKIL-05 | 04-01-PLAN.md | User can install skill dependencies from the UI | SATISFIED | Install button renders for installable skills; `handleInstall` calls gateway `skills.install`; post-install `loadSkills()` updates UI state |

No orphaned requirements — SKIL-05 is the only requirement mapped to Phase 4 in REQUIREMENTS.md traceability table, and it is covered by plan 04-01.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | None found |

No TODOs, FIXMEs, placeholder returns, or stub implementations detected in either modified file. The install flow is complete from button click through gateway call, error handling, and UI refresh.

### Human Verification Required

#### 1. Download button visible on installable skills

**Test:** Open MaxAuto with a connected gateway, navigate to Settings > Skills, find a skill marked "Unavailable" that has dependency install options (e.g., a skill requiring a binary like `ffmpeg` that has a brew/apt install option)
**Expected:** A Download icon button is visible between the status badge and the toggle switch. Skills without install options show no such button.
**Why human:** Requires a live gateway returning skill data with `install.length > 0` and `missing.bins.length > 0` to exercise the `canInstallSkill()` branch

#### 2. Install button interaction — spinner and disabled state

**Test:** Click the Download button on an installable skill
**Expected:** The button is replaced by a `Loader2` spinner with "Installing..." text. All other Download buttons on other skill cards become dimmed (opacity 40%). Toggle switches on all cards remain clickable.
**Why human:** Requires live gateway; the `installingSkill` state transition and concurrent-disable behavior must be observed in real time

#### 3. Post-install card status transition

**Test:** Allow an install to complete successfully
**Expected:** The spinner disappears, the card's opacity returns to normal (from 60% dimmed), and the status badge changes from "Unavailable" to "Disabled" (the skill is now eligible but user-disabled by default)
**Why human:** Requires actual dependency installation to succeed; the gateway response triggers `loadSkills()` which updates the display

#### 4. Install failure and 8-second auto-dismiss

**Test:** Trigger or simulate an install failure (e.g., gateway offline mid-install, or install a skill whose dependency cannot be found)
**Expected:** Error text appears below the skill description in the compact card view, then automatically disappears after approximately 8 seconds
**Why human:** Requires gateway to surface an error from `skills.install`; timing of the auto-dismiss cannot be verified statically

### Gaps Summary

No gaps. All automated checks pass. Both modified files are substantive, fully wired, and TypeScript-clean (confirmed via `npx tsc --noEmit`). The commit `d08446da5` delivers the complete implementation. Four items remain for human verification because they require a live gateway session to observe the real-time install flow.

---

_Verified: 2026-03-14T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
