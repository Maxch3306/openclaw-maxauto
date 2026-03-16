# UI Migration Task: Hand-rolled Components → shadcn/ui

## Overview

Replace all hand-rolled UI primitives with [shadcn/ui](https://ui.shadcn.com/) components, adopt the shadcn HSL theming system, and add `@/` path aliases. This is a pure refactor — no features added or removed.

**Branch:** `feat/shadcn-migration` (from `dev`)

---

## Current State

| Aspect | Value |
|---|---|
| UI library | None (all hand-rolled) |
| Icon library | lucide-react 0.577.0 (compatible with shadcn) |
| Styling | Tailwind 3.4 + 11 CSS variables in `:root` |
| Theme | Dark only, hardcoded |
| Path aliases | None (relative imports `../../`) |
| Component files | 26 components across 4 directories |
| CSS var references | ~517 occurrences of `var(--color-*` |
| Dialogs | 6 hand-rolled modals (fixed overlay pattern) |
| Form inputs | Shared `inputClass` string, copy-pasted across files |
| Toggles | 3 hand-rolled div-based switches |

---

## Target State

| Aspect | Value |
|---|---|
| UI library | shadcn/ui (Radix primitives + CVA + tailwind-merge) |
| Icon library | lucide-react (unchanged, shadcn uses same) |
| Styling | Tailwind 3.4 + shadcn HSL variables + tailwindcss-animate |
| Theme | Dark only via shadcn variable system (light mode ready) |
| Path aliases | `@/*` → `./src/*` |
| Component files | Same 26 + new `src/components/ui/` primitives |
| CSS var references | 0 occurrences of `var(--color-*` (all replaced with shadcn classes) |

---

## Dependencies to Install

```bash
# shadcn utilities (required)
pnpm add class-variance-authority clsx tailwind-merge

# Tailwind plugin
pnpm add -D tailwindcss-animate

# Radix UI primitives (one per shadcn component)
pnpm add @radix-ui/react-dialog
pnpm add @radix-ui/react-select
pnpm add @radix-ui/react-switch
pnpm add @radix-ui/react-tabs
pnpm add @radix-ui/react-scroll-area
pnpm add @radix-ui/react-tooltip
pnpm add @radix-ui/react-slot
pnpm add @radix-ui/react-separator
pnpm add @radix-ui/react-collapsible
pnpm add @radix-ui/react-label
```

---

## Config Changes

### `tsconfig.json`

Add `baseUrl` and `paths` under `compilerOptions`:

```jsonc
{
  "compilerOptions": {
    // ... existing options ...
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### `vite.config.ts`

Add path resolve alias:

```ts
import path from "path";

export default defineConfig({
  // ... existing config ...
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### `tailwind.config.ts`

Extend with shadcn color system and animate plugin:

```ts
import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Custom (not in default shadcn)
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindAnimate],
} satisfies Config;
```

### `src/global.css`

Replace current `:root` block with shadcn HSL variables. During migration, keep old `--color-*` as aliases so un-migrated components still work.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* shadcn HSL variables (dark theme) */
    --background: 240 27% 14%;        /* #1a1a2e */
    --foreground: 0 0% 88%;           /* #e0e0e0 */
    --card: 220 45% 16%;              /* #16213e */
    --card-foreground: 0 0% 88%;
    --popover: 220 45% 16%;
    --popover-foreground: 0 0% 88%;
    --primary: 217 100% 65%;          /* #4f8cff */
    --primary-foreground: 0 0% 100%;
    --secondary: 218 44% 19%;         /* #1a2745 */
    --secondary-foreground: 0 0% 88%;
    --muted: 220 45% 16%;
    --muted-foreground: 218 12% 59%;  /* #8892a4 */
    --accent: 218 44% 19%;
    --accent-foreground: 0 0% 88%;
    --destructive: 4 90% 58%;         /* #f44336 */
    --destructive-foreground: 0 0% 100%;
    --border: 218 37% 26%;            /* #2a3a5c */
    --input: 218 37% 26%;
    --ring: 217 100% 65%;
    --radius: 0.5rem;

    /* Custom status colors */
    --success: 122 39% 49%;           /* #4caf50 */
    --success-foreground: 0 0% 100%;
    --warning: 36 100% 50%;           /* #ff9800 */
    --warning-foreground: 0 0% 100%;

    /* ---- Backward-compat aliases (REMOVE in Phase 6) ---- */
    --color-bg: hsl(var(--background));
    --color-surface: hsl(var(--card));
    --color-surface-hover: hsl(var(--secondary));
    --color-border: hsl(var(--border));
    --color-text: hsl(var(--foreground));
    --color-text-muted: hsl(var(--muted-foreground));
    --color-accent: hsl(var(--primary));
    --color-accent-hover: hsl(217 92% 58%);  /* #3a7af0 */
    --color-success: hsl(var(--success));
    --color-warning: hsl(var(--warning));
    --color-error: hsl(var(--destructive));
  }
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}

/* Scrollbar styling (keep until ScrollArea replaces all scroll containers) */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground)); }
```

### `components.json` (new file, project root)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/global.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

### `src/lib/utils.ts` (new file)

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## shadcn Components to Create

Each file lives in `src/components/ui/`. Use the standard shadcn source (copy from [ui.shadcn.com](https://ui.shadcn.com/docs/components)) and adjust to match the project's dark theme.

| Component | File | Radix dependency | Notes |
|---|---|---|---|
| Button | `button.tsx` | `@radix-ui/react-slot` | Variants: default, destructive, outline, secondary, ghost, link. Sizes: default, sm, xs, lg, icon |
| Input | `input.tsx` | — | Replaces all `inputClass` patterns |
| Textarea | `textarea.tsx` | — | Used in ChatInput |
| Label | `label.tsx` | `@radix-ui/react-label` | For form fields |
| Badge | `badge.tsx` | — | Variants: default, secondary, destructive, outline, success, warning |
| Dialog | `dialog.tsx` | `@radix-ui/react-dialog` | Replaces all 6 hand-rolled modals |
| Card | `card.tsx` | — | Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription |
| Separator | `separator.tsx` | `@radix-ui/react-separator` | For divider lines |
| Switch | `switch.tsx` | `@radix-ui/react-switch` | Replaces all custom toggle divs |
| Select | `select.tsx` | `@radix-ui/react-select` | Replaces native `<select>` elements |
| Tabs | `tabs.tsx` | `@radix-ui/react-tabs` | Replaces custom tab button groups |
| ScrollArea | `scroll-area.tsx` | `@radix-ui/react-scroll-area` | Replaces `overflow-y-auto` divs |
| Collapsible | `collapsible.tsx` | `@radix-ui/react-collapsible` | Replaces expand/collapse patterns |
| Tooltip | `tooltip.tsx` | `@radix-ui/react-tooltip` | Optional — add where helpful |

---

## Pattern Migration Reference

### Buttons

**Before:**
```tsx
// Primary
<button className="px-4 py-2 text-sm rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
  Submit
