# Phase 2: Skills Discovery - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can browse all available skills and understand why any skill is unavailable. This is a read-only discovery UI — toggling, API key entry, and installation are separate phases (3, 4).

</domain>

<decisions>
## Implementation Decisions

### Skills list layout
- Skill cards in a multi-column responsive grid (2-3 cards per row)
- Compact cards showing: skill icon, name, status badge, 1-line description
- Click to expand card for full details (description, requirements, install instructions)

### Status badges
- Enabled: green badge
- Disabled: gray badge
- Unavailable: orange/red badge
- Unavailable cards are visually dimmed/muted to separate from available ones

### Unavailability display
- Click card to expand and see detailed unavailability info
- Expanded view shows: missing dependencies, missing API keys, system requirements, install instructions
- All four detail types shown when relevant to that skill

### Skills organization
- Group skills by category from gateway data (whatever categories `skills.status` provides)
- Category headers as section dividers in the grid

### Empty & loading states
- Loading: simple centered spinner with "Loading skills..." text
- Gateway disconnected: connection error message explaining gateway isn't connected, with reconnect hint
- No "skeleton cards" — keep it simple

### Claude's Discretion
- Exact card dimensions and spacing
- Category sort order
- Expand/collapse animation style
- Whether to show skill count per category

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Settings page already has `"skills"` tab key in `SettingsPage.tsx` (line 25) with "Coming Soon" placeholder
- `SettingsSection` type in settings-store includes `"skills"` as valid value
- Existing settings sections (ModelsAndApiSection, IMChannelsSection) follow consistent component patterns
- `patchConfig()` from `config-helpers.ts` available for any config writes (Phase 1 complete)
- `gateway.request()` for calling `skills.status` API

### Established Patterns
- Settings components are standalone files in `src/components/settings/`
- PascalCase component files: `ModelsAndApiSection.tsx`, `IMChannelsSection.tsx`
- Components receive no props (read from Zustand stores directly)
- Lucide icons used throughout (`lucide-react`)

### Integration Points
- `SettingsPage.tsx` renders sections based on `activeSection` state
- New `SkillsSection.tsx` component in `src/components/settings/`
- Gateway `skills.status` API returns per-skill status, eligibility, requirements
- May need new Zustand store or extend `settings-store.ts` (store is 850+ lines)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-skills-discovery*
*Context gathered: 2026-03-14*
