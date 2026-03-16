# shadcn/ui Migration Plan

## Context
All UI components are hand-rolled with inline Tailwind + CSS variables (517 occurrences of `var(--color-*` across 29 files). No component library exists. This migration replaces all hand-rolled primitives with shadcn/ui, adopts shadcn's HSL theming system, and adds `@/` path aliases.

## Branch
Create `feat/shadcn-migration` from `dev`

---

## Phase 1: Foundation (Infrastructure)
No component changes — app stays visually identical.

**Install dependencies:**
- `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`
- `@radix-ui/react-dialog`, `react-select`, `react-switch`, `react-tabs`, `react-scroll-area`, `react-tooltip`, `react-slot`, `react-separator`, `react-collapsible`

**Create:**
- `components.json` — shadcn CLI config
- `src/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `src/components/ui/` — empty directory

**Modify:**
- `tsconfig.json` — add `baseUrl: "."`, `paths: { "@/*": ["./src/*"] }`
- `vite.config.ts` — add `resolve.alias: { "@": path.resolve(__dirname, "./src") }`
- `tailwind.config.ts` — add shadcn color refs, `tailwindcss-animate` plugin, custom success/warning colors
- `src/global.css` — replace `:root` vars with shadcn HSL system + keep old `--color-*` as aliases for backward compat

**Theming map:**
| Current | shadcn HSL variable |
|---|---|
| `--color-bg` #1a1a2e | `--background` 240 27% 14% |
| `--color-surface` #16213e | `--card` / `--muted` 220 45% 16% |
| `--color-border` #2a3a5c | `--border` / `--input` 218 37% 26% |
| `--color-text` #e0e0e0 | `--foreground` 0 0% 88% |
| `--color-text-muted` #8892a4 | `--muted-foreground` 218 12% 59% |
| `--color-accent` #4f8cff | `--primary` 217 100% 65% |
| `--color-error` #f44336 | `--destructive` 4 90% 58% |
| `--color-success` #4caf50 | `--success` (custom) 122 39% 49% |
| `--color-warning` #ff9800 | `--warning` (custom) 36 100% 50% |

---

## Phase 2: Core Primitives (Button, Input, Textarea, Badge, Label)
Create shadcn components in `src/components/ui/`, migrate 5 simple components.

**Create:** `button.tsx`, `input.tsx`, `textarea.tsx`, `badge.tsx`, `label.tsx`

**Migrate:**
- `ChatInput.tsx` — textarea, button
- `WorkspaceSection.tsx` — input, button
- `GatewayStatus.tsx` — badge, button
- `UpdateBanner.tsx` — buttons
- `TagInput.tsx` — badge, input

---

## Phase 3: Dialog + Card
**Create:** `dialog.tsx`, `card.tsx`, `separator.tsx`

**Migrate all 6 dialogs:**
- `CreateAgentDialog.tsx` (simplest)
- `EditAgentDialog.tsx`
- `RemoveBotDialog.tsx`
- `AddBotDialog.tsx`
- `QuickConfigModal.tsx`
- `AddModelDialog.tsx` (most complex — tabs + forms)

**Also apply Card to:** `AgentCard.tsx`, provider cards in `ModelsAndApiSection.tsx`

---

## Phase 4: Switch, Select, Tabs, ScrollArea, Collapsible, Tooltip
**Create:** `switch.tsx`, `select.tsx`, `tabs.tsx`, `scroll-area.tsx`, `collapsible.tsx`, `tooltip.tsx`

**Migrate:**
- `BotCard.tsx` — Switch, Select, Collapsible
- `SkillsSection.tsx` — Switch, Collapsible
- `ModelsAndApiSection.tsx` — Switch, Badge, Card (52 var refs, most complex)
- `SidebarTabs.tsx` — Tabs
- `Sidebar.tsx` — ScrollArea
- `ChatPanel.tsx` — ScrollArea, Collapsible, Badge
- `ChatInput.tsx` — replace native `<select>` with Radix Select

---

## Phase 5: Remaining Sections + Pages
**Migrate:**
- `GeneralSection.tsx`, `IMChannelsSection.tsx`, `BotCardList.tsx`, `McpSection.tsx`, `AboutSection.tsx`
- `SettingsPage.tsx`, `SetupPage.tsx`
- `AgentList.tsx`, `AgentCard.tsx`

---

## Phase 6: Layout + Cleanup
**Migrate:** `AppShell.tsx`, `TitleBar.tsx`

**Cleanup:**
- Remove backward-compat `--color-*` aliases from `global.css`
- Verify `grep -r "var(--color-" src/` returns 0 results
- `pnpm build` passes with zero errors

---

## Import Path Strategy
Update relative imports to `@/` aliases opportunistically as each file is touched (no separate import-only phase).

## Verification
After each phase: `pnpm build` must pass. After Phase 6: visual check of all screens (setup, chat, all settings sections, all dialogs).