</button>

// Outline
<button className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors">
  Cancel
</button>

// Destructive
<button className="px-4 py-2 text-sm rounded-lg bg-[var(--color-error)] text-white hover:opacity-90">
  Delete
</button>

// Ghost
<button className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]">
  <ArrowLeft size={16} />
</button>

// Small
<button className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
  Reset
</button>
```

**After:**
```tsx
import { Button } from "@/components/ui/button";

<Button>Submit</Button>
<Button variant="outline">Cancel</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost" size="icon"><ArrowLeft size={16} /></Button>
<Button variant="outline" size="sm">Reset</Button>
```

### Inputs

**Before:**
```tsx
const inputClass =
  "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]";

<input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
```

**After:**
```tsx
import { Input } from "@/components/ui/input";

<Input value={name} onChange={(e) => setName(e.target.value)} />
```

### Dialogs

**Before:**
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
  <div className="w-[400px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl">
    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
      <h2 className="text-base font-semibold text-[var(--color-text)]">Title</h2>
      <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">×</button>
    </div>
    <div className="px-6 py-4 space-y-4">{/* body */}</div>
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
      <button onClick={onClose} className="...outline...">Cancel</button>
      <button onClick={onSubmit} className="...primary...">Submit</button>
    </div>
  </div>
</div>
```

**After:**
```tsx
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

<Dialog open={open} onOpenChange={onClose}>
  <DialogContent className="sm:max-w-[400px]">
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">{/* body */}</div>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <Button onClick={onSubmit}>Submit</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Toggle Switch

**Before:**
```tsx
<div
  role="switch"
  aria-checked={isEnabled}
  onClick={handleToggle}
  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
    isEnabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
  }`}
>
  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
    isEnabled ? "translate-x-[18px]" : "translate-x-[2px]"
  }`} />
</div>
```

**After:**
```tsx
import { Switch } from "@/components/ui/switch";

