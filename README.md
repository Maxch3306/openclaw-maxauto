# MaxAuto

A vendor-free, open-source desktop app that wraps [OpenClaw](https://github.com/openclaw/openclaw). No login, no credits, no vendor lock-in — just a double-click installer that manages OpenClaw's setup and provides a polished GUI.

Please join our discord community: https://discord.gg/QfS4Sa8h

## Install

Download the latest installer from the [Releases](https://github.com/Maxch3306/openclaw-maxauto/releases) page:

| Platform | File |
|----------|------|
| Windows  | `MaxAuto_x.x.x_x64-setup.exe` or `.msi` |
| macOS    | `MaxAuto_x.x.x_universal.dmg` |

Open the installer and follow the prompts. MaxAuto will handle the rest — including installing Node.js and OpenClaw on first launch.

## What It Does

1. **First-run setup** — automatically installs Node.js 22 and OpenClaw into `~/.openclaw-maxauto/` (fully isolated, no conflicts with global installs)
2. **Starts the OpenClaw gateway** — manages the background process for you
3. **Chat with AI agents** — create, configure, and chat with agents using any supported model provider
4. **Model providers** — bring your own API key for OpenAI, Anthropic, DeepSeek, Moonshot, MiniMax, Bailian, and more
5. **Auto-updates** — the app checks for updates and can install them in one click

## Build From Source

Prerequisites: [Node.js 22+](https://nodejs.org/), [pnpm](https://pnpm.io/), [Rust](https://rustup.rs/)

```bash
# Install dependencies
pnpm install

# Run in dev mode
pnpm tauri dev

# Build production installer
pnpm tauri build
```

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Zustand
- **Backend:** Tauri v2 (Rust)
- **Runtime:** OpenClaw via WebSocket (`ws://127.0.0.1:51789`)

## License

MIT
