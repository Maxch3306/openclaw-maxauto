# Phase 5: Workspace Defaults - Research

**Researched:** 2026-03-14
**Domain:** Tauri v2 dialog plugin, folder opening, OpenClaw config structure
**Confidence:** HIGH

## Summary

Phase 5 adds a Workspace settings section where users can view the current default workspace path, change it via a native folder picker, and open it in the system file manager. The implementation requires adding one new Tauri plugin (`@tauri-apps/plugin-dialog`) for the folder picker dialog, and can use the existing `@tauri-apps/plugin-shell` `open()` for opening folders in the file manager (with a caveat about a known Windows bug, discussed below).

The config path is `agents.defaults.workspace` in openclaw.json. The existing `patchConfig()` + `waitForReconnect()` pattern from Phase 1 handles the config write. The UI follows the established settings section pattern (standalone component in `src/components/settings/`, wired into `SettingsPage.tsx`).

**Primary recommendation:** Add `@tauri-apps/plugin-dialog` for folder picker; use existing `plugin-shell` `open()` for "Open in Explorer/Finder" (simplest approach given it already works in the project); follow `GeneralSection.tsx` layout patterns.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Show current workspace path, Change button (native folder picker), Open in Explorer/Finder button
- Include a brief description explaining what the workspace is for (where agents read/write files)
- Native folder picker via `@tauri-apps/plugin-dialog` (or Tauri open dialog)
- If selected directory doesn't exist: show confirmation dialog before applying
- Write new path to config via `patchConfig()` (Phase 1 infrastructure)

### Claude's Discretion
- Section layout and styling (consistent with other settings sections)
- Description text wording
- Confirmation dialog design for non-existent directory
- Whether to show the old path after changing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WORK-01 | User can view and change the default workspace directory via native folder picker | `@tauri-apps/plugin-dialog` `open({ directory: true })` for picker; `config.get` to read `agents.defaults.workspace`; `patchConfig()` to write |
| WORK-03 | User can open the workspace folder in the system file manager | Existing `@tauri-apps/plugin-shell` `open()` already imported in `tauri-commands.ts` as `openUrl()` |
</phase_requirements>

## Standard Stack

### Core (New Dependency)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tauri-apps/plugin-dialog` | ^2 | Native folder picker dialog | Official Tauri v2 plugin for file/directory selection dialogs |
| `tauri-plugin-dialog` (Rust) | 2 | Rust backend for dialog plugin | Required by JS plugin -- powers the native dialog under the hood |

### Already Available (No Install Needed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@tauri-apps/plugin-shell` | ^2 | Open folders in file manager via `open()` | Already in package.json + Cargo.toml + lib.rs |
| `patchConfig()` | -- | Config writes with merge-patch semantics | Phase 1 infrastructure in `config-helpers.ts` |
| `waitForReconnect()` | -- | Wait for gateway reconnect after config change | Phase 1 infrastructure in `config-helpers.ts` |
| `gateway.request("config.get")` | -- | Read current config including workspace path | Existing gateway client |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `plugin-dialog` for folder picker | Rust custom command with `rfd` crate | More code, no benefit -- plugin-dialog IS the standard |
| `plugin-shell` `open()` for folder | `@tauri-apps/plugin-opener` `revealPath()` | Opener is newer/better but adds another dependency; shell open() already works and is already installed |

**Installation:**
```bash
pnpm add @tauri-apps/plugin-dialog
cd src-tauri && cargo add tauri-plugin-dialog
```

## Architecture Patterns

### Recommended Component Structure
```
src/components/settings/
  WorkspaceSection.tsx    # New file -- workspace settings section
```

### Pattern: Settings Section Component
**What:** Standalone component following the established pattern from `GeneralSection.tsx`
**When to use:** All settings sections in this project

**Example layout (from GeneralSection.tsx):**
```typescript
// Standard settings section structure
export function WorkspaceSection() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-lg font-semibold text-[var(--color-text)] mb-6">Workspace</h1>

      <section className="mb-6">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Default Workspace</h2>
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
          {/* Description text */}
          {/* Current path display */}
          {/* Action buttons: Change, Open in Explorer */}
        </div>
      </section>
    </div>
  );
}
```

### Pattern: Folder Picker via plugin-dialog
**What:** Native OS folder selection dialog
**Example:**
```typescript
import { open } from "@tauri-apps/plugin-dialog";

const selected = await open({
  directory: true,
  title: "Select Workspace Directory",
});
// Returns string | null (null if user cancelled)
if (selected) {
  // selected is the absolute path string
}
```

### Pattern: Open Folder in File Manager
**What:** Opens a folder in Explorer/Finder using the existing shell open wrapper
**Example:**
```typescript
import { openUrl } from "../../api/tauri-commands";

// openUrl wraps @tauri-apps/plugin-shell open()
await openUrl(workspacePath);
```

