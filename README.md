# MaxAuto

A vendor-free, open-source desktop app that wraps [OpenClaw](https://github.com/openclaw/openclaw). No login, no credits, no vendor lock-in — just a double-click installer that manages OpenClaw's setup and provides a polished GUI.

[繁體中文](README.zh-TW.md)

Please join our discord community: https://discord.gg/QfS4Sa8h

## Features

- **One-click setup** — choose Native or Docker mode; MaxAuto handles Node.js, Git, and OpenClaw installation automatically
- **Chat with AI agents** — create, configure, and chat with agents using any supported model provider
- **Multi-provider support** — bring your own API key for Aliyun Bailian, GLM, Kimi, MiniMax, Moonshot, Claude proxy, and custom providers
- **MCP services** — add local (stdio) or remote (URL) MCP servers to extend agent capabilities; browse [Smithery](https://smithery.ai/servers) directory for servers; OAuth support via mcp-remote bridge
- **Skills management** — enable/disable 40+ built-in skills with winget install support on Windows
- **Telegram integration** — multi-account bot management with pairing flow
- **Appearance customization** — 5 theme presets (dark/light), custom accent/background/foreground colors, contrast slider
- **System tray** — minimize to tray on close, gateway keeps running in background
- **Auto-updates** — check and install updates from GitHub Releases in one click
- **Internationalization** — English and Traditional Chinese

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

## Installation Modes

MaxAuto offers two installation modes on first launch:

### Native (Default)

Installs Node.js and OpenClaw directly on your machine under `~/.openclaw-maxauto/`. Git is required as a prerequisite.

- **macOS:** Git is included with Xcode Command Line Tools. If not installed, MaxAuto will trigger the install dialog automatically.
- **Windows:** If Git is not found, MaxAuto will automatically download and launch the Git for Windows installer — just follow the wizard to complete the installation.

### Docker (Sandboxed)

Runs OpenClaw inside a Docker container for full isolation. OpenClaw and its dependencies never touch your host system — only config and workspace files are shared.

**Prerequisites:** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) before choosing this mode.

| Platform | Docker Desktop Download |
|----------|------------------------|
| macOS    | [Download for Mac](https://docs.docker.com/desktop/setup/install/mac-install/) |
| Windows  | [Download for Windows](https://docs.docker.com/desktop/setup/install/windows-install/) |

**Setup steps:**

1. Install and start Docker Desktop.
2. Launch MaxAuto — on the setup screen, choose **Docker** mode.
3. MaxAuto will automatically pull the `openclaw/openclaw` image and start the container.
4. The gateway runs inside the `maxauto-openclaw` container, mapped to `localhost:51789`.

**Notes:**
- Docker Desktop must be running whenever you use MaxAuto in Docker mode.
- All data is stored under `~/.openclaw-maxauto/config` and `~/.openclaw-maxauto/workspace`, which are mounted into the container.
- The container only listens on `127.0.0.1` — it is not accessible from other devices on your network.
- You can switch between Native and Docker mode from **Settings → General → Installation Mode**.

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

- **Frontend:** React 19, TypeScript, Tailwind CSS 3.4, shadcn/ui (Radix primitives), Zustand 5
- **Backend:** Tauri v2 (Rust)
- **Runtime:** OpenClaw via WebSocket (`ws://127.0.0.1:51789`)
- **i18n:** i18next (English, Traditional Chinese)

## License

[MIT](LICENSE)
