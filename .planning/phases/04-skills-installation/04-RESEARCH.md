# Phase 4: Skills Installation - Research

**Researched:** 2026-03-14
**Domain:** OpenClaw skills.install API + React install UI on existing skill cards
**Confidence:** HIGH

## Summary

Phase 4 adds an install button to skill cards for skills that have available install options (the `install` array from `skills.status`). The OpenClaw gateway exposes a `skills.install` method that takes `{ name, installId, timeoutMs? }` and runs the corresponding install command server-side (brew, npm, go, uv, or download). This is a synchronous request-response call -- NOT streaming. The call blocks until the install command completes (default timeout 300s, max 900s). The OpenClaw reference UI uses `timeoutMs: 120000` (2 minutes).

The `install` array on each `SkillStatusEntry` contains pre-resolved install options with `id`, `kind`, `label`, and `bins` fields. The `id` is either explicitly set by the skill metadata or auto-generated as `${kind}-${index}`. The `label` is human-readable (e.g., "Install ffmpeg (brew)"). The reference UI uses `skill.install[0]` (first/preferred option) and displays the label on the button. The `canInstall` condition is `skill.install.length > 0 && skill.missing.bins.length > 0` -- install is only relevant when there are missing binaries that can be installed.

The existing `SkillsSection.tsx` already shows install options as static text in the expanded card view. This phase converts those into an actionable install button on the compact card, with inline progress/error states following the same patterns established in Phase 3 (busy tracking, error with auto-dismiss, post-mutation refresh).

**Primary recommendation:** Add an install button (Download icon) to the compact card for skills where `skill.install.length > 0 && skill.missing.bins.length > 0`. Call `gateway.request("skills.install", { name: skill.name, installId: skill.install[0].id, timeoutMs: 120000 })`. Show inline "Installing..." with spinner during the call. On success, re-fetch `skills.status`. On failure, show inline error with auto-dismiss. Hide install button on platforms where no install option is available (e.g., brew-only skill on Windows).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Install button on the compact card (e.g. download icon) -- visible without expanding
- Only show install button when the skill has available install options from gateway
- During install: replace install button with inline spinner + "Installing..." text on the card
- User can still interact with other skills while one is installing
- Install failure: inline error text on the card (same pattern as toggle errors from Phase 3)
- Skills with no install option (e.g. brew not available on Windows): hide install button entirely, only show the missing deps list so user can install manually
- No disabled button with tooltip -- just don't show what's not available
- Auto re-fetch `skills.status` after install completes to update card status and badge
- Don't auto-enable the skill after install -- user turns it on when ready via toggle
- Install success reflected by card transitioning from unavailable (dimmed) to disabled (normal, toggle off)

### Claude's Discretion
- Install button icon choice and placement on compact card
- Error message auto-dismiss timing
- Whether to show install option name (e.g. "Install via npm") or just "Install"
- Handling partial install success (some deps installed, some failed)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SKIL-05 | User can install skill dependencies from the UI | `skills.install` accepts `{ name, installId, timeoutMs? }`. Returns `{ ok, message, stdout, stderr, code, warnings? }`. The `install` array on `SkillStatusEntry` provides pre-resolved options with `id`, `kind`, `label`, `bins`. Reference UI uses `skill.install[0]` (preferred option). Install is request-response (blocks until complete, up to 120s timeout). After success, re-fetch `skills.status` updates card from unavailable to disabled. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI components | Already in project |
| TypeScript | - | Type safety | Already in project |
| Tailwind CSS | 3.4 | Styling (spinner, button) | Already in project |
| lucide-react | - | Download icon for install button, Loader2 for spinner | Already used throughout settings |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gateway-client | local | `gateway.request("skills.install", ...)` | Install action |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| First install option only | Dropdown for multiple options | Adds complexity; reference UI also uses first option only. Multiple options are rare in practice. |

**Installation:**
No new dependencies needed. All libraries already in project.

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    settings/
      SkillsSection.tsx       # Modified: add install button + install state tracking
      skills-utils.ts          # Modified: add canInstall() helper