### Pattern: Config Read/Write for Workspace
**What:** Reading and writing `agents.defaults.workspace` in openclaw.json
**Example:**
```typescript
// Read current workspace from config
const result = await gateway.request<{
  config: { agents?: { defaults?: { workspace?: string } } };
}>("config.get", {});
const workspace = result.config.agents?.defaults?.workspace ?? "~/.openclaw-maxauto/workspace";

// Write new workspace path
await patchConfig({
  agents: { defaults: { workspace: "/new/path" } },
});
await waitForReconnect();
```

### Pattern: SettingsPage Integration
**What:** Wire new section into the renderSection switch
**Where:** `src/pages/SettingsPage.tsx`
```typescript
// Add import
import { WorkspaceSection } from "../components/settings/WorkspaceSection";

// Add case in renderSection()
case "workspace":
  return <WorkspaceSection />;
```

### Anti-Patterns to Avoid
- **Don't use `writeConfig()` directly:** Always use `patchConfig()` for merge-patch semantics to avoid race conditions
- **Don't hardcode the default workspace path:** Read it from config.get; the default `~/.openclaw-maxauto/workspace` is set by the gateway, not the UI
- **Don't call shell open() twice rapidly on Windows:** Known freeze bug when Explorer is already open (unlikely in practice with single button click, but worth noting)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Folder picker dialog | Custom file browser UI | `@tauri-apps/plugin-dialog` `open({ directory: true })` | Native OS dialog is expected UX, handles all edge cases |
| Config write with restart | Direct file write + manual restart | `patchConfig()` + `waitForReconnect()` | Already built in Phase 1, handles optimistic locking + merge semantics |
| Directory existence check | Manual Rust command | Check after folder picker selection, before applying | The dialog plugin returns real paths; for typed-in paths, a simple confirmation is sufficient |

## Common Pitfalls

### Pitfall 1: Missing Plugin Registration in Rust
**What goes wrong:** Dialog picker silently fails or throws runtime error
**Why it happens:** Forgot to add `.plugin(tauri_plugin_dialog::init())` in `lib.rs`
**How to avoid:** Must add to the Tauri builder chain AND add `"dialog:default"` to capabilities
**Warning signs:** "plugin not initialized" errors in console

### Pitfall 2: Missing Capabilities Permission
**What goes wrong:** Dialog command blocked by Tauri security
**Why it happens:** Tauri v2 requires explicit capability permissions for all plugin commands
**How to avoid:** Add `"dialog:default"` to `src-tauri/capabilities/default.json` permissions array
**Warning signs:** Permission denied errors when calling `open()`

### Pitfall 3: Windows Shell Open Freeze
**What goes wrong:** App freezes when opening folder in Explorer
**Why it happens:** Known bug in `@tauri-apps/plugin-shell` when `open()` is called on a directory while Explorer is already open for that path
**How to avoid:** For v1 this is acceptable risk (single button, unlikely double-click scenario). If it becomes an issue, migrate to `@tauri-apps/plugin-opener` `revealPath()` later
**Warning signs:** App becomes unresponsive after clicking "Open in Explorer"

### Pitfall 4: Tilde Path Expansion
**What goes wrong:** `~/.openclaw-maxauto/workspace` displayed as-is, or patchConfig sends tilde path
**Why it happens:** The folder picker returns absolute paths, but the default value from config may use `~`
**How to avoid:** Display the path as stored in config (may use `~`); when user picks a new folder, the dialog returns absolute path which is fine to store
**Warning signs:** Path display showing `~` on Windows (where tilde is not standard)

### Pitfall 5: Gateway Restart After Config Change
**What goes wrong:** UI shows old workspace path after change
**Why it happens:** `patchConfig()` triggers gateway restart; need to wait for reconnect then reload config
**How to avoid:** Follow the `patchConfig()` + `waitForReconnect()` + reload pattern used in settings-store
**Warning signs:** Stale data displayed after saving

## Code Examples

### Complete Folder Picker Flow
```typescript
// Source: Tauri v2 dialog plugin docs + project patterns
import { open } from "@tauri-apps/plugin-dialog";
import { patchConfig, waitForReconnect } from "../../api/config-helpers";
import { gateway } from "../../api/gateway-client";

async function handleChangeWorkspace() {
  const selected = await open({
    directory: true,
    title: "Select Workspace Directory",
  });

  if (!selected) return; // User cancelled

  // TODO: optionally check if directory exists, show confirmation if not

  await patchConfig({
    agents: { defaults: { workspace: selected } },
  });
  await waitForReconnect();

  // Reload config to update displayed path
  // (either via store method or local state refresh)
}
```

