# Phase 3: Skills Control - Research

**Researched:** 2026-03-14
**Domain:** OpenClaw skills.update API + React toggle/API-key UI
**Confidence:** HIGH

## Summary

Phase 3 adds interactive controls to the existing Phase 2 skill cards: a toggle switch for enabling/disabling skills, and an inline API key input for skills that require one. The OpenClaw gateway provides a `skills.update` method that accepts `{ skillKey, enabled?, apiKey?, env? }` and writes directly to the config file without triggering a gateway restart. Changes take effect immediately because `skills.status` reads fresh config on every call.

The `primaryEnv` field on `SkillStatusEntry` is the signal that a skill needs an API key. When `apiKey` is saved via `skills.update`, the gateway maps it to satisfy the env requirement matching `primaryEnv`. The existing Phase 2 code (`SkillsSection.tsx`, `skills-utils.ts`) provides the card grid, status badges, and grouping logic. This phase adds the toggle to the compact card view and the API key input to the expanded card view, plus a re-fetch of `skills.status` after each mutation to update card states.

**Primary recommendation:** Call `gateway.request("skills.update", { skillKey, enabled })` for toggle and `gateway.request("skills.update", { skillKey, apiKey })` for API key save. Re-fetch `skills.status` after each mutation to refresh card states. Use optimistic UI for toggle with revert on error.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Toggle switch visible on the compact card (top-right corner), no need to expand
- Unavailable skills show the toggle but grayed out/disabled -- shows the skill exists but can't be enabled yet
- Optimistic update: toggle flips immediately, reverts if gateway call fails
- Error shown as inline red text near the toggle explaining what went wrong
- Text input appears inline in the expanded card view (where the "Needs API key" message currently shows)
- Explicit Save button next to the input -- user clicks to confirm
- API keys masked with dots/asterisks, with a reveal toggle (eye icon)

### Claude's Discretion
- Toggle switch component styling (custom or Tailwind utility)
- Save button styling and placement relative to input
- Error message auto-dismiss timing
- Whether to show a success indicator after API key save

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SKIL-02 | User can toggle skills on and off | `skills.update` accepts `{ skillKey, enabled: boolean }`. Writes `skills.entries[skillKey].enabled` to config. No restart needed -- next `skills.status` call reflects the change. OpenClaw UI reference uses `updateSkillEnabled()` pattern with busy state tracking and post-update refresh. |
| SKIL-03 | User can enter API keys for skills that require them | `skills.update` accepts `{ skillKey, apiKey: string }`. Gateway normalizes the key (strips line breaks, non-Latin1 chars). The `primaryEnv` field on `SkillStatusEntry` indicates a skill needs an API key. When `apiKey` is set and `primaryEnv` matches an env requirement, the requirement is satisfied. OpenClaw UI reference uses `saveSkillApiKey()` pattern with local edit state. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI components | Already in project |
| TypeScript | - | Type safety | Already in project |
| Tailwind CSS | 3.4 | Styling (toggle, input, button) | Already in project |
| lucide-react | - | Eye/EyeOff icons for API key reveal | Already used throughout settings |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gateway-client | local | `gateway.request("skills.update", ...)` | Toggle and API key save |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom toggle via Tailwind | headlessui Switch or radix-ui toggle | Custom Tailwind is simpler, no new dependency, matches existing project style |
| Local component state for edits | Zustand skills store | Local state is sufficient -- only SkillsSection needs the edit state. Keep it simple. |

**Installation:**
No new dependencies needed. All libraries already in project.

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    settings/
      SkillsSection.tsx       # Modified: add toggle + API key input
      skills-utils.ts          # Modified: add SkillUpdateParams type
```

No new files needed. This phase modifies the existing SkillsSection.tsx and skills-utils.ts from Phase 2.

### Pattern 1: skills.update Gateway Call
**What:** Call the gateway to toggle a skill or save an API key.
**When to use:** User clicks toggle or Save button.
**Example:**
```typescript
// Source: openclaw/src/gateway/protocol/schema/agents-models-skills.ts (SkillsUpdateParamsSchema)
// Source: openclaw/src/gateway/server-methods/skills.ts (handler)

