# MaxAuto

A vendor-free, open-source desktop app that wraps [OpenClaw](https://github.com/openclaw/openclaw). No login, no credits, no vendor lock-in — just a double-click installer that manages OpenClaw's setup and provides a polished GUI.

Please join our discord community: https://discord.gg/QfS4Sa8h

## Install

Download the latest installer from the [Releases](https://github.com/Maxch3306/openclaw-maxauto/releases) page:

| Platform | File |
|----------|------|
| Windows  | `MaxAuto_x.x.x_x64-setup.exe` or `.msi` |
| macOS    | `MaxAuto_x.x.x_universal.dmg` |

### Windows

1. Download the `.exe` or `.msi` installer from Releases.
2. Run the installer. Windows SmartScreen may show a **"Windows protected your PC"** warning because the app is not code-signed yet.
   - Click **"More info"**
   - Then click **"Run anyway"**
3. Follow the prompts to complete installation.

### macOS

1. Download the `.dmg` file from Releases.
2. Open the `.dmg` and drag MaxAuto to your Applications folder.
3. On first launch, macOS Gatekeeper will block the app because it is from an unidentified developer.
   - Go to **System Settings → Privacy & Security**
   - Scroll down to the **Security** section — you'll see a message like *"MaxAuto was blocked from use because it is not from an identified developer"*
   - Click **"Open Anyway"** and confirm
   - Alternatively, you can right-click (or Control-click) the app in Finder and select **"Open"**, then click **"Open"** in the dialog

> MaxAuto will handle the rest on first launch — including installing Node.js and OpenClaw automatically into `~/.openclaw-maxauto/`.

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