```

No new files needed. This phase modifies the existing files from Phases 2-3.

### Pattern 1: skills.install Gateway Call
**What:** Call the gateway to install a skill's missing dependency.
**When to use:** User clicks the install button on a skill card.
**Example:**
```typescript
// Source: openclaw/src/gateway/protocol/schema/agents-models-skills.ts (SkillsInstallParamsSchema)
// Source: openclaw/src/gateway/server-methods/skills.ts (handler, lines 114-145)
// Source: openclaw/ui/src/ui/controllers/skills.ts (installSkill, lines 125-157)

await gateway.request("skills.install", {
  name: skill.name,           // skill name (NOT skillKey)
  installId: skill.install[0].id,  // id of the preferred install option
  timeoutMs: 120000,          // 2 minute timeout (matches reference UI)
});

// Response shape on success:
// { ok: true, message: "Installed", stdout: "...", stderr: "...", code: 0 }

// Response shape on failure (thrown as error by gateway.request):
// Error with message from gateway: "brew not installed — ..." or install command stderr
```

### Pattern 2: Install Button with Busy State
**What:** Replace the install button with a spinner during installation.
**When to use:** User clicks install, awaiting the gateway response.
**Example:**
```typescript
// Source: CONTEXT.md decision -- inline spinner + "Installing..." text
// Source: openclaw/ui/src/ui/views/skills.ts lines 155-163 -- reference pattern

const [installingSkill, setInstallingSkill] = useState<string | null>(null);

async function handleInstall(skill: SkillStatusEntry) {
  const key = skill.skillKey;
  setInstallingSkill(key);
  // Clear any previous error
  setSkillErrors(prev => {
    const next = { ...prev };
    delete next[key];
    return next;
  });

  try {
    await gateway.request("skills.install", {
      name: skill.name,
      installId: skill.install[0].id,
      timeoutMs: 120000,
    });
    // Re-fetch to update card status (unavailable -> disabled)
    await loadSkills();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setSkillErrors(prev => ({ ...prev, [key]: msg }));
    // Auto-dismiss error after 8 seconds (longer than toggle errors since install errors are more actionable)
    if (errorTimers.current[key]) clearTimeout(errorTimers.current[key]);
    errorTimers.current[key] = setTimeout(() => {
      setSkillErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 8000);
  } finally {
    setInstallingSkill(null);
  }
}
```

### Pattern 3: canInstall Guard
**What:** Determine if a skill should show the install button.
**When to use:** Rendering the compact card header.
**Example:**
```typescript
// Source: openclaw/ui/src/ui/views/skills.ts line 115

function canInstallSkill(skill: SkillStatusEntry): boolean {
  // Install is only relevant when there are missing bins that can be installed
  return skill.install.length > 0 && skill.missing.bins.length > 0;
}
```

**Important:** This already filters out platform-inappropriate options. The `install` array in `skills.status` is pre-resolved by the gateway -- brew options only appear when brew is available, etc. So if a skill on Windows only has a brew installer, `install` will be empty, and the button is hidden. No additional platform filtering is needed on the frontend.

### Pattern 4: Install Button Placement on Compact Card
**What:** Place install button in the compact card header row, between the status badge and the toggle.
**When to use:** Rendering the compact card for skills with `canInstall === true`.
**Example:**
```typescript
// In the compact card header row:
<div className="flex items-center gap-2">
  <SkillEmoji emoji={skill.emoji} />
  <span className="flex-1 ...">{skill.name}</span>
  <span className="...">{badge.label}</span>

  {/* Install button -- only when installable */}
  {canInstallSkill(skill) && (
    installing === skill.skillKey ? (
      <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
        <Loader2 size={12} className="animate-spin" />
        Installing...
      </span>
    ) : (
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleInstall(skill);
        }}
        disabled={!!installingSkill}
        className="p-1 text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors disabled:opacity-40"
        title={skill.install[0].label}
      >
        <Download size={14} />
      </button>
    )
  )}

  <ToggleSwitch ... />
  <ChevronDown ... />
