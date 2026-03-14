# Phase 4: Skills Installation - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can install missing skill dependencies directly from the UI. This builds on the Phase 2/3 skill cards — adding an install action for skills that have available install options. This is the last skills phase.

</domain>

<decisions>
## Implementation Decisions

### Install trigger & progress
- Install button on the compact card (e.g. download icon) — visible without expanding
- Only show install button when the skill has available install options from gateway
- During install: replace install button with inline spinner + "Installing..." text on the card
- User can still interact with other skills while one is installing

### Failure & platform limits
- Install failure: inline error text on the card (same pattern as toggle errors from Phase 3)
- Skills with no install option (e.g. brew not available on Windows): hide install button entirely, only show the missing deps list so user can install manually
- No disabled button with tooltip — just don't show what's not available

### Post-install behavior
- Auto re-fetch `skills.status` after install completes to update card status and badge
- Don't auto-enable the skill after install — user turns it on when ready via toggle
- Install success reflected by card transitioning from unavailable (dimmed) to disabled (normal, toggle off)

### Claude's Discretion
- Install button icon choice and placement on compact card
- Error message auto-dismiss timing
- Whether to show install option name (e.g. "Install via npm") or just "Install"
- Handling partial install success (some deps installed, some failed)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SkillsSection.tsx` (Phases 2-3): card grid with toggle, API key input, expand/collapse, status badges
- `skills-utils.ts` (Phases 2-3): types, grouping, status computation, `computeSkillMissing()`
- `SkillStatusEntry.install` field: array of install options per skill (from `skills.status` API)
- Gateway `skills.install` method: triggers installation of a skill dependency
- Inline error pattern from Phase 3 toggle: `toggleError` state with auto-dismiss

### Established Patterns
- Optimistic UI updates with rollback (Phase 3 toggle)
- Inline spinner pattern not yet established — new for this phase
- `loadSkills()` re-fetch pattern after mutations (Phase 3)

### Integration Points
- `SkillsSection.tsx`: add install button to compact card, install state tracking
- Gateway `skills.install` method: `{ skill: string, installer: string }` (research needed for exact params)
- `skills.status` re-fetch after install to update card state

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-skills-installation*
*Context gathered: 2026-03-14*
