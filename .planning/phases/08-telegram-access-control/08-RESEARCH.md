# Phase 8: Telegram Access Control - Research

**Researched:** 2026-03-15
**Domain:** Telegram DM/group allow-list configuration UI, tag/chip input component, OpenClaw config structure
**Confidence:** HIGH

## Summary

This phase replaces the single comma-separated `allowFrom` text input in `IMChannelsSection.tsx` with three separate tag/chip-style inputs for `allowFrom`, `groups`, and `groupAllowFrom`, matching OpenClaw's actual config structure. The existing component already has `allowFrom` state (loaded as `string[]`, displayed as comma-joined string) and `dmPolicy`/`groupPolicy` dropdowns. The main work is: (1) build a reusable tag/chip input component, (2) split the single `allowFrom` field into three distinct fields, (3) wire `groupAllowFrom` which is currently missing from the UI entirely, and (4) handle the `groups` field which is a `Record<string, TelegramGroupConfig>` in OpenClaw (not a simple array).

A critical finding is that OpenClaw's `groups` config is `Record<string, TelegramGroupConfig>` -- a map of group chat IDs to per-group config objects. For the UI, we only need to manage the keys (group chat IDs) since per-group config (requireMention, skills, systemPrompt, etc.) is out of scope. The simplest approach is to create/remove group entries with minimal default config (`{}`). Another important finding: OpenClaw validates that `dmPolicy: "allowlist"` requires a non-empty `allowFrom`, and similarly group allowlist logic checks `groupAllowFrom` entries. The UI should enforce or warn about this.

**Primary recommendation:** Build a `TagInput` component for chip-style entry, use it for all three fields, and conditionally show each field based on the corresponding policy dropdown value. Save all three fields through `patchConfig()` in a single batch save.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Tag/chip-style inputs: each entry is a removable chip, with a text input to add new ones
- Replaces current comma-separated text inputs
- Batch save with explicit Save button -- collect all changes, user clicks Save to apply
- Three separate fields matching OpenClaw's config:
  1. `allowFrom` -- Telegram usernames allowed to DM the bot
  2. `groups` -- Telegram group chat IDs the bot serves
  3. `groupAllowFrom` -- Telegram usernames allowed to talk to the bot in groups

### Field labels & guidance
- Clear labels for each field + short inline help text below explaining what it controls
- Help text should clarify the distinction between the three fields

### Claude's Discretion
- Exact chip/tag component design (custom or pattern from existing UI)
- Help text wording
- How to handle invalid entries (empty strings, duplicates)
- Whether to show the DM policy / group policy dropdowns alongside or integrate them

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TELE-02 | User can configure DM allow-list (which users can message the bot) | `allowFrom: Array<string \| number>` field in `TelegramAccountConfig`; conditional on `dmPolicy: "allowlist"`; existing state + save flow in IMChannelsSection; tag/chip input replaces comma text |
| TELE-03 | User can configure group allow-list (which groups the bot serves) | `groups: Record<string, TelegramGroupConfig>` for group chat IDs; `groupAllowFrom: Array<string \| number>` for sender filtering in groups; conditional on `groupPolicy: "allowlist"`; `groupAllowFrom` is NOT in the current UI and must be added |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI framework | Already in project |
| Tailwind CSS | 3.4 | Styling | Already in project |
| lucide-react | (installed) | Icons (X for chip remove, Plus for add) | Already used throughout settings |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gateway-client | local | WebSocket gateway communication | For `config.get` reads |
| config-helpers | local | `patchConfig()` + `waitForReconnect()` | For saving allow-list changes |

No new dependencies needed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom TagInput | react-tag-input / react-select | Overkill for simple chip input; adds dependency; custom is ~60 lines |

## Architecture Patterns

### File Structure
```
src/
└── components/
    └── settings/
        ├── IMChannelsSection.tsx   # Modify: replace allowFrom input, add groups + groupAllowFrom
        └── TagInput.tsx            # NEW: reusable tag/chip input component
```

### Pattern 1: TagInput Component
**What:** A reusable component that renders chips for existing entries and a text input for adding new ones.
**When to use:** For all three allow-list fields.

```typescript
// TagInput.tsx
interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** Validate before adding -- return error message or null if valid */
  validate?: (value: string) => string | null;
}

export function TagInput({ tags, onChange, placeholder, validate }: TagInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addTag() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      setError("Already added");
      return;
    }
    if (validate) {
      const err = validate(trimmed);
      if (err) { setError(err); return; }
    }
    onChange([...tags, trimmed]);
    setInput("");
    setError(null);
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  // Enter key to add, render chips with X button
  // ...
}
```