<Switch checked={isEnabled} onCheckedChange={handleToggle} />
```

### Tabs

**Before:**
```tsx
<div className="flex border-b border-[var(--color-border)]">
  <button
    onClick={() => setTab("agents")}
    className={`flex-1 px-3 py-2.5 text-xs font-medium ${
      tab === "agents"
        ? "text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]"
        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
    }`}
  >Agents</button>
  <button onClick={() => setTab("chats")} className={/* same pattern */}>Chats</button>
</div>
```

**After:**
```tsx
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="agents">Agents</TabsTrigger>
    <TabsTrigger value="chats">Chats</TabsTrigger>
  </TabsList>
</Tabs>
```

### Badges

**Before:**
```tsx
<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)]">
  Done
</span>
<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-error)]/15 text-[var(--color-error)]">
  Error
</span>
```

**After:**
```tsx
import { Badge } from "@/components/ui/badge";

<Badge variant="success">Done</Badge>
<Badge variant="destructive">Error</Badge>
```

### Cards

**Before:**
```tsx
<div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
  <div className="px-4 py-3 border-b border-[var(--color-border)]">Header</div>
  <div className="px-4 py-4">Content</div>
</div>
```

**After:**
```tsx
import { Card, CardHeader, CardContent } from "@/components/ui/card";

<Card>
  <CardHeader>Header</CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Select

**Before:**
```tsx
<select
  value={value}
  onChange={(e) => setValue(e.target.value)}
  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)]"
>
  <option value="">Select...</option>
  <option value="a">Option A</option>
</select>
```

**After:**
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="a">Option A</SelectItem>
  </SelectContent>
</Select>
```

### ScrollArea

**Before:**
```tsx
<div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
  {/* content */}
</div>
```

**After:**
```tsx
import { ScrollArea } from "@/components/ui/scroll-area";

<ScrollArea className="flex-1 p-4" ref={scrollRef}>
  {/* content */}
