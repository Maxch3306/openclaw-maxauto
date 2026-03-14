# Phase 2: Skills Discovery - Research

**Researched:** 2026-03-14
**Domain:** OpenClaw skills.status API + React settings UI
**Confidence:** HIGH

## Summary

Phase 2 implements a read-only skills discovery UI within the existing Settings page. The OpenClaw gateway exposes a `skills.status` API method that returns a `SkillStatusReport` containing a flat array of `SkillStatusEntry` objects. Each entry includes the skill's name, description, emoji, source, enabled/disabled state, eligibility status, requirements (bins, env, config, OS), and what is missing. Skills are grouped by `source` field into categories: Workspace, Built-in, Installed, and Extra.

The existing MaxAuto codebase already has a `"skills"` section key in `SettingsPage.tsx` rendering a "Coming Soon" placeholder. The implementation needs a new `SkillsSection.tsx` component that calls `gateway.request("skills.status", {})`, groups the results, and renders them as expandable cards in a grid. The OpenClaw UI codebase (Lit-based) provides a reference implementation with grouping logic, status chips, and missing-requirements display that can be adapted to React.

**Primary recommendation:** Create a standalone `SkillsSection.tsx` component using local `useState`/`useEffect` (no new Zustand store needed for read-only display), call `skills.status` on mount, group by source, render as expandable cards with status badges.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Skill cards in a multi-column responsive grid (2-3 cards per row)
- Compact cards showing: skill icon, name, status badge, 1-line description
- Click to expand card for full details (description, requirements, install instructions)
- Status badges: Enabled (green), Disabled (gray), Unavailable (orange/red)
- Unavailable cards are visually dimmed/muted
- Expanded view shows: missing dependencies, missing API keys, system requirements, install instructions
- Group skills by category from gateway data
- Category headers as section dividers in the grid
- Loading: simple centered spinner with "Loading skills..." text
- Gateway disconnected: connection error message with reconnect hint
- No skeleton cards

### Claude's Discretion
- Exact card dimensions and spacing
- Category sort order
- Expand/collapse animation style
- Whether to show skill count per category

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SKIL-01 | User can view a list of all available skills with their status (enabled/disabled/unavailable) | `skills.status` API returns `SkillStatusEntry[]` with `disabled`, `eligible`, `blockedByAllowlist` fields that map directly to enabled/disabled/unavailable states |
| SKIL-04 | User can see why a skill is unavailable (missing dependencies, requirements) | `SkillStatusEntry.missing` contains `bins`, `env`, `config`, `os` arrays; `configChecks` shows config path satisfaction; `install` array shows available install options |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI components | Already in project |
| TypeScript | - | Type safety | Already in project |
| Tailwind CSS | 3.4 | Styling | Already in project |
| lucide-react | - | Icons | Already used throughout settings |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gateway-client | local | WebSocket API calls | `gateway.request("skills.status", {})` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Local useState | New Zustand store (skills-store.ts) | Zustand is overkill for read-only display in a single component; local state is simpler and sufficient. Can be promoted to a store in Phase 3 when mutation is needed. |

**Installation:**
No new dependencies needed. All libraries already in project.

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    settings/
      SkillsSection.tsx       # Main skills list component (new)
  pages/
    SettingsPage.tsx           # Add SkillsSection case to renderSection()
```

### Pattern 1: Gateway Request on Mount
**What:** Load skills data from gateway on component mount, refresh on demand.
**When to use:** Reading live state from gateway.
**Example:**
```typescript
// Source: Existing pattern from IMChannelsSection.tsx and OpenClaw ui/controllers/skills.ts
const [loading, setLoading] = useState(true);
const [report, setReport] = useState<SkillStatusReport | null>(null);
const [error, setError] = useState<string | null>(null);

async function loadSkills() {
  setLoading(true);
  setError(null);
  try {
    const res = await gateway.request<SkillStatusReport>("skills.status", {});
    setReport(res);
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    setLoading(false);
  }
}

useEffect(() => { void loadSkills(); }, []);
```

### Pattern 2: Skills Grouping by Source
**What:** Group the flat skills array into categories based on the `source` field.
**When to use:** Rendering skills organized by category.
**Example:**
```typescript
// Source: openclaw/ui/src/ui/views/skills-grouping.ts
const SKILL_SOURCE_GROUPS = [
  { id: "workspace", label: "Workspace Skills", sources: ["openclaw-workspace"] },
  { id: "built-in", label: "Built-in Skills", sources: ["openclaw-bundled"] },
  { id: "installed", label: "Installed Skills", sources: ["openclaw-managed"] },
  { id: "extra", label: "Extra Skills", sources: ["openclaw-extra"] },
];