### Pattern 2: Three Separate State Arrays
**What:** Replace the single `allowFrom` string state with three typed arrays.
**When to use:** In IMChannelsSection state management.

```typescript
// Current (Phase 7):
const [allowFrom, setAllowFrom] = useState("");  // comma-separated string

// New (Phase 8):
const [allowFromList, setAllowFromList] = useState<string[]>([]);      // DM allowlist
const [groupIds, setGroupIds] = useState<string[]>([]);                 // Group chat IDs
const [groupAllowFromList, setGroupAllowFromList] = useState<string[]>([]); // Group sender allowlist
```

### Pattern 3: Config Load -- Extracting groups Keys
**What:** The `groups` config is `Record<string, TelegramGroupConfig>`, so we extract just the keys for the UI.
**When to use:** In `loadTelegramConfig()`.

```typescript
// In loadTelegramConfig:
const tg = cfg.channels?.telegram ?? {};
setAllowFromList(
  (tg.allowFrom ?? []).map(String)  // Array<string|number> -> string[]
);
setGroupIds(
  Object.keys(tg.groups ?? {})  // Record keys = group chat IDs
);
setGroupAllowFromList(
  (tg.groupAllowFrom ?? []).map(String)
);
```

### Pattern 4: Config Save -- groups as Record
**What:** When saving, convert the `groupIds` array back into a `Record<string, TelegramGroupConfig>`.
**When to use:** In `saveTelegramConfig()`.

```typescript
// Build groups Record from the array of chat IDs
const groupsRecord: Record<string, Record<string, unknown>> = {};
for (const id of groupIds) {
  groupsRecord[id] = {};  // Minimal config -- just registers the group
}

const telegramConfig = {
  enabled: true,
  botToken: botToken.trim() || undefined,
  dmPolicy,
  groupPolicy,
  ...(allowFromList.length > 0 ? { allowFrom: allowFromList } : {}),
  ...(groupIds.length > 0 ? { groups: groupsRecord } : {}),
  ...(groupAllowFromList.length > 0 ? { groupAllowFrom: groupAllowFromList } : {}),
};

await patchConfig({ channels: { telegram: telegramConfig } });
```

**IMPORTANT:** `patchConfig` uses RFC 7396 merge-patch. For arrays (`allowFrom`, `groupAllowFrom`), the patch REPLACES the entire array (merge-patch does not merge arrays). For objects (`groups`), merge-patch deep-merges, so existing group configs with extra fields (requireMention, skills, etc.) are preserved -- only new keys are added and missing keys are retained. However, REMOVING a group requires setting its key to `null` in the patch. The simplest approach: send the full `groups` Record each time. If a group was removed, it won't be in the Record, but merge-patch won't delete it. To delete, explicitly set removed groups to `null`.

### Pattern 5: Handling Group Removal with Merge-Patch
**What:** To remove a group from config, you must set its key to `null` (merge-patch delete semantics).
**When to use:** When saving after removing a group from the tag list.

```typescript
// Compare current groupIds with what was loaded to detect removals
const removedGroups = loadedGroupIds.filter(id => !groupIds.includes(id));
const groupsRecord: Record<string, Record<string, unknown> | null> = {};
for (const id of groupIds) {
  groupsRecord[id] = {};  // Keep/add
}
for (const id of removedGroups) {
  groupsRecord[id] = null;  // Delete via merge-patch
}
```

### Pattern 6: Conditional Field Visibility
**What:** Show each allow-list field only when the corresponding policy is set to "allowlist".
**When to use:** In the JSX render.

```typescript
{dmPolicy === "allowlist" && (
  <TagInput
    tags={allowFromList}
    onChange={setAllowFromList}
    placeholder="Enter Telegram user ID..."
  />
)}

{groupPolicy === "allowlist" && (
  <>
    <TagInput tags={groupIds} onChange={setGroupIds} placeholder="Enter group chat ID..." />
    <TagInput tags={groupAllowFromList} onChange={setGroupAllowFromList} placeholder="Enter user ID..." />
  </>
)}
```

### Anti-Patterns to Avoid
- **Don't merge allowFrom and groupAllowFrom into one field:** OpenClaw treats them separately. DM allow-list controls who can DM; group sender allow-list controls who can talk in allowed groups. They serve different purposes.
- **Don't store groups as an array:** The config expects `Record<string, TelegramGroupConfig>`. Converting to/from arrays at the UI boundary is correct.
- **Don't send empty arrays for unset fields:** Merge-patch replaces arrays. Sending `allowFrom: []` would set an empty allowFrom, which combined with `dmPolicy: "allowlist"` triggers a validation error in OpenClaw. Omit the field or send `null` to delete.
- **Don't forget merge-patch delete semantics for group removal:** Simply omitting a group key from the patch will NOT remove it. Must explicitly set to `null`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config saving | Custom HTTP/file writes | `patchConfig()` from config-helpers.ts | Handles optimistic locking, merge semantics, gateway restart |
| Gateway communication | Raw WebSocket | `gateway.request()` from gateway-client.ts | Handles framing, auth, reconnection |
| Input validation | Complex validation library | Simple inline checks (empty, duplicate, format) | Only need basic checks for IDs/usernames |