</ScrollArea>
```

### Collapsible

**Before:**
```tsx
<button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-2">
  {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
  Tool name
</button>
{expanded && (
  <div className="px-3 py-2 border-t border-[var(--color-border)]">Details</div>
)}
```

**After:**
```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

<Collapsible open={expanded} onOpenChange={setExpanded}>
  <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2">
    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
    Tool name
  </CollapsibleTrigger>
  <CollapsibleContent className="px-3 py-2 border-t border-border">
    Details
  </CollapsibleContent>
</Collapsible>
```

---

## Import Path Migration

Every file touched during migration should also update imports from relative to `@/`:

| Before | After |
|---|---|
| `"../../stores/app-store"` | `"@/stores/app-store"` |
| `"../../stores/chat-store"` | `"@/stores/chat-store"` |
| `"../../stores/settings-store"` | `"@/stores/settings-store"` |
| `"../../stores/update-store"` | `"@/stores/update-store"` |
| `"../../api/gateway-client"` | `"@/api/gateway-client"` |
| `"../../api/tauri-commands"` | `"@/api/tauri-commands"` |
| `"../../api/config-helpers"` | `"@/api/config-helpers"` |
| `"../../api/telegram-accounts"` | `"@/api/telegram-accounts"` |
| `"../../api/device-identity"` | `"@/api/device-identity"` |
| `"../../i18n"` | `"@/i18n"` |

Sibling imports (e.g., `"./ChatInput"`) remain relative.

---

## File-by-File Migration Checklist

### Phase 1: Foundation
- [ ] Install all dependencies
- [ ] Create `components.json`
- [ ] Create `src/lib/utils.ts`
- [ ] Modify `tsconfig.json` (path aliases)
- [ ] Modify `vite.config.ts` (resolve alias)
- [ ] Modify `tailwind.config.ts` (shadcn colors + animate plugin)
- [ ] Modify `src/global.css` (HSL variables + backward-compat aliases)
- [ ] Verify: `pnpm build` passes, app looks identical

### Phase 2: Core Primitives
- [ ] Create `src/components/ui/button.tsx`
- [ ] Create `src/components/ui/input.tsx`
- [ ] Create `src/components/ui/textarea.tsx`
- [ ] Create `src/components/ui/badge.tsx`
- [ ] Create `src/components/ui/label.tsx`
- [ ] Migrate `src/components/chat/ChatInput.tsx` — Textarea, Button
- [ ] Migrate `src/components/settings/WorkspaceSection.tsx` — Input, Button
- [ ] Migrate `src/components/common/GatewayStatus.tsx` — Badge, Button
- [ ] Migrate `src/components/common/UpdateBanner.tsx` — Button
- [ ] Migrate `src/components/settings/TagInput.tsx` — Badge, Input
- [ ] Verify: `pnpm build` passes

### Phase 3: Dialog + Card
- [ ] Create `src/components/ui/dialog.tsx`
- [ ] Create `src/components/ui/card.tsx`
- [ ] Create `src/components/ui/separator.tsx`
- [ ] Migrate `src/components/chat/CreateAgentDialog.tsx`
- [ ] Migrate `src/components/chat/EditAgentDialog.tsx`
- [ ] Migrate `src/components/settings/RemoveBotDialog.tsx`
- [ ] Migrate `src/components/settings/AddBotDialog.tsx`
- [ ] Migrate `src/components/settings/QuickConfigModal.tsx`
- [ ] Migrate `src/components/settings/AddModelDialog.tsx`
- [ ] Apply Card to `src/components/chat/AgentCard.tsx`
- [ ] Verify: `pnpm build` passes

### Phase 4: Interactive Components
- [ ] Create `src/components/ui/switch.tsx`
- [ ] Create `src/components/ui/select.tsx`
- [ ] Create `src/components/ui/tabs.tsx`
- [ ] Create `src/components/ui/scroll-area.tsx`
- [ ] Create `src/components/ui/collapsible.tsx`
- [ ] Create `src/components/ui/tooltip.tsx`
- [ ] Migrate `src/components/settings/BotCard.tsx` — Switch, Collapsible
- [ ] Migrate `src/components/settings/SkillsSection.tsx` — Switch, Collapsible
- [ ] Migrate `src/components/settings/ModelsAndApiSection.tsx` — Switch, Badge, Card
- [ ] Migrate `src/components/chat/SidebarTabs.tsx` — Tabs
- [ ] Migrate `src/components/chat/Sidebar.tsx` — ScrollArea
- [ ] Migrate `src/components/chat/ChatPanel.tsx` — ScrollArea, Collapsible, Badge
- [ ] Update `src/components/chat/ChatInput.tsx` — replace native `<select>` with Select
- [ ] Verify: `pnpm build` passes

### Phase 5: Remaining Sections + Pages
- [ ] Migrate `src/components/settings/GeneralSection.tsx`
- [ ] Migrate `src/components/settings/IMChannelsSection.tsx`
- [ ] Migrate `src/components/settings/BotCardList.tsx`
- [ ] Migrate `src/components/settings/McpSection.tsx`
- [ ] Migrate `src/components/settings/AboutSection.tsx`
- [ ] Migrate `src/pages/SettingsPage.tsx`
- [ ] Migrate `src/pages/SetupPage.tsx`
- [ ] Migrate `src/components/chat/AgentList.tsx`
- [ ] Verify: `pnpm build` passes

### Phase 6: Layout + Cleanup
- [ ] Migrate `src/components/layout/AppShell.tsx`
- [ ] Migrate `src/components/layout/TitleBar.tsx`
- [ ] Remove backward-compat `--color-*` aliases from `src/global.css`
- [ ] Remove manual scrollbar CSS (if ScrollArea covers all cases)
- [ ] Verify: `grep -r "var(--color-" src/` returns 0 results
- [ ] Verify: `pnpm build` passes with zero errors
- [ ] Visual check: Setup page, Chat view, all Settings sections, all Dialogs

---

## Risk Notes

1. **Radix portals in Tauri webview** — Radix Dialog/Select render via portal at document root. Should work in Tauri's webview, but test Dialog early (Phase 3). If portals conflict with Tauri window chrome, use the `container` prop.

2. **Native `<select>` → Radix `<Select>`** — Radix Select renders a custom dropdown. Test overflow behavior in fixed-height panels (sidebar, chat input area) and z-index stacking with other portals.

3. **Tailwind 3.4 compat** — shadcn supports Tailwind 3.x. No upgrade to Tailwind 4 needed.

4. **Dark-only theme** — shadcn assumes light+dark. We define all variables in `:root` (no `.dark` class needed since there's no light mode). The structure is future-compatible if light mode is added later.

5. **Custom colors (success, warning)** — Not in default shadcn. Added as custom CSS variables and extended in Tailwind config. Badge component needs custom `success` and `warning` variants.

---

## Commit Strategy

One commit per phase:
1. `feat: add shadcn/ui foundation — path aliases, CSS variables, dependencies`
2. `feat: add Button, Input, Textarea, Badge primitives and migrate simple components`
3. `feat: add Dialog and Card components, migrate all dialogs and card patterns`
4. `feat: add Switch, Select, Tabs, ScrollArea and migrate interactive components`
5. `feat: migrate all settings sections and pages to shadcn components`
6. `feat: complete shadcn migration — remove legacy CSS variables, final cleanup`
