# Technology Stack

**Analysis Date:** 2026-03-14

## Languages

**Primary:**
- TypeScript 5.6 - React frontend, type-safe UI and API integration
- Rust 2021 edition - Tauri backend, system integration, process management

**Secondary:**
- JavaScript - Configuration files, build scripts
- Bash - CI/CD workflows

## Runtime

**Environment:**
- Tauri v2 - Desktop application framework (wraps Chromium webview with Rust backend)
- Node.js 24 - OpenClaw runtime (vendored/portable, installed into `~/.openclaw-maxauto/node/`)
- Tokio 1 - Async runtime for Rust backend

**Package Manager:**
- pnpm 10.27.0 - Workspace and dependency management
- Cargo - Rust package management
- Lockfile: `pnpm-lock.yaml` (present), `src-tauri/Cargo.lock` (present)

## Frameworks

**Core:**
- React 19.0 - Frontend UI library
- Zustand 5.0 - State management (minimal, no Redux/MobX overhead)
- Tauri v2 - Desktop shell with IPC bridge between Rust and JavaScript

**Build/Dev:**
- Vite 6 - Frontend build tool and dev server (port 5173)
- @vitejs/plugin-react 4.3 - React plugin for Vite
- Tauri CLI 2 - Desktop application builder and bundler

**Styling:**
- Tailwind CSS 3.4 - Utility-first CSS framework
- PostCSS 8.4 - CSS transformation pipeline
- Autoprefixer 10.4 - Browser vendor prefix support

**Icons:**
- lucide-react 0.577 - SVG icon component library

## Key Dependencies

**Critical:**
- @tauri-apps/api 2 - TypeScript bindings for Tauri IPC calls (gateway, system, setup, config, pairing commands)
- @tauri-apps/plugin-shell 2 - Shell execution plugin (open URLs via system browser)
- @tauri-apps/plugin-updater 2 - Auto-update framework (GitHub Releases integration)
- @tauri-apps/plugin-process 2.3.1 - Process management plugin (spawn child processes)

**Cryptography & Auth:**
- @noble/ed25519 3.0.0 - Ed25519 keypair generation and signing for device identity

**System Integration (Rust):**
- reqwest 0.12 - HTTP client with streaming support (for downloading Node.js, Git, OpenClaw)
- tokio 1 - Async runtime with process, I/O, time, sync modules
- serde 1 + serde_json 1 - JSON serialization (config files, gateway communication)
- sha2 0.10 - SHA-256 hashing for artifact verification
- dirs 6 - Cross-platform home directory and app data paths

**Archive & Compression:**
- zip 2 - ZIP file handling (Git portable download)
- tar 0.4 - TAR archive extraction (Node.js portable on macOS)
- flate2 1 - GZIP decompression (for .tar.gz files)

**Plugin Stack (Rust):**
- tauri-plugin-shell 2 - Shell integration (open external URLs)
- tauri-plugin-updater 2 - Auto-update from GitHub Releases
- tauri-plugin-process 2 - Child process spawning (gateway, installations)

## Configuration

**Environment:**
- Configuration stored in `~/.openclaw-maxauto/` directory tree
- Environment isolation: separate `node/`, `git/`, `openclaw/`, `credentials/`, `sessions/`, `workspace/` directories
- Default workspace: `~/.openclaw-maxauto/workspace` (set in gateway config via `agents.defaults.workspace`)
- Gateway token: auto-generated and managed by `get_gateway_token` command

**Build:**
- `tsconfig.json` - TypeScript compilation (ES2021 target, strict mode enabled)
- `vite.config.ts` - Vite dev server on port 5173, Tauri dev host integration
- `src-tauri/tauri.conf.json` - Tauri app manifest (window 1200×800, bundle targets for Windows .msi and macOS .dmg)
- `.github/workflows/release-desktop.yml` - CI/CD pipeline for GitHub Releases

**Environment Variables (for CI/CD):**
- `TAURI_DEV_HOST` - Dev server hostname (set by Tauri dev mode)
- `GITHUB_TOKEN` - GitHub Actions token for releases
- `TAURI_SIGNING_PRIVATE_KEY` - Desktop app signing key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - Signing key password
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` - Force Node 24 in GitHub Actions

## Platform Requirements

**Development:**
- Node.js 24+ (for pnpm and build tools)
- Rust stable toolchain (for Tauri backend)
- Git 2.0+ (for repo operations)

**Production (Desktop Bundles):**
- **Windows:** .msi installer (WebView2 bootstrapper download on first install)
- **macOS:** .dmg disk image (universal binary: aarch64 + x86_64)
- **Minimum OS versions:**
  - Windows: Any modern version (WebView2 handles compatibility)
  - macOS: 10.13+

**Gateway Runtime (Vendored):**
- Node.js 24.14.0 portable (auto-installed)
- Git 2.49.0 portable (Windows only; macOS uses xcode-select)
- OpenClaw (npm package, installed into node_modules)

---

*Stack analysis: 2026-03-14*