</div>
```

### Anti-Patterns to Avoid
- **Using `skillKey` as the `name` param:** The `skills.install` method takes `name` (the skill name, e.g., "web-search"), NOT `skillKey`. The reference UI correctly passes `skill.name`. Using `skillKey` will get a "Skill not found" error because `installSkill()` matches on `entry.skill.name`.
- **Not setting `timeoutMs`:** Without a timeout, the default is 300 seconds (5 minutes). This is too long for UI responsiveness. Use `120000` (2 min) like the reference UI.
- **Trying to stream install progress:** `skills.install` is a synchronous request-response call. There is no streaming/events for install progress. The spinner is the only progress indicator.
- **Showing install for skills with only missing env/config:** The `canInstall` check requires `missing.bins.length > 0`. Skills that only need an API key (missing env) should NOT show install -- they need the API key input instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Platform filtering for install options | Custom OS detection | Gateway's pre-resolved `install` array | Gateway already filters: brew options only appear when brew is available |
| Install command construction | Custom npm/brew/go commands | `skills.install` gateway method | Server handles brew resolution, uv bootstrapping, go path setup |
| Post-install status refresh | Manual status computation | Re-fetch `skills.status` | Gateway recomputes eligibility from scratch on each call |
| Install timeout management | Custom AbortController | `timeoutMs` param on `skills.install` | Server handles timeout and process cleanup |

**Key insight:** `skills.install` is a single request-response call that blocks until the install completes or times out. The server handles all complexity (finding brew, resolving paths, running commands, cleaning up). The frontend just needs: button -> call -> refresh.

## Common Pitfalls

### Pitfall 1: Using skillKey Instead of name
**What goes wrong:** `skills.install` returns "Skill not found" error.
**Why it happens:** The API params use `name` (skill display name like "web-search") while `skills.update` uses `skillKey`. Developer may confuse the two.
**How to avoid:** Check the schema: `SkillsInstallParamsSchema` requires `name` and `installId`. Use `skill.name` (not `skill.skillKey`).
**Warning signs:** Install always fails with "Skill not found" even for valid skills.

### Pitfall 2: Not Using stopPropagation on Install Button
**What goes wrong:** Clicking install also expands/collapses the card.
**Why it happens:** The card has an `onClick` handler for expand/collapse. Same issue as toggle in Phase 3.
**How to avoid:** Call `e.stopPropagation()` on the install button click handler. This is already established in Phase 3.
**Warning signs:** Card expands every time user clicks install.

### Pitfall 3: Blocking Other Interactions During Install
**What goes wrong:** User cannot toggle or interact with other skills while one is installing.
**Why it happens:** Using a single global busy state that blocks all interactions.
**How to avoid:** CONTEXT.md explicitly says "User can still interact with other skills while one is installing." Track the installing skill key separately. Only disable the install button on OTHER skills (to prevent concurrent installs, which the gateway allows but is confusing UX), but keep toggles and other interactions enabled.
**Warning signs:** All skill cards become unresponsive during install.

### Pitfall 4: Not Handling Long Install Times
**What goes wrong:** User thinks the app is frozen during a long install (up to 2 minutes).
**Why it happens:** No visual feedback beyond the initial spinner.
**How to avoid:** The "Installing..." text with spinner is sufficient per CONTEXT.md decision. The 120s timeout prevents infinite hangs. Consider showing the install option label (e.g., "Installing ffmpeg (brew)...") for clarity on what is happening.
**Warning signs:** Users force-closing the app during legitimate installs.

### Pitfall 5: Auto-Enabling After Install
**What goes wrong:** Skill auto-enables after install, potentially surprising the user.
**Why it happens:** Developer adds `skills.update({ skillKey, enabled: true })` after install.
**How to avoid:** CONTEXT.md explicitly says "Don't auto-enable the skill after install -- user turns it on when ready via toggle." Just re-fetch `skills.status` and let the card transition from unavailable (dimmed) to disabled (normal, toggle off).
**Warning signs:** Skill immediately starts running after install without user consent.

## Code Examples

### skills.install API Schema (Verified)
```typescript
// Source: openclaw/src/gateway/protocol/schema/agents-models-skills.ts lines 192-199
// SkillsInstallParamsSchema (TypeBox)
{
  name: NonEmptyString,           // required -- skill name (NOT skillKey)
  installId: NonEmptyString,      // required -- id of the install option
  timeoutMs: Type.Optional(Type.Integer({ minimum: 1000 })),  // optional, default 300s, max 900s
}
```

### skills.install Response Shape (Verified)
```typescript
// Source: openclaw/src/agents/skills-install.ts lines 27-34
type SkillInstallResult = {
  ok: boolean;
  message: string;      // "Installed" on success, error description on failure
  stdout: string;       // command stdout
  stderr: string;       // command stderr
  code: number | null;  // process exit code
  warnings?: string[];  // security scan warnings (optional)
};

