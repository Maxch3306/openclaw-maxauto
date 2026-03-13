# Tauri v2 + React + TypeScript Guide

Reference documentation for building MaxAuto with Tauri v2.

## Scaffolding

```bash
cd max-auto
pnpm create tauri-app . --template react-ts --manager pnpm
pnpm install
pnpm tauri dev
```

Project structure after scaffold:

```text
max-auto/
  src/                  # React frontend (Vite)
    App.tsx
    main.tsx
  src-tauri/            # Rust backend
    capabilities/       # Permission/capability definitions
    gen/                # Auto-generated code
    icons/              # App icons
    src/
      lib.rs            # Main Tauri app code (commands go here)
      main.rs           # Entry point
    Cargo.toml
    tauri.conf.json     # Tauri configuration
  index.html
  package.json
  tsconfig.json
  vite.config.ts
```

## Custom Rust Commands (IPC)

### Basic command

```rust
#[tauri::command]
fn my_custom_command() {
    println!("I was invoked from JavaScript!");
}
```

### Command with arguments and return value

```rust
#[tauri::command]
fn login(user: String, password: String) -> Result<String, String> {
    if user == "tauri" && password == "tauri" {
        Ok("logged_in".to_string())
    } else {
        Err("invalid credentials".to_string())
    }
}
```

### Async command with State

```rust
#[derive(serde::Serialize)]
struct CustomResponse {
    message: String,
    other_val: usize,
}

struct Database;

#[tauri::command]
async fn my_custom_command(
    window: tauri::Window,
    number: usize,
    database: tauri::State<'_, Database>,
) -> Result<CustomResponse, String> {
    println!("Called from {}", window.label());
    Ok(CustomResponse {
        message: "hello".into(),
        other_val: 42 + number,
    })
}
```

### Registering commands

All commands must be in ONE `invoke_handler` call (only the last one takes effect):

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Database {})
        .invoke_handler(tauri::generate_handler![
            my_custom_command,
            login,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Spawning Child Processes

### Option A: tauri-plugin-shell (recommended)

Install:

```bash
pnpm tauri add shell
```

Register in `lib.rs`:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![/* commands */])
        .run(tauri::generate_context!())
        .expect("error");
}
```

Permissions in `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-spawn",
    "shell:allow-kill",
    "shell:allow-stdin-write"
  ]
}
```

Spawn from Rust:

```rust
use tauri_plugin_shell::{ShellExt, process::CommandEvent};

tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
        let handle = app.handle().clone();
        tauri::async_runtime::spawn(async move {
            let (mut rx, mut child) = handle.shell()
                .command("openclaw")
                .args(["gateway", "run"])
                .spawn()
                .expect("Failed to spawn");

            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        println!("stdout: {}", String::from_utf8(line).unwrap());
                    }
                    CommandEvent::Stderr(line) => {
                        eprintln!("stderr: {}", String::from_utf8(line).unwrap());
                    }
                    CommandEvent::Terminated(payload) => {
                        println!("Exited: {:?}", payload.code);
                        break;
                    }
                    _ => {}
                }
            }
        });
        Ok(())
    })
```

Spawn from TypeScript:

```typescript
import { Command } from '@tauri-apps/plugin-shell';

const command = Command.create('run-openclaw-gateway', ['gateway', 'run']);
command.stdout.on('data', (line: string) => console.log('stdout:', line));
command.stderr.on('data', (line: string) => console.error('stderr:', line));
command.on('close', (data) => console.log('exited:', data.code));

const child = await command.spawn();
await child.kill(); // later
```

### Option B: Pure Rust std::process

```rust
use std::process::{Command, Child};
use std::sync::Mutex;
use tauri::State;

struct GatewayProcess(Mutex<Option<Child>>);

#[tauri::command]
fn start_gateway(state: State<'_, GatewayProcess>) -> Result<String, String> {
    let child = Command::new("openclaw")
        .args(["gateway", "run"])
        .spawn()
        .map_err(|e| e.to_string())?;
    *state.0.lock().unwrap() = Some(child);
    Ok("Gateway started".into())
}

#[tauri::command]
fn stop_gateway(state: State<'_, GatewayProcess>) -> Result<String, String> {
    if let Some(mut child) = state.0.lock().unwrap().take() {
        child.kill().map_err(|e| e.to_string())?;
        Ok("Gateway stopped".into())
    } else {
        Err("Gateway not running".into())
    }
}

// Register: .manage(GatewayProcess(Mutex::new(None)))
```

## System Tray

```rust
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

