# Coding Conventions

**Analysis Date:** 2026-03-14

## Naming Patterns

**Files:**
- PascalCase for React components: `ChatPanel.tsx`, `AppShell.tsx`, `ChatInput.tsx`
- camelCase for utility/service files: `gateway-client.ts`, `device-identity.ts`, `tauri-commands.ts`
- camelCase with hyphens for stores: `app-store.ts`, `chat-store.ts`, `settings-store.ts`, `update-store.ts`
- Directories use kebab-case: `src/api/`, `src/stores/`, `src/components/chat/`, `src/components/settings/`, `src/components/layout/`

**Functions:**
- camelCase for all functions, including React components: `sendMessage()`, `loadAgents()`, `handleResponse()`, `getToolLabel()`
- Private methods prefixed with underscore + camelCase: `_connected`, `_url`, `_token`, `_intentionalClose`, `_deviceIdentity`
- Getter properties without underscore in public interface: `connected`, `wsState`, `url`, `deviceIdentity`
- Helper functions within components (not exported) use camelCase: `nextId()`, `ToolActivityIndicator()`, `ToolCallCard()`

**Variables:**
- camelCase for all variables: `setupComplete`, `gatewayPort`, `selectedAgentId`, `sessionKey`, `streaming`, `currentRunId`
- SCREAMING_SNAKE_CASE for constants: `STORAGE_KEY`, `ZERO_COST`, `TOOL_LABELS`, `TOOL_ICONS`
- Template literal markers in log prefixes: `[gateway]`, `[chat]`, `[im-channels]`, `[settings]`, `[chat-store]`

**Types:**
- PascalCase for interfaces and types: `AppState`, `ChatState`, `RequestFrame`, `ResponseFrame`, `EventFrame`, `DeviceIdentity`, `PlatformInfo`, `GatewayStatus`, `ContentBlock`, `ChatMessage`, `Agent`, `SessionItem`
- Suffix `Handler` for event handlers: `EventHandler`, type callback definitions
- Prefix `Stored` for persisted variants: `StoredIdentity` (localStorage version vs `DeviceIdentity`)

## Code Style

**Formatting:**
- TypeScript strict mode enabled in `tsconfig.json`
- Target: ES2021
- Module resolution: bundler
- No custom formatter (Prettier/ESLint not configured in package.json)
- Indentation: 2 spaces (inferred from codebase)

**Linting:**
- TypeScript strict mode with flags enabled:
  - `noUnusedLocals: true` - Enforces removal of unused variables
  - `noUnusedParameters: true` - Enforces removal of unused function parameters
  - `noFallthroughCasesInSwitch: true` - Prevents unintended fall-through in switch statements
  - `forceConsistentCasingInFileNames: true` - Enforces consistent file name casing
- `skipLibCheck: true` - Skips type checking of declaration files
- `allowImportingTsExtensions: true` - Allows importing `.ts` files directly

## Import Organization

**Order:**
1. React imports: `import { useState, useRef } from "react"`
2. Third-party libraries: `import { invoke } from "@tauri-apps/api/core"`; `import { listen } from "@tauri-apps/api/event"`; `import { create } from "zustand"`
3. Relative API imports: `import { gateway } from "../../api/gateway-client"`
4. Relative store imports: `import { useAppStore } from "../../stores/app-store"`
5. Relative component imports: `import { ChatPanel } from "../chat/ChatPanel"`
6. Type imports: `import type { DeviceIdentity } from "./device-identity"`

**Path Aliases:**
- No path aliases configured in tsconfig
- All imports use relative paths with `../../` notation from src/ subdirectories

## Error Handling

**Patterns:**
- Errors caught with `instanceof Error` pattern to safely access `.message`:
  ```typescript
  try {
    // operation
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
  }
  ```
- Gateway client maintains typed error responses with optional fields:
  ```typescript
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  }
  ```
- Async errors in stores logged with `console.warn` and errors re-thrown or silently handled with empty catch:
  ```typescript
  try {
    await gateway.request(...);
  } catch (err) {
    console.warn("[chat-store] method failed:", err);
    throw err; // or no throw for optional operations
  }
  ```
- Promise rejection cleanup in gateway client:
  ```typescript
  private rejectAllPending(reason: string) {
    for (const [, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new Error(reason));
    }
    this.pending.clear();
  }
  ```

## Logging

**Framework:** `console` (native browser console)

**Patterns:**
- Prefixed logging with module/feature name in brackets: `console.log("[gateway] message")`
- Module prefixes are lowercase with hyphens converted to spaces in context: `[gateway]`, `[chat]`, `[chat-store]`, `[im-channels]`, `[settings]`, `[general]`
- Error logs use `console.error()` for critical failures, `console.warn()` for recoverable issues
- Gateway debug buffer maintains 200-entry circular log: `debugLog: string[]` with timestamp prefix `[HH:MM:SS]`
- Log messages include structured data for debugging:
  ```typescript
  console.log("[chat] sendMessage:", { sessionKey, idempotencyKey, textLen: text.length });
  ```

## Comments

**When to Comment:**
- Preserve algorithm explanations for complex multi-step flows (e.g., handshake logic in gateway-client)
- Document non-obvious business logic: `// Skip system messages`, `// If message has tool blocks, don't overwrite with chat delta's concatenated text`
- Mark temporary/debugging constructs: `// Snapshot existing text as a text block`

**JSDoc/TSDoc:**
- Minimal use; types are self-documenting via TypeScript interfaces
- Used for complex parameter objects:
  ```typescript
  /**
   * Static defaults for known OpenClaw built-in providers.
   * Source: OpenClaw src/agents/models-config.providers.static.ts
   */
  ```

## Function Design

**Size:** Functions range from 5-30 lines (small helpers) to 60-100+ lines (complex stores like `loadHistory`)

**Parameters:**
- Single parameter objects for public functions with many options:
  ```typescript
  createAgent: async (params: { name: string; emoji?: string; workspace?: string }) => Promise<void>
  ```
- Direct parameters for simple 1-3 argument functions:
  ```typescript
  addMessage: (msg: ChatMessage) => void
  setAgentModel: (agentId: string, modelId: string) => Promise<void>
  ```
- Optional timeout parameter on request methods with sensible default:
  ```typescript
  async request<T = unknown>(method: string, params?: unknown, timeoutMs = 30000): Promise<T>
  ```

**Return Values:**
- Zustand setters return void (state mutation handled internally)
- Gateway/API calls return Promise<T> with generic for type safety
- Async store actions optionally throw on failure (documented by try/catch in caller)
- Event handlers return unsubscribe function (subscription pattern):
  ```typescript
  on(event: string, handler: EventHandler): () => void
  ```

## Module Design

**Exports:**
- Named exports for reusable components: `export function ChatPanel()`
- Named exports for utility functions: `export async function loadOrCreateDeviceIdentity()`
- Default export for pages: `export default function App()`
- Singleton instance export for gateway: `export const gateway = new GatewayClient()`
- Zustand stores exported as hooks: `export const useAppStore = create<AppState>(...)`

**Barrel Files:**
- Not used; all imports reference specific files directly

**Store Structure (Zustand):**
```typescript
// 1. Define types/interfaces first
interface AppState {
  // state properties
  setupComplete: boolean;
  // action methods
  setSetupComplete: (v: boolean) => void;
}

// 2. Create store with initial state + actions
export const useAppStore = create<AppState>((set) => ({
  setupComplete: false,
  setSetupComplete: (v) => set({ setupComplete: v }),
}));
```

---

*Convention analysis: 2026-03-14*