// On success: respond(true, result, undefined)
// On failure: respond(false, undefined, errorShape(UNAVAILABLE, result.message))
// Note: on failure the gateway responds with an error, so gateway.request() will THROW.
// The error message will be the result.message string.
```

### skills.install Server Behavior (Verified)
```typescript
// Source: openclaw/src/gateway/server-methods/skills.ts lines 114-145
// Source: openclaw/src/agents/skills-install.ts (full implementation)
//
// 1. Validates params (name, installId)
// 2. Loads config to resolve workspace dir
// 3. Finds the skill entry by name in workspace skill entries
// 4. Finds the matching install spec by installId
// 5. Runs security scan on the skill directory (collects warnings)
// 6. For 'download' kind: delegates to installDownloadSpec()
// 7. For 'brew'/'node'/'go'/'uv': builds install command
//    - brew: resolves brew executable, checks availability
//    - node: uses nodeManager preference (npm/pnpm/yarn/bun) with -g --ignore-scripts
//    - go: auto-installs go via brew/apt if not present
//    - uv: auto-installs uv via brew if not present
// 8. Runs command with timeout (default 300s, max 900s)
// 9. Returns { ok, message, stdout, stderr, code, warnings? }
```

### Install Option Structure on SkillStatusEntry (Verified)
```typescript
// Source: openclaw/src/agents/skills-status.ts lines 131-152
// Each install option in the `install` array:
{
  id: string;          // e.g. "brew-0", "node-1", or explicit from metadata
  kind: string;        // "brew" | "node" | "go" | "uv" | "download"
  label: string;       // human-readable, e.g. "Install ffmpeg (brew)", "Install @anthropic/sdk (npm)"
  bins: string[];      // binaries this installer provides
}

// The install array is pre-sorted by preference:
// 1. brew (if preferBrew && available)
// 2. uv
// 3. node
// 4. go
// 5. brew (if not preferred but available)
// 6. download
// First option (install[0]) is the recommended one.
```

### canInstall Helper (Verified)
```typescript
// Source: openclaw/ui/src/ui/views/skills.ts line 115
// Only show install when there are both install options AND missing binaries
function canInstallSkill(skill: SkillStatusEntry): boolean {
  return skill.install.length > 0 && skill.missing.bins.length > 0;
}
```

### Reference UI Install Flow (Verified)
```typescript
// Source: openclaw/ui/src/ui/controllers/skills.ts lines 125-157
// The reference UI:
// 1. Sets skillsBusyKey to the skillKey being installed
// 2. Clears any previous error
// 3. Calls skills.install with { name, installId, timeoutMs: 120000 }
// 4. On success: re-fetches skills.status, shows success message
// 5. On error: shows error message on the skill
// 6. Always clears skillsBusyKey in finally block

// The reference UI uses skill.install[0].id for the installId
// and skill.name for the name param.
// It shows the install[0].label on the button text.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual terminal install | `skills.install` gateway method | Current | Frontend can trigger install with a single API call |
| Show install instructions only | Actionable install button | Current (this phase) | Users don't need to open terminal |