// Group skills: iterate skills, match by source (or bundled flag for built-in)
// Skills not matching any group go into "Other Skills"
```

### Pattern 3: Expandable Card with Local State
**What:** Each skill card tracks its own expanded/collapsed state.
**When to use:** Click-to-expand detail views.
**Example:**
```typescript
const [expanded, setExpanded] = useState<string | null>(null);
// Toggle: setExpanded(expanded === skillKey ? null : skillKey)
```

### Pattern 4: Status Derivation
**What:** Map gateway data fields to display status.
**When to use:** Determining which badge and visual treatment to apply.
**Example:**
```typescript
// Source: openclaw/src/agents/skills-status.ts line 203
function getSkillDisplayStatus(skill: SkillStatusEntry): "enabled" | "disabled" | "unavailable" {
  if (skill.disabled) return "disabled";
  if (!skill.eligible) return "unavailable";
  return "enabled";
}
// eligible = !disabled && !blockedByAllowlist && requirementsSatisfied
```

### Anti-Patterns to Avoid
- **Separate store for read-only data:** Don't create a Zustand store just for Phase 2. Local component state is sufficient. A store will be needed in Phase 3 when mutation (toggle/API key) is added.
- **Polling for updates:** Don't set up auto-refresh intervals. A manual refresh button is sufficient for skills discovery.
- **Rendering internal paths:** Don't display `filePath` or `baseDir` to users -- these are internal OpenClaw paths.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skills grouping logic | Custom category mapping | Port `groupSkills()` from `openclaw/ui/src/ui/views/skills-grouping.ts` | Already handles edge cases (bundled flag vs source, fallback "Other" group) |
| Missing requirements display | Custom requirement parsing | Port `computeSkillMissing()` from `openclaw/ui/src/ui/views/skills-shared.ts` | Correctly prefixes `bin:`, `env:`, `config:`, `os:` |
| Status derivation | Custom eligibility check | Use `disabled` + `eligible` fields directly from API | Gateway already computes eligibility from all requirement types |

**Key insight:** The OpenClaw gateway does all the heavy lifting -- requirements evaluation, eligibility computation, install option resolution. The frontend just needs to display what the API returns.

## Common Pitfalls

### Pitfall 1: Confusing "disabled" vs "unavailable"
**What goes wrong:** Treating `disabled` and not-`eligible` as the same thing.
**Why it happens:** Both result in the skill not being active, but the causes are different.
**How to avoid:** `disabled` means user explicitly turned it off (can be re-enabled). Not `eligible` means requirements are not met (missing bins, env, config, or OS). A skill can be both disabled AND have missing requirements.
**Warning signs:** A skill showing "unavailable" when the user actually disabled it.

### Pitfall 2: Missing the `bundled` flag for grouping
**What goes wrong:** Skills that are bundled but have a different `source` field get put in the wrong group.
**Why it happens:** Some bundled skills may have `source !== "openclaw-bundled"` but still have `bundled: true`.
**How to avoid:** Check `skill.bundled` flag first for the "Built-in Skills" group, then fall back to source matching. This is how `groupSkills()` works in the OpenClaw UI.
**Warning signs:** Built-in skills appearing under "Other Skills" instead of "Built-in Skills".

### Pitfall 3: Not handling gateway disconnection
**What goes wrong:** Component shows stale "Loading..." forever or crashes.
**Why it happens:** `gateway.request()` throws when not connected.
**How to avoid:** Check `useAppStore(s => s.gatewayConnected)` and show the disconnected state message instead of attempting the API call.
**Warning signs:** Infinite spinner with no error feedback.

### Pitfall 4: Showing raw technical identifiers
**What goes wrong:** Displaying `env:OPENAI_API_KEY` or `bin:ffmpeg` without human-friendly labels.
**Why it happens:** The API returns raw identifiers.
**How to avoid:** For this phase (read-only discovery), the raw identifiers are acceptable but should be styled as code/monospace chips. Future phases can add friendly labels. The CONTEXT.md decision says to show "missing dependencies, missing API keys, system requirements, install instructions" -- these map directly to `missing.bins`, `missing.env`, `missing.config`/`configChecks`, and `install[]`.

### Pitfall 5: The `anyBins` field
**What goes wrong:** Ignoring `missing.anyBins` when displaying missing dependencies.
**Why it happens:** Only checking `missing.bins`.
**How to avoid:** The `Requirements` type has both `bins` (ALL required) and `anyBins` (ANY one required). Both should be checked. The `SkillStatusEntry.requirements` and `missing` objects include `anyBins` in the server-side type but the UI type omits it -- check actual API response shape.

## Code Examples

### SkillStatusReport Response Shape
```typescript
// Source: openclaw/src/agents/skills-status.ts (server type)
// Source: openclaw/ui/src/ui/types.ts (UI type)
type SkillStatusEntry = {
  name: string;           // e.g. "web-search"
  description: string;    // e.g. "Search the web using Google"
  source: string;         // "openclaw-bundled" | "openclaw-managed" | "openclaw-workspace" | "openclaw-extra"
  bundled: boolean;       // true if bundled (may override source for grouping)
  filePath: string;       // internal -- don't display
  baseDir: string;        // internal -- don't display
  skillKey: string;       // unique key, used for future skills.update calls
  primaryEnv?: string;    // e.g. "GOOGLE_API_KEY" -- indicates skill needs an API key
  emoji?: string;         // e.g. "magnifying_glass" -- skill icon
  homepage?: string;      // URL to skill docs/homepage
  always: boolean;        // true if skill is always active regardless of requirements
  disabled: boolean;      // true if user explicitly disabled
  blockedByAllowlist: boolean; // true if blocked by bundled allowlist
  eligible: boolean;      // computed: !disabled && !blockedByAllowlist && requirementsSatisfied
  requirements: {         // what the skill needs
    bins: string[];       // required binaries (ALL must be present)
    anyBins: string[];    // alternative binaries (ANY one suffices)
    env: string[];        // required environment variables
    config: string[];     // required config paths
    os: string[];         // required OS platforms
  };
  missing: {              // what is NOT satisfied
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  configChecks: Array<{   // per-config-path satisfaction
    path: string;
    satisfied: boolean;
  }>;
  install: Array<{        // available install options
    id: string;
    kind: "brew" | "node" | "go" | "uv" | "download";
    label: string;        // human-readable, e.g. "Install ffmpeg (brew)"
    bins: string[];
  }>;
};

type SkillStatusReport = {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
};
```

### Gateway Request Pattern
```typescript
// Source: existing pattern from ModelsAndApiSection.tsx, IMChannelsSection.tsx
import { gateway } from "../../api/gateway-client";

const report = await gateway.request<SkillStatusReport>("skills.status", {});
// report.skills is the array to render
```

### Status Badge Mapping
```typescript
// Derived from openclaw/src/agents/skills-status.ts
function getStatusBadge(skill: SkillStatusEntry) {
  if (skill.disabled) {
    return { label: "Disabled", color: "gray" };
  }
  if (!skill.eligible) {
    return { label: "Unavailable", color: "warning" };
  }
  return { label: "Enabled", color: "success" };
}
```

### Grouping Implementation
```typescript
// Port from openclaw/ui/src/ui/views/skills-grouping.ts
type SkillGroup = { id: string; label: string; skills: SkillStatusEntry[] };

const SKILL_SOURCE_GROUPS = [
  { id: "workspace", label: "Workspace Skills", sources: ["openclaw-workspace"] },
  { id: "built-in", label: "Built-in Skills", sources: ["openclaw-bundled"] },
  { id: "installed", label: "Installed Skills", sources: ["openclaw-managed"] },
  { id: "extra", label: "Extra Skills", sources: ["openclaw-extra"] },
];

function groupSkills(skills: SkillStatusEntry[]): SkillGroup[] {
  const groups = new Map<string, SkillGroup>();
  for (const def of SKILL_SOURCE_GROUPS) {
    groups.set(def.id, { id: def.id, label: def.label, skills: [] });
  }
  const other: SkillGroup = { id: "other", label: "Other Skills", skills: [] };
  const builtInDef = SKILL_SOURCE_GROUPS.find(g => g.id === "built-in");
  for (const skill of skills) {
    const match = skill.bundled
      ? builtInDef
      : SKILL_SOURCE_GROUPS.find(g => g.sources.includes(skill.source));
    if (match) {
      groups.get(match.id)?.skills.push(skill);
    } else {
      other.skills.push(skill);
    }
  }
  const ordered = SKILL_SOURCE_GROUPS
    .map(g => groups.get(g.id))
    .filter((g): g is SkillGroup => Boolean(g && g.skills.length > 0));
  if (other.skills.length > 0) ordered.push(other);
  return ordered;
}
```

### Missing Requirements Display
```typescript
// Port from openclaw/ui/src/ui/views/skills-shared.ts
function computeSkillMissing(skill: SkillStatusEntry): string[] {
  return [
    ...skill.missing.bins.map(b => `bin: ${b}`),
    ...(skill.missing.anyBins ?? []).map(b => `bin: ${b} (any)`),
    ...skill.missing.env.map(e => `env: ${e}`),
    ...skill.missing.config.map(c => `config: ${c}`),
    ...skill.missing.os.map(o => `os: ${o}`),
  ];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | `skills.status` returns pre-computed eligibility | Current | Frontend does not need to evaluate requirements |
| N/A | `install` array with preferred option pre-selected | Current | Frontend just displays install labels |

## Open Questions

1. **Emoji rendering**
   - What we know: `emoji` field exists on `SkillStatusEntry` as an optional string (e.g. "magnifying_glass")
   - What's unclear: Whether these are emoji shortcodes or actual Unicode emoji characters
   - Recommendation: Check at runtime. If shortcode format, either map to Unicode or use a fallback icon (Lucide `BookOpen`). For Phase 2, a simple fallback is fine.

2. **`anyBins` in UI type**
   - What we know: Server-side `SkillStatusEntry` includes `anyBins` in both `requirements` and `missing`. The UI type in `openclaw/ui/src/ui/types.ts` does NOT include `anyBins`.
   - What's unclear: Whether the actual JSON response includes `anyBins` or if the server strips it.
   - Recommendation: Define the TypeScript type with optional `anyBins` and handle gracefully if absent.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured in project) |
| Config file | vite.config.ts (Vitest integrated) |
| Quick run command | `pnpm exec vitest run --reporter=verbose` |
| Full suite command | `pnpm exec vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKIL-01 | Skills list renders with correct status badges | unit | `pnpm exec vitest run src/components/settings/SkillsSection.test.tsx -x` | No - Wave 0 |
| SKIL-01 | groupSkills() correctly groups by source | unit | `pnpm exec vitest run src/components/settings/skills-utils.test.ts -x` | No - Wave 0 |
| SKIL-04 | Missing requirements display correctly | unit | `pnpm exec vitest run src/components/settings/skills-utils.test.ts -x` | No - Wave 0 |
| SKIL-01 | Loading and error states render correctly | unit | `pnpm exec vitest run src/components/settings/SkillsSection.test.tsx -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm exec vitest run --reporter=verbose`
- **Per wave merge:** `pnpm exec vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/settings/skills-utils.test.ts` -- covers SKIL-01 grouping logic and SKIL-04 missing requirements display
- [ ] `src/components/settings/SkillsSection.test.tsx` -- covers SKIL-01 rendering and SKIL-04 expanded view (may need `@testing-library/react` if not already installed)
- [ ] Verify `@testing-library/react` is available: `pnpm list @testing-library/react`

## Sources

### Primary (HIGH confidence)
- `openclaw/src/gateway/server-methods/skills.ts` -- gateway handler, confirms `skills.status` method name and response shape
- `openclaw/src/agents/skills-status.ts` -- `SkillStatusEntry` and `SkillStatusReport` server-side types, `buildSkillStatus()` logic
- `openclaw/ui/src/ui/types.ts` -- UI-side type definitions for `SkillStatusEntry` and `SkillStatusReport`
- `openclaw/ui/src/ui/views/skills-grouping.ts` -- `groupSkills()` implementation with source-based categorization
- `openclaw/ui/src/ui/views/skills-shared.ts` -- `computeSkillMissing()` and `computeSkillReasons()` helpers
- `openclaw/ui/src/ui/controllers/skills.ts` -- `loadSkills()` pattern showing `gateway.request("skills.status", {})`
- `openclaw/src/shared/requirements.ts` -- `Requirements` type definition (bins, anyBins, env, config, os)

### Secondary (MEDIUM confidence)
- `openclaw/src/gateway/server.skills-status.test.ts` -- test confirming response does not leak secrets, configChecks structure
- `openclaw/ui/src/ui/views/skills.ts` -- full Lit-based skills UI rendering for reference

### Tertiary (LOW confidence)
- Emoji field format -- needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies
- Architecture: HIGH - direct source code access to OpenClaw gateway, types, and reference UI
- Pitfalls: HIGH - identified from actual OpenClaw source code analysis (bundled flag, anyBins, eligibility logic)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- OpenClaw skills API is established)