// Toggle enabled/disabled
await gateway.request("skills.update", {
  skillKey: skill.skillKey,
  enabled: !skill.disabled,  // flip current state
});

// Save API key
await gateway.request("skills.update", {
  skillKey: skill.skillKey,
  apiKey: inputValue,        // gateway normalizes (strips CR/LF, non-Latin1)
});

// Response shape: { ok: true, skillKey: string, config: { enabled?: boolean, apiKey?: string, env?: Record<string,string> } }
```

### Pattern 2: Optimistic Toggle with Revert
**What:** Flip the toggle immediately in local state, revert if the gateway call fails.
**When to use:** User clicks the toggle switch.
**Example:**
```typescript
// Source: CONTEXT.md decision -- optimistic update with revert on failure

async function handleToggle(skill: SkillStatusEntry) {
  // 1. Optimistic: update local report state immediately
  setReport(prev => {
    if (!prev) return prev;
    return {
      ...prev,
      skills: prev.skills.map(s =>
        s.skillKey === skill.skillKey
          ? { ...s, disabled: !s.disabled }
          : s
      ),
    };
  });
  setError(null);

  try {
    // 2. Send to gateway
    await gateway.request("skills.update", {
      skillKey: skill.skillKey,
      enabled: skill.disabled,  // was disabled -> enable (flip)
    });
    // 3. Refresh full status to get accurate eligibility
    await loadSkills();
  } catch (err) {
    // 4. Revert on failure
    setReport(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        skills: prev.skills.map(s =>
          s.skillKey === skill.skillKey
            ? { ...s, disabled: skill.disabled }  // restore original
            : s
        ),
      };
    });
    setSkillError(skill.skillKey, err instanceof Error ? err.message : String(err));
  }
}
```

### Pattern 3: API Key Edit State
**What:** Track per-skill API key input values locally, submit on Save.
**When to use:** User types in the API key input and clicks Save.
**Example:**
```typescript
// Source: openclaw/ui/src/ui/controllers/skills.ts (updateSkillEdit, saveSkillApiKey pattern)

const [edits, setEdits] = useState<Record<string, string>>({});
const [busyKey, setBusyKey] = useState<string | null>(null);

function handleEdit(skillKey: string, value: string) {
  setEdits(prev => ({ ...prev, [skillKey]: value }));
}

async function handleSaveApiKey(skillKey: string) {
  setBusyKey(skillKey);
  try {
    const apiKey = edits[skillKey] ?? "";
    await gateway.request("skills.update", { skillKey, apiKey });
    await loadSkills();
    // Clear edit state after successful save
    setEdits(prev => {
      const next = { ...prev };
      delete next[skillKey];
      return next;
    });
    setSkillMessage(skillKey, { kind: "success", message: "API key saved" });
  } catch (err) {
    setSkillError(skillKey, err instanceof Error ? err.message : String(err));
  } finally {
    setBusyKey(null);
  }
}
```

### Pattern 4: Detecting API Key Requirement
**What:** Check if a skill needs an API key.
**When to use:** Deciding whether to show the API key input in expanded view.
**Example:**
```typescript
// Source: openclaw/src/agents/skills-status.ts line 186 -- primaryEnv maps apiKey to env satisfaction

function skillNeedsApiKey(skill: SkillStatusEntry): boolean {
  // primaryEnv indicates the skill has an API key requirement
  return Boolean(skill.primaryEnv);
}

function skillHasApiKeyMissing(skill: SkillStatusEntry): boolean {
  // Check if the primary env is in the missing env list
  return Boolean(
    skill.primaryEnv && skill.missing.env.includes(skill.primaryEnv)
  );
}
```

### Pattern 5: Toggle Placement with stopPropagation
**What:** Toggle in compact card header must not trigger card expand/collapse.
**When to use:** Placing interactive controls inside a clickable card.
**Example:**
```typescript
// Source: CONTEXT.md -- toggle on compact card, card click expands

