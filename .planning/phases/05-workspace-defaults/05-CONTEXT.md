# Phase 5: Workspace Defaults - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can view, change, and open the default workspace directory. This creates the Workspace settings section. Per-agent workspace overrides are Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Workspace display
- Show current workspace path, Change button (native folder picker), Open in Explorer/Finder button
- Include a brief description explaining what the workspace is for (where agents read/write files)

### Path change behavior
- Native folder picker via `@tauri-apps/plugin-dialog` (or Tauri open dialog)
- If selected directory doesn't exist: show confirmation dialog before applying
- Write new path to config via `patchConfig()` (Phase 1 infrastructure)

### Claude's Discretion
- Section layout and styling (consistent with other settings sections)
- Description text wording
- Confirmation dialog design for non-existent directory
- Whether to show the old path after changing

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- SettingsPage.tsx has `"workspace"` tab key with "Coming Soon" placeholder
- `patchConfig()` from `config-helpers.ts` for config writes
- `gateway.request("config.get")` for reading current config
- `@tauri-apps/plugin-shell` already in project — `open()` can open folders in file manager
- Research notes: may need `@tauri-apps/plugin-dialog` for native folder picker

### Established Patterns
- Settings sections are standalone components in `src/components/settings/`
- PascalCase files: `GeneralSection.tsx`, `SkillsSection.tsx`
- Components read from Zustand stores or call gateway directly
- `patchConfig()` + `waitForReconnect()` for config changes

### Integration Points
- `SettingsPage.tsx`: wire `WorkspaceSection` into renderSection switch
- Config path: `agents.defaults.workspace` in openclaw.json
- Tauri dialog plugin for folder picker (verify availability)
- `@tauri-apps/plugin-shell` `open()` for "Open in Explorer"

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-workspace-defaults*
*Context gathered: 2026-03-14*
