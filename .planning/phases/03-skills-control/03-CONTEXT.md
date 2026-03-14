# Phase 3: Skills Control - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can toggle skills on/off and enter API keys for skills that require them. This builds on the Phase 2 card UI — adding interactive controls to the existing skill cards. Installation of missing dependencies is Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Toggle placement
- Toggle switch visible on the compact card (top-right corner), no need to expand
- Unavailable skills show the toggle but grayed out/disabled — shows the skill exists but can't be enabled yet

### Toggle feedback
- Optimistic update: toggle flips immediately, reverts if gateway call fails
- Error shown as inline red text near the toggle explaining what went wrong

### API key input UX
- Text input appears inline in the expanded card view (where the "Needs API key" message currently shows)
- Explicit Save button next to the input — user clicks to confirm
- API keys masked with dots/asterisks, with a reveal toggle (eye icon)

### Claude's Discretion
- Toggle switch component styling (custom or Tailwind utility)
- Save button styling and placement relative to input
- Error message auto-dismiss timing
- Whether to show a success indicator after API key save

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SkillsSection.tsx` (Phase 2): card grid with expand/collapse, status badges, category grouping
- `skills-utils.ts` (Phase 2): types (SkillStatusEntry, SkillStatusReport), groupSkills(), getSkillDisplayStatus(), computeSkillMissing()
- `patchConfig()` from `config-helpers.ts` (Phase 1): for any config writes
- `gateway.request()`: for calling `skills.update` API (live toggle, no restart needed)
- Lucide icons: `Eye`, `EyeOff` available for API key reveal toggle

### Established Patterns
- Phase 2 cards use `onClick` to expand — toggle needs `e.stopPropagation()` to prevent card expand
- Skills use `skills.update` gateway method (research confirmed: handles config writes internally, no restart)
- Existing status badge rendering in SkillCard component

### Integration Points
- `SkillsSection.tsx`: add toggle switch to SkillCard compact view
- `SkillsSection.tsx`: add API key input to expanded card view
- Gateway `skills.update` method: `{ skill: string, disabled?: boolean, config?: Record<string, string> }`
- Status refresh: re-call `skills.status` after toggle/save to update card states

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-skills-control*
*Context gathered: 2026-03-14*