<div onClick={onToggle}> {/* card expand/collapse */}
  <div className="flex items-center gap-2">
    {/* ... name, badge ... */}
    <button
      onClick={(e) => {
        e.stopPropagation();  // prevent card expand
        handleToggle(skill);
      }}
      disabled={status === "unavailable" || busyKey === skill.skillKey}
      className={/* toggle styling */}
    >
      {/* toggle switch */}
    </button>
  </div>
</div>
```

### Anti-Patterns to Avoid
- **Using config.patch for skill updates:** Don't use `patchConfig()` from config-helpers.ts. The gateway has a dedicated `skills.update` method that handles config writes internally. Using `config.patch` would trigger an unnecessary gateway restart.
- **Forgetting to re-fetch skills.status after mutation:** The optimistic update covers the toggle visually, but you must still call `skills.status` to get accurate eligibility (e.g., after saving an API key, the skill may become eligible).
- **Sending empty apiKey to clear:** Sending `apiKey: ""` deletes the key from config (gateway trims to empty, then deletes). This is correct for "clear API key" but may surprise if used accidentally.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key normalization | Custom trimming/sanitization | Gateway's `normalizeSecretInput()` | Handles CR/LF stripping, non-Latin1 removal, whitespace trim server-side |
| Config persistence | Manual config file writes via patchConfig | `skills.update` gateway method | Method handles config read/merge/write atomically, no restart |
| Eligibility recomputation | Client-side eligibility check after toggle | Re-fetch `skills.status` | Gateway computes eligibility from all requirement types server-side |
| Toggle component | npm toggle library | Tailwind CSS custom toggle | Simple `<button>` with `w-8 h-4 rounded-full` + inner circle works fine, no dependency needed |

**Key insight:** `skills.update` handles everything server-side (config read, merge, normalize, write). The frontend just sends the intent and refreshes the display.

## Common Pitfalls

### Pitfall 1: Using config.patch Instead of skills.update
**What goes wrong:** Calling `patchConfig({ skills: { entries: { [key]: { enabled: true } } } })` triggers a gateway restart (2s delay, WebSocket disconnect/reconnect cycle).
**Why it happens:** Phase 1 established `patchConfig()` as the standard for config writes. Developer might default to it.
**How to avoid:** Use `gateway.request("skills.update", { skillKey, enabled })` which calls `writeConfigFile()` directly -- no restart, no reconnect, instant effect.
**Warning signs:** Gateway disconnects briefly after toggling a skill.

### Pitfall 2: Not Handling Unavailable Skills in Toggle
**What goes wrong:** User toggles an unavailable skill to "enabled" but it still shows as unavailable because requirements are not met.
**Why it happens:** `enabled` and `eligible` are separate concepts. A skill can be enabled but not eligible (missing bins/env/config).
**How to avoid:** CONTEXT.md says unavailable skills show the toggle grayed out/disabled. The toggle should be disabled when `getSkillDisplayStatus(skill) === "unavailable"`. However, note: a skill that was manually disabled AND has missing requirements should still allow the toggle (to re-enable it once requirements are met). The correct check is: disable toggle when `!skill.disabled && !skill.eligible` (skill is already enabled-ish but can't run). Actually simpler: just check `skill.eligible === false && !skill.disabled` -- if it's unavailable due to requirements (not user-disabled), gray out.
**Warning signs:** User enables an unavailable skill, status changes to "Enabled" briefly then back to "Unavailable" after refresh.

### Pitfall 3: Toggle State Mismatch with `disabled` Field
**What goes wrong:** Toggle visual state is inverted.
**Why it happens:** The `disabled` field means "user turned this OFF". So `disabled: false` = toggle ON, `disabled: true` = toggle OFF. The `enabled` param in `skills.update` is the opposite: `enabled: true` means "turn ON" (sets `disabled: false` in config... wait, let me verify).
**How to avoid:** Check the server code: `current.enabled = p.enabled`. The config stores `enabled` (not `disabled`). But `SkillStatusEntry.disabled` is derived. The OpenClaw UI calls `onToggle(skill.skillKey, skill.disabled)` and the controller sends `enabled: skill.disabled` (if disabled, enable; if not disabled, disable -- it flips). Use the same pattern: `enabled: skill.disabled` (send the opposite of current state).
**Warning signs:** Toggling a skill ON actually disables it.

### Pitfall 4: API Key Input Showing Stored Value
**What goes wrong:** Displaying the stored API key in the input field.
**Why it happens:** Developer tries to pre-fill the input with the current key.
**How to avoid:** The `skills.status` response does NOT return stored API keys (security -- confirmed by test `server.skills-status.test.ts`). The input should start empty. If `primaryEnv` is NOT in `missing.env`, show a placeholder like "Key saved" or a visual indicator that a key exists. The `configChecks` array shows satisfaction status.
**Warning signs:** API key input always shows empty even when a key is saved, with no indication to the user.

### Pitfall 5: Missing stopPropagation on Toggle Click
**What goes wrong:** Clicking the toggle also expands/collapses the card.
**Why it happens:** The card has an `onClick` handler for expand/collapse. Event bubbles up.
**How to avoid:** Call `e.stopPropagation()` on the toggle click handler.
**Warning signs:** Card expands every time user toggles the skill.

## Code Examples

### skills.update API Schema (Verified)
```typescript
// Source: openclaw/src/gateway/protocol/schema/agents-models-skills.ts lines 201-209
// SkillsUpdateParamsSchema (TypeBox)
{
  skillKey: NonEmptyString,          // required -- identifies the skill
  enabled: Type.Optional(Boolean),   // optional -- true to enable, false to disable
  apiKey: Type.Optional(String),     // optional -- API key value (empty string deletes)
  env: Type.Optional(Record<NonEmptyString, String>), // optional -- env overrides
}
```

### skills.update Server Behavior (Verified)
```typescript
// Source: openclaw/src/gateway/server-methods/skills.ts lines 146-203
// 1. Reads current config via loadConfig()
// 2. Gets or creates skills.entries[skillKey] object
// 3. If enabled provided: sets current.enabled = enabled
// 4. If apiKey provided: normalizes (strip CR/LF, non-Latin1), sets current.apiKey (or deletes if empty)
// 5. If env provided: merges into current.env (empty values delete keys)
// 6. Writes entire config via writeConfigFile() -- NO restart triggered
// 7. Responds: { ok: true, skillKey, config: current }
```

### skills.update Response Shape
```typescript
// Source: openclaw/src/gateway/server-methods/skills.ts line 202
type SkillsUpdateResult = {
  ok: true;
  skillKey: string;
  config: {
    enabled?: boolean;
    apiKey?: string;
    env?: Record<string, string>;
  };
};
```

### Determining If API Key Is Already Set
```typescript
// The skills.status response does NOT leak API key values.
// Use configChecks or missing.env to determine if key is set:
function hasApiKeySet(skill: SkillStatusEntry): boolean {
  if (!skill.primaryEnv) return false;
  // If primaryEnv is NOT in missing.env, the key is set
  return !skill.missing.env.includes(skill.primaryEnv);
}
```

### Tailwind Toggle Switch
```typescript
// Custom toggle using Tailwind -- no library needed
function ToggleSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange();
      }}
      disabled={disabled}
      className={`
        relative inline-flex h-5 w-9 items-center rounded-full transition-colors
        ${checked ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]/30"}
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <span
        className={`
          inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform
          ${checked ? "translate-x-4" : "translate-x-0.5"}
        `}
      />
    </button>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual config.json editing | `skills.update` gateway method | Current | Frontend sends intent, gateway handles config atomically |
| Gateway restart after config change | `writeConfigFile()` without restart | Current | Skills toggle is instant, no WebSocket reconnection |
| Per-env variable config | `apiKey` field on skill entry | Current | Single API key per skill via `primaryEnv` mapping |

## Open Questions

1. **Toggle behavior for disabled+unavailable skills**
   - What we know: A skill can be both `disabled: true` AND have missing requirements. CONTEXT.md says unavailable skills show toggle grayed out.
   - What's unclear: Should a user-disabled skill with missing requirements show toggle as enabled (to allow re-disabling) or grayed out?
   - Recommendation: If `skill.disabled`, show toggle in OFF position but enabled (clickable) -- user can flip it. If `!skill.disabled && !skill.eligible`, show toggle grayed out (requirements not met, can't really enable). This matches the server logic: `enabled` param just sets the config flag regardless of eligibility.

2. **Success indicator after API key save**
   - What we know: CONTEXT.md lists this as Claude's discretion. OpenClaw UI shows `{ kind: "success", message: "API key saved" }` per-skill messages.
   - Recommendation: Show brief green "Saved" text near the Save button that auto-dismisses after 3 seconds. Simple and consistent with the error message pattern.

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
| SKIL-02 | Toggle calls skills.update with correct params | unit | `pnpm exec vitest run src/components/settings/SkillsSection.test.tsx -x` | No - Wave 0 |
| SKIL-02 | Optimistic toggle reverts on error | unit | `pnpm exec vitest run src/components/settings/SkillsSection.test.tsx -x` | No - Wave 0 |
| SKIL-02 | Unavailable skills have disabled toggle | unit | `pnpm exec vitest run src/components/settings/SkillsSection.test.tsx -x` | No - Wave 0 |
| SKIL-03 | API key input visible for skills with primaryEnv | unit | `pnpm exec vitest run src/components/settings/SkillsSection.test.tsx -x` | No - Wave 0 |
| SKIL-03 | Save button calls skills.update with apiKey | unit | `pnpm exec vitest run src/components/settings/SkillsSection.test.tsx -x` | No - Wave 0 |
| SKIL-03 | API key masked by default, reveal toggle works | unit | `pnpm exec vitest run src/components/settings/SkillsSection.test.tsx -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm exec vitest run --reporter=verbose`
- **Per wave merge:** `pnpm exec vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/settings/SkillsSection.test.tsx` -- extend existing test file (if created in Phase 2) or create new; covers SKIL-02 toggle behavior and SKIL-03 API key input
- [ ] Verify `@testing-library/react` is available: `pnpm list @testing-library/react`

## Sources

### Primary (HIGH confidence)
- `openclaw/src/gateway/server-methods/skills.ts` -- `skills.update` handler implementation (lines 146-203), confirms params, config write behavior, no restart
- `openclaw/src/gateway/protocol/schema/agents-models-skills.ts` -- `SkillsUpdateParamsSchema` (lines 201-209), confirms exact param types
- `openclaw/src/gateway/server-methods/skills.update.normalizes-api-key.test.ts` -- confirms apiKey normalization (CR/LF stripping)
- `openclaw/src/agents/skills-status.ts` -- confirms `primaryEnv` -> `apiKey` satisfaction mapping (line 186)
- `openclaw/src/utils/normalize-secret-input.ts` -- confirms server-side key normalization behavior
- `openclaw/ui/src/ui/controllers/skills.ts` -- reference implementation of `updateSkillEnabled()`, `saveSkillApiKey()`, `updateSkillEdit()` patterns
- `openclaw/ui/src/ui/views/skills.ts` -- reference UI for toggle button and API key input placement

### Secondary (MEDIUM confidence)
- `src/components/settings/SkillsSection.tsx` -- Phase 2 output, existing card structure to modify
- `src/components/settings/skills-utils.ts` -- Phase 2 output, existing types and utilities
- `src/api/config-helpers.ts` -- confirms `patchConfig()` triggers restart (NOT what we want for skills)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all patterns verified from source
- Architecture: HIGH - direct source code access to `skills.update` handler, schema, and reference UI
- Pitfalls: HIGH - identified from actual server code analysis (config.patch vs writeConfigFile, disabled vs eligible, primaryEnv mapping)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- OpenClaw skills.update API is established)