### Open in File Manager
```typescript
// Source: existing project pattern in tauri-commands.ts
import { openUrl } from "../../api/tauri-commands";

async function handleOpenWorkspace(path: string) {
  try {
    await openUrl(path);
  } catch (err) {
    console.error("Failed to open workspace folder:", err);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `plugin-shell` `open()` for folders | `plugin-opener` `revealPath()` | Tauri v2.2+ | Opener is more reliable but shell still works; not critical to migrate now |
| `writeConfig()` full replace | `patchConfig()` merge-patch | Phase 1 of this project | Must use patchConfig for all config writes |

## Setup Checklist (New Dependencies)

1. **npm package:** `pnpm add @tauri-apps/plugin-dialog`
2. **Rust crate:** Add `tauri-plugin-dialog = "2"` to `src-tauri/Cargo.toml` `[dependencies]`
3. **Plugin init:** Add `.plugin(tauri_plugin_dialog::init())` to `src-tauri/src/lib.rs` builder chain
4. **Capabilities:** Add `"dialog:default"` to `src-tauri/capabilities/default.json` permissions array

## Current State of Project Files

### Files to Modify
| File | Change |
|------|--------|
| `package.json` | Add `@tauri-apps/plugin-dialog` dependency |
| `src-tauri/Cargo.toml` | Add `tauri-plugin-dialog = "2"` |
| `src-tauri/src/lib.rs` | Add `.plugin(tauri_plugin_dialog::init())` |
| `src-tauri/capabilities/default.json` | Add `"dialog:default"` to permissions |
| `src/pages/SettingsPage.tsx` | Import + wire `WorkspaceSection` in renderSection switch |

### Files to Create
| File | Purpose |
|------|---------|
| `src/components/settings/WorkspaceSection.tsx` | New workspace settings section component |

### Key Existing File Locations
| File | Relevance |
|------|-----------|
| `src/api/config-helpers.ts` | `patchConfig()`, `waitForReconnect()` |
| `src/api/tauri-commands.ts` | `openUrl()` wrapper for shell open |
| `src/api/gateway-client.ts` | `gateway.request()` for config.get |
| `src/stores/settings-store.ts` | `SettingsSection` type already includes `"workspace"` |
| `src/components/settings/GeneralSection.tsx` | Reference for UI patterns |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual testing (no automated test framework configured) |
| Config file | none |
| Quick run command | `pnpm build` (TypeScript check + Vite build) |
| Full suite command | `pnpm build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORK-01 | View current workspace path in settings | manual-only | N/A -- requires running Tauri app + gateway | N/A |
| WORK-01 | Change workspace via folder picker dialog | manual-only | N/A -- requires native OS dialog interaction | N/A |
| WORK-03 | Open workspace folder in file manager | manual-only | N/A -- requires OS file manager integration | N/A |

**Justification for manual-only:** All three behaviors require a running Tauri application with gateway connection and native OS dialog/file manager interaction. These cannot be meaningfully automated with unit tests. The `pnpm build` command validates TypeScript correctness and catches compilation errors.

### Sampling Rate
- **Per task commit:** `pnpm build`
- **Per wave merge:** `pnpm build` + manual verification in dev mode
- **Phase gate:** Manual walkthrough of all three behaviors in `pnpm tauri dev`

### Wave 0 Gaps
None -- no automated test infrastructure applicable for this UI/native integration phase.

## Open Questions

1. **Tilde vs absolute path display**
   - What we know: Config may store `~/.openclaw-maxauto/workspace` with tilde
   - What's unclear: Whether gateway config.get returns expanded or tilde path
   - Recommendation: Display as returned from config.get; folder picker always returns absolute paths

2. **Non-existent directory confirmation**
   - What we know: User decision requires confirmation dialog if selected directory doesn't exist
   - What's unclear: Whether to use native Tauri message dialog or a custom React modal
   - Recommendation: Use a simple React confirmation inline (consistent with other settings UI) rather than adding another native dialog dependency

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Dialog Plugin](https://v2.tauri.app/plugin/dialog/) - folder picker API, setup, permissions
- [@tauri-apps/plugin-dialog JS reference](https://v2.tauri.app/reference/javascript/dialog/) - `open({ directory: true })` returns `string | null`
- Existing codebase: `GeneralSection.tsx`, `SettingsPage.tsx`, `config-helpers.ts`, `tauri-commands.ts`, `settings-store.ts`

### Secondary (MEDIUM confidence)
- [Tauri v2 Opener Plugin](https://v2.tauri.app/plugin/opener/) - alternative for opening folders (not used, but noted)
- [Shell plugin Windows freeze bug](https://github.com/tauri-apps/plugins-workspace/issues/1137) - known issue with `open()` on directories

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - official Tauri v2 plugins, well-documented APIs
- Architecture: HIGH - follows established project patterns exactly
- Pitfalls: HIGH - verified via official issue tracker and docs

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable Tauri v2 plugin ecosystem)