## Open Questions

1. **Concurrent installs**
   - What we know: The gateway does not prevent concurrent `skills.install` calls. The reference UI uses a single `skillsBusyKey` which effectively serializes installs.
   - Recommendation: Track a single `installingSkill` state. Disable install buttons on other skills while one is installing. This prevents confusion from concurrent installs without needing server-side locking.

2. **Install error verbosity**
   - What we know: On failure, the gateway throws with `result.message` which can be long (includes brew/npm error output). The `formatInstallFailureMessage()` function formats the error.
   - Recommendation: Show the full error message inline on the card. The error text area already handles overflow via the card layout. Consider truncating to first 200 chars if the message is very long, with "..." suffix.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured) |
| Config file | vite.config.ts (Vitest integrated) |
| Quick run command | `pnpm exec vitest run --reporter=verbose` |
| Full suite command | `pnpm exec vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKIL-05 | Install button shown only when canInstall is true | unit | `pnpm exec vitest run src/components/settings/skills-utils.test.ts -x` | No - Wave 0 |
| SKIL-05 | Install calls skills.install with correct params (name, installId) | unit | `pnpm exec vitest run src/components/settings/SkillsSection.test.tsx -x` | No - Wave 0 |
| SKIL-05 | Install button hidden when no install options available | unit | `pnpm exec vitest run src/components/settings/SkillsSection.test.tsx -x` | No - Wave 0 |
| SKIL-05 | Installing state shows spinner and "Installing..." text | unit | `pnpm exec vitest run src/components/settings/SkillsSection.test.tsx -x` | No - Wave 0 |
| SKIL-05 | Install error shows inline error text with auto-dismiss | unit | `pnpm exec vitest run src/components/settings/SkillsSection.test.tsx -x` | No - Wave 0 |
| SKIL-05 | skills.status re-fetched after successful install | unit | `pnpm exec vitest run src/components/settings/SkillsSection.test.tsx -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm exec vitest run --reporter=verbose`
- **Per wave merge:** `pnpm exec vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/settings/skills-utils.test.ts` -- add `canInstallSkill()` tests
- [ ] `src/components/settings/SkillsSection.test.tsx` -- add install button rendering and interaction tests
- [ ] Verify `@testing-library/react` is available: `pnpm list @testing-library/react`

## Sources

### Primary (HIGH confidence)
- `openclaw/src/gateway/server-methods/skills.ts` lines 114-145 -- `skills.install` handler, confirms params shape (`name`, `installId`, `timeoutMs`), response behavior (ok/error)
- `openclaw/src/gateway/protocol/schema/agents-models-skills.ts` lines 192-199 -- `SkillsInstallParamsSchema`, confirms exact param types
- `openclaw/src/agents/skills-install.ts` -- full `installSkill()` implementation, confirms `SkillInstallResult` shape, timeout handling, command building, failure cases
- `openclaw/src/agents/skills-status.ts` lines 131-152 -- install option resolution, confirms `id`, `kind`, `label`, `bins` fields and sort order
- `openclaw/ui/src/ui/controllers/skills.ts` lines 125-157 -- reference `installSkill()` implementation, confirms `timeoutMs: 120000`, `skill.name` and `skill.install[0].id` usage
- `openclaw/ui/src/ui/views/skills.ts` lines 115, 155-163 -- reference UI install button, confirms `canInstall` guard (`install.length > 0 && missing.bins.length > 0`)

### Secondary (MEDIUM confidence)
- `src/components/settings/SkillsSection.tsx` -- current Phase 2-3 implementation, existing card structure and state patterns
- `src/components/settings/skills-utils.ts` -- current types and utilities

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all libraries already in project
- Architecture: HIGH - direct source code access to `skills.install` handler, schema, install implementation, and reference UI
- Pitfalls: HIGH - identified from actual server code analysis (name vs skillKey, response shape, timeout behavior, canInstall guard)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- OpenClaw skills.install API is established)