## Common Pitfalls

### Pitfall 1: OpenClaw Validates allowlist + allowFrom Pairing
**What goes wrong:** User sets `dmPolicy: "allowlist"` but leaves `allowFrom` empty. Gateway rejects the config.
**Why it happens:** OpenClaw's `validateConfigObject()` checks that `dmPolicy: "allowlist"` has a non-empty `allowFrom`.
**How to avoid:** When saving with `dmPolicy: "allowlist"`, ensure `allowFromList.length > 0`. Show a warning in the UI if the user selects allowlist policy but has no entries.
**Warning signs:** Config save fails silently or gateway returns a validation error.
**Source:** `openclaw/src/config/config.allowlist-requires-allowfrom.test.ts` (HIGH confidence)

### Pitfall 2: groups is a Record, Not an Array
**What goes wrong:** Treating `groups` as `string[]` in the config patch sends an array, which the gateway rejects or ignores.
**Why it happens:** The CONTEXT.md says "group chat IDs" but the actual type is `Record<string, TelegramGroupConfig>`.
**How to avoid:** Convert between `string[]` (UI) and `Record<string, {}>` (config) at load/save boundaries.
**Warning signs:** Groups not being recognized after save.
**Source:** `openclaw/src/config/types.telegram.ts` line 100: `groups?: Record<string, TelegramGroupConfig>` (HIGH confidence)

### Pitfall 3: Merge-Patch Does Not Delete Missing Object Keys
**What goes wrong:** User removes a group from the UI, but it persists in config after save.
**Why it happens:** RFC 7396 merge-patch only deletes keys explicitly set to `null`. Missing keys are left unchanged.
**How to avoid:** Track which groups existed at load time. On save, set removed group IDs to `null` in the patch.
**Warning signs:** Removed groups reappear after page reload.
**Source:** `src/api/config-helpers.ts` JSDoc: "Setting a key to `null` in the patch will DELETE that key" (HIGH confidence)

### Pitfall 4: allowFrom Contains Numbers, Not Just Strings
**What goes wrong:** Type mismatch when reading/writing config. OpenClaw stores `Array<string | number>`.
**Why it happens:** Telegram user IDs are numeric, but config may store them as strings or numbers.
**How to avoid:** Convert all values to strings for the UI via `.map(String)`. When saving, strings are fine -- OpenClaw accepts both.
**Warning signs:** TypeScript type errors or comparison failures.
**Source:** `openclaw/src/config/types.telegram.ts` line 104: `allowFrom?: Array<string | number>` (HIGH confidence)

### Pitfall 5: Empty allowFrom Array vs. Omitted Field
**What goes wrong:** Sending `allowFrom: []` in a patch sets an empty array in config, which combined with `dmPolicy: "allowlist"` is invalid.
**Why it happens:** Merge-patch replaces arrays wholesale.
**How to avoid:** When `allowFromList` is empty, either omit the field from the patch (if policy is not "allowlist") or send `null` to delete it.
**Warning signs:** Gateway validation error after saving.

## Code Examples

### TelegramConfig Interface (Updated)
```typescript
// Expand existing interface to include groupAllowFrom and groups
interface TelegramConfig {
  enabled?: boolean;
  botToken?: string;
  dmPolicy?: string;
  groupPolicy?: string;
  allowFrom?: Array<string | number>;
  groupAllowFrom?: Array<string | number>;
  groups?: Record<string, Record<string, unknown>>;  // TelegramGroupConfig
}
```

### Load Config (Updated)
```typescript
async function loadTelegramConfig() {
  const result = await gateway.request<{
    config: Record<string, unknown>;
    hash: string;
  }>("config.get", {});
  const cfg = result.config as {
    channels?: { telegram?: TelegramConfig };
  };
  const tg = cfg.channels?.telegram ?? {};
  setTelegramCfg(tg);
  setBotToken(tg.botToken ?? "");
  setDmPolicy(tg.dmPolicy ?? "open");
  setGroupPolicy(tg.groupPolicy ?? "disabled");
  // Phase 8: three separate lists
  setAllowFromList((tg.allowFrom ?? []).map(String));
  setGroupIds(Object.keys(tg.groups ?? {}));
  setGroupAllowFromList((tg.groupAllowFrom ?? []).map(String));
  // Track loaded groups for deletion detection
  setLoadedGroupIds(Object.keys(tg.groups ?? {}));
}
```