tauri::Builder::default()
    .setup(|app| {
        let toggle = MenuItemBuilder::with_id("toggle", "Toggle Window").build(app)?;
        let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
        let menu = MenuBuilder::new(app).items(&[&toggle, &quit]).build()?;

        let _tray = TrayIconBuilder::new()
            .menu(&menu)
            .menu_on_left_click(true)
            .on_menu_event(move |app, event| match event.id().as_ref() {
                "toggle" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => { app.exit(0); }
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up, ..
                } = event {
                    let app = tray.app_handle();
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.unminimize();
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
            })
            .build(app)?;
        Ok(())
    })
```

## Frameless Window / Custom Titlebar

### tauri.conf.json

```json
{
  "app": {
    "windows": [{
      "title": "MaxAuto",
      "width": 1200,
      "height": 800,
      "decorations": false,
      "resizable": true
    }]
  }
}
```

### React component

```tsx
import { getCurrentWindow } from '@tauri-apps/api/window';

export function Titlebar() {
  const appWindow = getCurrentWindow();
  return (
    <div data-tauri-drag-region className="titlebar">
      <span data-tauri-drag-region className="title">MaxAuto</span>
      <div className="controls">
        <button onClick={() => appWindow.minimize()}>&#x2014;</button>
        <button onClick={() => appWindow.toggleMaximize()}>&#9744;</button>
        <button onClick={() => appWindow.close()}>&#10005;</button>
      </div>
    </div>
  );
}
```

`data-tauri-drag-region` makes element draggable. Buttons need CSS `app-region: no-drag` to remain clickable.

## tauri.conf.json v2 Full Template

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-utils/schema.json",
  "productName": "MaxAuto",
  "version": "0.1.0",
  "identifier": "com.openclaw.maxauto",
  "build": {
    "beforeBuildCommand": "pnpm build",
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "security": { "csp": null },
    "windows": [{
      "title": "MaxAuto",
      "width": 1200,
      "height": 800,
      "decorations": false,
      "resizable": true
    }],
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "id": "main",
      "tooltip": "MaxAuto"
    },
    "withGlobalTauri": false
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": ["resources/*"],
    "windows": {
      "webviewInstallMode": { "type": "downloadBootstrapper", "silent": true },
      "wix": null,
      "nsis": null,
      "allowDowngrades": true
    },
    "macOS": {
      "dmg": {
        "appPosition": { "x": 180, "y": 170 },
        "applicationFolderPosition": { "x": 480, "y": 170 },
        "windowSize": { "height": 400, "width": 660 }
      },
      "minimumSystemVersion": "10.13",
      "hardenedRuntime": true
    }
  },
  "plugins": {}
}
```

Key v1 -> v2 differences:
- `tauri.windows` -> `app.windows`
- `tauri.bundle` -> top-level `bundle`
- `tauri.allowlist` -> capabilities system
- `tauri.systemTray` -> `app.trayIcon`
- `build.distDir` -> `build.frontendDist`
- `build.devPath` -> `build.devUrl`

## Frontend API (invoke)

```typescript
import { invoke } from '@tauri-apps/api/core';

// No args
await invoke('my_custom_command');

// With args (snake_case keys match Rust params)
const result = await invoke<string>('login', { user: 'admin', password: 'secret' });

// Typed response
interface CustomResponse { message: string; other_val: number; }
const response = await invoke<CustomResponse>('my_custom_command', { number: 42 });
```

### Events (frontend <-> backend)

```typescript
import { listen, emit } from '@tauri-apps/api/event';

const unlisten = await listen<string>('gateway-log', (event) => {
  console.log('Log:', event.payload);
});
await emit('start-gateway', { port: 8080 });
unlisten(); // cleanup
```

From Rust:

```rust
use tauri::Emitter;
app.emit("gateway-log", "Gateway started").unwrap();
```

## Key Import Paths (v2)

| Purpose | Import |
| --- | --- |
| IPC invoke | `@tauri-apps/api/core` |
| Window ops | `@tauri-apps/api/window` |
| Events | `@tauri-apps/api/event` |
| Path utils | `@tauri-apps/api/path` |
| Shell plugin | `@tauri-apps/plugin-shell` |

## Build & Packaging

Generate icons:

```bash
pnpm tauri icon path/to/app-icon.png
```

Build for distribution:

```bash
pnpm tauri build
```

Access bundled resources at runtime (Rust):

```rust
let resource_path = app.path().resource_dir()?.join("config.json");
```

## Required Dependencies

**package.json:**
- `@tauri-apps/api` ^2
- `@tauri-apps/plugin-shell` ^2
- `@tauri-apps/cli` ^2 (devDependency)

**Cargo.toml:**
- `tauri` 2
- `tauri-plugin-shell` 2
- `serde` 1 with `derive` feature
- `serde_json` 1
