# Testing Patterns

**Analysis Date:** 2026-03-14

## Test Framework

**Runner:**
- Not detected - No test framework configured in package.json
- No Vitest, Jest, or similar dependency present
- No test configuration files (`vitest.config.ts`, `jest.config.js`, etc.)

**Assertion Library:**
- Not applicable - No test framework

**Run Commands:**
- No test scripts defined in package.json
- Only available: `pnpm dev`, `pnpm build`, `pnpm tauri`

## Test File Organization

**Location:**
- No `.test.ts`, `.test.tsx`, `.spec.ts`, or `.spec.tsx` files in MaxAuto project (`src/` directory)
- OpenClaw dependency in `openclaw/` subdirectory contains extensive tests, but those are NOT part of MaxAuto

**Naming:**
- Not applicable - No test files

**Structure:**
- Not applicable - No test files

## Test Structure

**Suite Organization:**
- Not applicable - No test framework configured

**Patterns:**
- Not applicable - No test code present

## Mocking

**Framework:**
- Not applicable - No test framework

**Patterns:**
- Not applicable - No mocking infrastructure

**What to Mock:**
- Not applicable - No test code

**What NOT to Mock:**
- Not applicable - No test code

## Fixtures and Factories

**Test Data:**
- Not applicable - No test framework

**Location:**
- Not applicable - No test data files

## Coverage

**Requirements:**
- None enforced - No coverage targets configured

**View Coverage:**
- Not applicable - No test infrastructure

## Test Types

**Unit Tests:**
- Not present in MaxAuto

**Integration Tests:**
- Manual integration occurs between:
  - TypeScript frontend (React + Zustand) connecting to Rust backend (Tauri)
  - Gateway WebSocket client (`src/api/gateway-client.ts`) connecting to OpenClaw gateway (`ws://127.0.0.1:51789`)
  - Tauri IPC for system commands (`src/api/tauri-commands.ts`)
- No automated integration test suite

**E2E Tests:**
- Not used in MaxAuto
- Manual testing via Tauri dev/build workflow

## Manual Testing Approach

**Development Workflow:**
- `pnpm dev` runs Vite dev server + Tauri in development mode
- Changes hot-reload on TypeScript file saves
- Tauri IPC and WebSocket communication tested manually during development

**Build Testing:**
- `pnpm build` runs TypeScript check + Vite production build
- Windows `.msi` and macOS `.dmg` installers tested via `pnpm tauri` build/bundle commands

**Common Verification Points:**
- Gateway connection via WebSocket handshake (debug log in `src/api/gateway-client.ts`)
- Device identity persistence in localStorage (regenerated on app start if missing)
- Chat message streaming and tool execution rendering (`src/components/chat/ChatPanel.tsx`)
- Zustand store state transitions (verified via browser dev tools or console logging)
- Tauri IPC command responses (error handling tested via try/catch in stores)

## Known Testing Gaps

**Areas Without Automated Tests:**
- WebSocket protocol handshake and message handling (manual testing only)
- Zustand store mutations and async actions (relies on console.warn/console.log for debugging)
- Device identity generation and signing (unit test logic exists in `src/api/device-identity.ts`, not tested)
- Chat history parsing and content block merging (complex logic in `src/stores/chat-store.ts` lines 379-499)
- Tool call result streaming (real-time updates tested manually during development)
- Error recovery and reconnection logic (manual network failure simulation)

**Recommendation for Testing:**
- Add Vitest with React Testing Library for component tests
- Add unit tests for store actions in `src/stores/`
- Add integration tests for gateway-client WebSocket protocol
- Add e2e tests for critical user flows (setup, chat, agent CRUD)

---

*Testing analysis: 2026-03-14*