### Save Config (Updated)
```typescript
async function saveTelegramConfig() {
  // ... validation ...

  // Build groups Record with deletion support
  const groupsRecord: Record<string, Record<string, unknown> | null> = {};
  for (const id of groupIds) {
    groupsRecord[id] = {};
  }
  // Detect removed groups and set to null for merge-patch deletion
  for (const id of loadedGroupIds) {
    if (!groupIds.includes(id)) {
      groupsRecord[id] = null;
    }
  }

  const telegramConfig: Record<string, unknown> = {
    enabled: true,
    botToken: botToken.trim() || undefined,
    dmPolicy,
    groupPolicy,
    allowFrom: allowFromList.length > 0 ? allowFromList : null,
    groupAllowFrom: groupAllowFromList.length > 0 ? groupAllowFromList : null,
    groups: Object.keys(groupsRecord).length > 0 ? groupsRecord : undefined,
  };

  await patchConfig({ channels: { telegram: telegramConfig } });
  // ... waitForReconnect, reload ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single comma-separated `allowFrom` text input | Three separate tag/chip inputs for `allowFrom`, `groups`, `groupAllowFrom` | This phase | Matches OpenClaw's actual config structure |
| `groupAllowFrom` not in UI | Exposed as dedicated tag input | This phase | Users can control group sender filtering |
| `groups` not in UI | Group chat IDs manageable via tag input | This phase | Users can control which groups the bot serves |

## Open Questions

1. **Preserving existing group configs on save**
   - What we know: Merge-patch deep-merges objects. Sending `groups: { "-100123": {} }` won't erase existing fields like `requireMention` on that group.
   - What's unclear: Whether sending `{}` for an existing group that has config will clear its config or merge (it should merge, leaving existing fields).
   - Recommendation: Safe to send `{}` for existing groups -- merge-patch will preserve their existing sub-fields. Only `null` deletes.

2. **User ID format guidance**
   - What we know: Telegram user IDs are numeric (e.g., `123456789`). Group chat IDs are negative (e.g., `-100123456789`).
   - What's unclear: Whether users will know their Telegram user/group IDs.
   - Recommendation: Include help text explaining where to find IDs (e.g., forwarding a message to @userinfobot or using the bot's received messages). This is UX guidance, not a blocker.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in MaxAuto frontend |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TELE-02 | DM allow-list tag input, add/remove chips, save via patchConfig | manual-only | Manual: add/remove users, save, verify config | N/A |
| TELE-03 | Group allow-list tag inputs (groups + groupAllowFrom), save correctly | manual-only | Manual: add/remove groups, save, verify config | N/A |

**Justification for manual-only:** Tauri desktop app with no frontend test infrastructure. Changes are UI-focused (tag input, conditional rendering) that require a running gateway to verify config persistence. The TagInput component is straightforward (~60 lines).

### Sampling Rate
- **Per task commit:** `pnpm build` (TypeScript compilation check)
- **Per wave merge:** Manual verification in dev mode
- **Phase gate:** Full manual verification per success criteria

### Wave 0 Gaps
None -- no test infrastructure exists for the frontend, and adding one is out of scope for this phase.

## Sources

### Primary (HIGH confidence)
- `openclaw/src/config/types.telegram.ts` -- Full `TelegramAccountConfig` type with `allowFrom`, `groupAllowFrom`, `groups` field types
- `openclaw/src/config/config.allowlist-requires-allowfrom.test.ts` -- Validates that allowlist policy requires non-empty allowFrom
- `openclaw/src/telegram/group-access.ts` -- Group access policy logic showing how groups config, groupAllowFrom, and groupPolicy interact
- `src/components/settings/IMChannelsSection.tsx` -- Current component with existing state, load/save, and policy dropdowns
- `src/api/config-helpers.ts` -- `patchConfig()` merge-patch semantics and `null` deletion behavior

### Secondary (MEDIUM confidence)
- `openclaw/src/config/types.base.ts` -- `DmPolicy` and `GroupPolicy` type definitions confirming policy values

### Tertiary (LOW confidence)
- None -- all findings verified from source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new deps
- Architecture: HIGH - patterns derived directly from OpenClaw type definitions and existing component code
- Pitfalls: HIGH - identified from real validation tests and merge-patch semantics documented in config-helpers

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- config types and merge-patch behavior are mature)
