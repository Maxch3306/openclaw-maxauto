use crate::state::GatewayProcess;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};

#[cfg(windows)]
#[allow(unused_imports)]
use std::os::windows::process::CommandExt;

#[derive(Debug, Serialize)]
pub struct GatewayStatus {
    pub running: bool,
    pub port: u16,
    pub pid: Option<u32>,
}

/// Pinned OpenClaw version. 2026.3.31 broke bundled channel plugin loading
/// (Telegram etc. fail to register). Remove pin once upstream fix #58782 ships.
pub const REQUIRED_OPENCLAW_VERSION: &str = "2026.3.28";

pub(crate) fn maxauto_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Could not determine home directory")
        .join(".openclaw-maxauto")
}

fn openclaw_js_entry() -> PathBuf {
    maxauto_dir()
        .join("openclaw")
        .join("node_modules")
        .join("openclaw")
        .join("openclaw.mjs")
}

fn node_binary() -> PathBuf {
    let local_node = if cfg!(windows) {
        maxauto_dir().join("node").join("node.exe")
    } else {
        maxauto_dir().join("node").join("bin").join("node")
    };

    if local_node.exists() {
        return local_node;
    }

    // Fallback to system node
    PathBuf::from(if cfg!(windows) { "node.exe" } else { "node" })
}

/// Read the installed OpenClaw version from its package.json.
fn installed_openclaw_version() -> Option<String> {
    let pkg = maxauto_dir()
        .join("openclaw")
        .join("node_modules")
        .join("openclaw")
        .join("package.json");
    let raw = std::fs::read_to_string(pkg).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&raw).ok()?;
    parsed.get("version")?.as_str().map(|s| s.to_string())
}

/// Ensure the installed OpenClaw version matches `REQUIRED_OPENCLAW_VERSION`.
/// If it doesn't (or isn't installed), reinstall the correct version via npm.
async fn ensure_openclaw_version(app: &AppHandle) -> Result<(), String> {
    if let Some(v) = installed_openclaw_version() {
        if v == REQUIRED_OPENCLAW_VERSION {
            return Ok(());
        }
        let _ = app.emit("gateway-log", &format!(
            "OpenClaw version mismatch: installed {} but require {}. Reinstalling...",
            v, REQUIRED_OPENCLAW_VERSION
        ));
    } else {
        let _ = app.emit("gateway-log", &format!(
            "OpenClaw version unknown. Installing {}...",
            REQUIRED_OPENCLAW_VERSION
        ));
    }

    let base_dir = maxauto_dir();
    let openclaw_prefix = base_dir.join("openclaw");
    std::fs::create_dir_all(&openclaw_prefix)
        .map_err(|e| format!("Failed to create openclaw dir: {}", e))?;

    let node = node_binary();

    // Build PATH with local node/git bin dirs
    let node_bin_dir = if cfg!(windows) {
        base_dir.join("node")
    } else {
        base_dir.join("node").join("bin")
    };
    let git_bin_dir = if cfg!(windows) {
        base_dir.join("git").join("cmd")
    } else {
        base_dir.join("git").join("bin")
    };
    let path_sep = if cfg!(windows) { ";" } else { ":" };
    let new_path = {
        let mut parts = vec![node_bin_dir.to_string_lossy().to_string()];
        if git_bin_dir.exists() {
            parts.push(git_bin_dir.to_string_lossy().to_string());
        }
        if let Ok(existing) = std::env::var("PATH") {
            parts.push(existing);
        }
        parts.join(path_sep)
    };

    let npm_cache = base_dir.join("npm-cache");
    std::fs::create_dir_all(&npm_cache).ok();

    let pkg_spec = format!("openclaw@{}", REQUIRED_OPENCLAW_VERSION);

    // Find npm-cli.js for local node
    let local_npm_cli = if cfg!(windows) {
        base_dir.join("node").join("node_modules").join("npm").join("bin").join("npm-cli.js")
    } else {
        base_dir.join("node").join("lib").join("node_modules").join("npm").join("bin").join("npm-cli.js")
    };

    let output = if local_npm_cli.exists() {
        tokio::process::Command::new(&node)
            .env("PATH", &new_path)
            .env("npm_config_cache", npm_cache.to_str().unwrap())
            .env("GIT_CONFIG_COUNT", "1")
            .env("GIT_CONFIG_KEY_0", "url.https://github.com/.insteadOf")
            .env("GIT_CONFIG_VALUE_0", "ssh://git@github.com/")
            .arg(local_npm_cli.to_str().unwrap())
            .args(["install", "--prefix", openclaw_prefix.to_str().unwrap(), &pkg_spec])
            .output()
            .await
            .map_err(|e| format!("npm install failed: {}", e))?
    } else {
        let npm_cmd = if cfg!(windows) { "npm.cmd" } else { "npm" };
        tokio::process::Command::new(npm_cmd)
            .env("PATH", &new_path)
            .env("npm_config_cache", npm_cache.to_str().unwrap())
            .env("GIT_CONFIG_COUNT", "1")
            .env("GIT_CONFIG_KEY_0", "url.https://github.com/.insteadOf")
            .env("GIT_CONFIG_VALUE_0", "ssh://git@github.com/")
            .args(["install", "--prefix", openclaw_prefix.to_str().unwrap(), &pkg_spec])
            .output()
            .await
            .map_err(|e| format!("npm install failed: {}", e))?
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let errors: String = stderr
            .lines()
            .filter(|l| !l.trim_start().starts_with("npm notice"))
            .collect::<Vec<_>>()
            .join("\n");
        return Err(format!(
            "Failed to install OpenClaw {}: {}",
            REQUIRED_OPENCLAW_VERSION,
            errors.trim()
        ));
    }

    let _ = app.emit("gateway-log", &format!(
        "OpenClaw {} installed successfully",
        REQUIRED_OPENCLAW_VERSION
    ));
    Ok(())
}

pub(crate) fn generate_token() -> String {
    use std::collections::hash_map::RandomState;
    use std::hash::{BuildHasher, Hasher};
    let mut token = String::with_capacity(48);
    for _ in 0..3 {
        let s = RandomState::new();
        let mut h = s.build_hasher();
        h.write_u64(std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos() as u64);
        token.push_str(&format!("{:016x}", h.finish()));
    }
    token
}

pub(crate) fn ensure_config_with_token(config_path: &std::path::Path, port: u16, bind: &str) -> Result<String, String> {
    // Origins that Tauri webviews may send depending on OS/version
    let allowed_origins = serde_json::json!([
        "tauri://localhost",
        "https://tauri.localhost",
        "http://tauri.localhost",
        "http://localhost:5173"
    ]);

    // controlUi config: allow Tauri origins + disable device identity checks
    // (safe for local-only loopback gateway)
    let control_ui = serde_json::json!({
        "allowedOrigins": allowed_origins,
        "allowInsecureAuth": true,
        "dangerouslyDisableDeviceAuth": true
    });

    // Default workspace under maxauto dir for environment isolation
    let default_workspace = maxauto_dir().join("workspace");
    let default_workspace_str = default_workspace.to_str().unwrap();

    /// Ensure agents.defaults.workspace is set in an existing config
    fn ensure_workspace_default(config: &mut serde_json::Value, workspace: &str) {
        let root = config.as_object_mut().unwrap();
        let agents = root
            .entry("agents")
            .or_insert_with(|| serde_json::json!({}));
        let agents_obj = agents.as_object_mut().unwrap();
        let defaults = agents_obj
            .entry("defaults")
            .or_insert_with(|| serde_json::json!({}));
        let defaults_obj = defaults.as_object_mut().unwrap();
        if !defaults_obj.contains_key("workspace") {
            defaults_obj.insert("workspace".into(), serde_json::json!(workspace));
        }
    }

    if config_path.exists() {
        // Read existing config and extract token
        let raw = std::fs::read_to_string(config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        let config: serde_json::Value = serde_json::from_str(&raw)
            .map_err(|e| format!("Failed to parse config: {}", e))?;

        // Try to get existing token
        if let Some(token) = config
            .get("gateway")
            .and_then(|g| g.get("auth"))
            .and_then(|a| a.get("token"))
            .and_then(|t| t.as_str())
        {
            let token = token.to_string();

            let mut config = config;

            // Ensure gateway.mode, bind, port, and controlUi config are set
            if let Some(gw) = config.get_mut("gateway").and_then(|g| g.as_object_mut()) {
                if !gw.contains_key("mode") {
                    gw.insert("mode".into(), serde_json::json!("local"));
                }

                // Always update bind and port to match the requested values
                // (critical for Docker mode where bind must be "lan" for 0.0.0.0)
                gw.insert("bind".into(), serde_json::json!(bind));
                gw.insert("port".into(), serde_json::json!(port));

                // Always update controlUi to ensure Tauri origins + insecure auth are present
                gw.insert("controlUi".into(), control_ui.clone());
            }

            // Ensure default workspace under maxauto dir
            ensure_workspace_default(&mut config, default_workspace_str);

            std::fs::write(
                config_path,
                serde_json::to_string_pretty(&config).unwrap(),
            )
            .map_err(|e| format!("Failed to write config: {}", e))?;

            return Ok(token);
        }

        // Config exists but no token — add token auth
        let mut config = config;
        let gateway = config
            .as_object_mut()
            .ok_or("Config is not an object")?
            .entry("gateway")
            .or_insert_with(|| serde_json::json!({}));
        let gw_obj = gateway
            .as_object_mut()
            .ok_or("gateway is not an object")?;

        // Ensure gateway.mode is set
        gw_obj.entry("mode").or_insert_with(|| serde_json::json!("local"));

        // Always update bind and port to match the requested values
        gw_obj.insert("bind".into(), serde_json::json!(bind));
        gw_obj.insert("port".into(), serde_json::json!(port));

        // Ensure controlUi config
        gw_obj.insert("controlUi".into(), control_ui.clone());

        let auth = gw_obj
            .entry("auth")
            .or_insert_with(|| serde_json::json!({}));
        let auth_obj = auth
            .as_object_mut()
            .ok_or("auth is not an object")?;
        let token = generate_token();
        auth_obj.insert("mode".into(), serde_json::json!("token"));
        auth_obj.insert("token".into(), serde_json::json!(token));

        // Ensure default workspace under maxauto dir
        ensure_workspace_default(&mut config, default_workspace_str);

        std::fs::write(
            config_path,
            serde_json::to_string_pretty(&config).unwrap(),
        )
        .map_err(|e| format!("Failed to write config: {}", e))?;

        return Ok(token);
    }

    // Config doesn't exist — create with token
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }

    let token = generate_token();
    let default_config = serde_json::json!({
        "agents": {
            "defaults": {
                "workspace": default_workspace_str
            }
        },
        "gateway": {
            "mode": "local",
            "port": port,
            "bind": bind,
            "auth": {
                "mode": "token",
                "token": token
            },
            "controlUi": control_ui
        }
    });
    std::fs::write(
        config_path,
        serde_json::to_string_pretty(&default_config).unwrap(),
    )
    .map_err(|e| format!("Failed to write default config: {}", e))?;

    Ok(token)
}

/// Ensure all paired devices have full operator scopes.
///
/// Internal gateway calls (e.g. from sessions_spawn subagents) use
/// CLI_DEFAULT_OPERATOR_SCOPES which includes admin/read/write/approvals/pairing.
/// If a device was initially paired with limited scopes (e.g. only "operator.read"),
/// subsequent connections requesting wider scopes trigger a "scope-upgrade" pairing
/// request. The gateway never silently auto-approves scope upgrades (silent=false is
/// hardcoded), so the connection fails with "pairing required" (1008).
///
/// This function patches paired.json at startup to grant full operator scopes to all
/// operator-role devices, preventing scope-upgrade pairing failures.
fn ensure_paired_devices_full_scopes(base_dir: &std::path::Path) {
    let paired_path = base_dir.join("devices").join("paired.json");
    if !paired_path.exists() {
        return;
    }
    let raw = match std::fs::read_to_string(&paired_path) {
        Ok(r) => r,
        Err(_) => return,
    };
    let mut doc: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return,
    };
    let full_scopes = serde_json::json!([
        "operator.admin",
        "operator.read",
        "operator.write",
        "operator.approvals",
        "operator.pairing"
    ]);
    let mut changed = false;
    if let Some(obj) = doc.as_object_mut() {
        for (_device_id, entry) in obj.iter_mut() {
            if let Some(entry_obj) = entry.as_object_mut() {
                // Only patch operator-role devices
                let is_operator = entry_obj
                    .get("role")
                    .and_then(|r| r.as_str())
                    .map_or(false, |r| r == "operator");
                if !is_operator {
                    continue;
                }
                // Patch scopes and approvedScopes to full set
                if entry_obj.get("approvedScopes") != Some(&full_scopes) {
                    entry_obj.insert("scopes".into(), full_scopes.clone());
                    entry_obj.insert("approvedScopes".into(), full_scopes.clone());
                    // Also update tokens to include full scopes
                    if let Some(tokens) = entry_obj.get_mut("tokens").and_then(|t| t.as_object_mut()) {
                        if let Some(op_token) = tokens.get_mut("operator").and_then(|t| t.as_object_mut()) {
                            op_token.insert("scopes".into(), full_scopes.clone());
                        }
                    }
                    changed = true;
                }
            }
        }
    }
    if changed {
        // Also clear pending requests since they may reference stale scope state
        let pending_path = base_dir.join("devices").join("pending.json");
        let _ = std::fs::write(&pending_path, "{}");
        let _ = std::fs::write(&paired_path, serde_json::to_string_pretty(&doc).unwrap());
    }
}

/// Read the gateway auth token from the config file
#[tauri::command]
pub async fn get_gateway_token() -> Result<String, String> {
    let config_path = maxauto_dir().join("config").join("openclaw.json");
    if !config_path.exists() {
        return Err("Config not found".into());
    }

    let raw = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config: {}", e))?;
    let config: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    config
        .get("gateway")
        .and_then(|g| g.get("auth"))
        .and_then(|a| a.get("token"))
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "No gateway token found in config".into())
}

/// Kill any process listening on the given port (handles orphaned gateway processes)
async fn kill_process_on_port(port: u16) {
    if cfg!(windows) {
        // Use PowerShell to find and kill process on port
        let script = format!(
            "Get-NetTCPConnection -LocalPort {} -State Listen -ErrorAction SilentlyContinue | ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}",
            port
        );
        let mut cmd = tokio::process::Command::new("powershell");
        cmd.args(["-NoProfile", "-Command", &script]);
        #[cfg(windows)]
        {
            cmd.creation_flags(0x08000000);
        }
        let _ = cmd.output().await;
    } else {
        // macOS: lsof to find PIDs, then kill each one
        // Note: macOS xargs doesn't support -r, so we check output first
        if let Ok(output) = tokio::process::Command::new("lsof")
            .args(["-ti", &format!(":{port}")])
            .output()
            .await
        {
            let pids = String::from_utf8_lossy(&output.stdout);
            for pid in pids.split_whitespace() {
                if !pid.is_empty() {
                    let _ = tokio::process::Command::new("kill")
                        .args(["-9", pid])
                        .output()
                        .await;
                }
            }
        }
    }

    // Give the OS time to release the port
    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
}

#[tauri::command]
pub async fn start_gateway(
    app: AppHandle,
    state: State<'_, GatewayProcess>,
    port: Option<u16>,
) -> Result<GatewayStatus, String> {
    // If we already have a child, kill it first (handles restart)
    let old_child = {
        let mut lock = state.child.lock().map_err(|e| e.to_string())?;
        lock.take()
    };
    if let Some(mut old) = old_child {
        let _ = old.kill().await;
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }

    let port = port.unwrap_or(51789);
    // Native mode always binds to loopback for security — never expose to LAN
    let bind = "loopback".to_string();
    let base_dir = maxauto_dir();
    let config_path = base_dir.join("config").join("openclaw.json");

    // Kill any orphaned process on our port (from a previous crash/restart)
    kill_process_on_port(port).await;

    // Ensure config exists with token auth
    let _token = ensure_config_with_token(&config_path, port, &bind)?;

    // Ensure paired devices have full operator scopes so internal callGateway()
    // (used by sessions_spawn / subagents / cron) doesn't hit "pairing required"
    // scope-upgrade errors. Scope upgrades are never silently auto-approved by
    // the gateway, so we patch the persisted pairing state at startup.
    ensure_paired_devices_full_scopes(&base_dir);

    // Pre-create the default workspace directory so the first message isn't delayed
    let default_workspace = base_dir.join("workspace");
    if !default_workspace.exists() {
        let _ = std::fs::create_dir_all(&default_workspace);
    }

    let node = node_binary();
    let entry = openclaw_js_entry();

    if !entry.exists() {
        return Err(format!(
            "OpenClaw not installed. Expected at: {}",
            entry.display()
        ));
    }

    // Ensure installed version matches the pinned version before launching
    ensure_openclaw_version(&app).await?;

    let mut cmd = tokio::process::Command::new(&node);
    cmd.arg(&entry)
        .args(["gateway", "run", "--bind", &bind, "--port", &port.to_string()])
        .env("OPENCLAW_STATE_DIR", base_dir.to_str().unwrap())
        .env("OPENCLAW_CONFIG_PATH", config_path.to_str().unwrap())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);

    // Hide the console window on Windows
    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start gateway: {}", e))?;

    // Take stdout/stderr before moving child into state, and stream them as events
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    fn spawn_log_reader(app: AppHandle, reader: impl tokio::io::AsyncRead + Unpin + Send + 'static) {
        use tokio::io::{AsyncBufReadExt, BufReader};
        tokio::spawn(async move {
            let mut lines = BufReader::new(reader).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app.emit("gateway-log", &line);
            }
        });
    }

    if let Some(out) = stdout {
        spawn_log_reader(app.clone(), out);
    }
    if let Some(err) = stderr {
        spawn_log_reader(app.clone(), err);
    }

    // Emit initial status
    let _ = app.emit("gateway-log", "Gateway process started, waiting for ready...");

    // Wait briefly and check if the process crashed on startup
    tokio::time::sleep(std::time::Duration::from_millis(2000)).await;
    match child.try_wait() {
        Ok(Some(status)) => {
            let msg = format!("Gateway exited immediately with {}", status);
            let _ = app.emit("gateway-log", &msg);
            return Err(msg);
        }
        Ok(None) => { /* still running — good */ }
        Err(e) => return Err(format!("Failed to check gateway status: {}", e)),
    }

    let pid = child.id();
    {
        let mut child_lock = state.child.lock().map_err(|e| e.to_string())?;
        *child_lock = Some(child);
    }
    *state.port.lock().map_err(|e| e.to_string())? = port;

    Ok(GatewayStatus {
        running: true,
        port,
        pid,
    })
}

#[tauri::command]
pub async fn stop_gateway(state: State<'_, GatewayProcess>) -> Result<String, String> {
    let child = {
        let mut child_lock = state.child.lock().map_err(|e| e.to_string())?;
        child_lock.take()
    };

    if let Some(mut child) = child {
        child.kill().await.map_err(|e| format!("Failed to kill gateway: {}", e))?;
        Ok("Gateway stopped".into())
    } else {
        Err("Gateway is not running".into())
    }
}

#[tauri::command]
pub async fn gateway_status(state: State<'_, GatewayProcess>) -> Result<GatewayStatus, String> {
    let mut child_lock = state.child.lock().map_err(|e| e.to_string())?;
    let port = *state.port.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut child) = *child_lock {
        // Check if process is still running
        match child.try_wait() {
            Ok(Some(_status)) => {
                // Process exited
                *child_lock = None;
                Ok(GatewayStatus {
                    running: false,
                    port,
                    pid: None,
                })
            }
            Ok(None) => {
                // Still running
                Ok(GatewayStatus {
                    running: true,
                    port,
                    pid: child.id(),
                })
            }
            Err(e) => Err(format!("Failed to check gateway status: {}", e)),
        }
    } else {
        Ok(GatewayStatus {
            running: false,
            port,
            pid: None,
        })
    }
}

/// Run `openclaw doctor` and return the output
#[tauri::command]
pub async fn run_doctor() -> Result<String, String> {
    let node = node_binary();
    let entry = openclaw_js_entry();
    let base_dir = maxauto_dir();
    let config_path = base_dir.join("config").join("openclaw.json");

    if !entry.exists() {
        return Err("OpenClaw not installed".into());
    }

    let mut cmd = tokio::process::Command::new(&node);
    cmd.arg(&entry)
        .arg("doctor")
        .env("OPENCLAW_STATE_DIR", base_dir.to_str().unwrap())
        .env("OPENCLAW_CONFIG_PATH", config_path.to_str().unwrap());

    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000);
    }

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to run doctor: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    let mut result = stdout;
    if !stderr.is_empty() {
        if !result.is_empty() {
            result.push('\n');
        }
        result.push_str(&stderr);
    }

    if result.trim().is_empty() {
        result = if output.status.success() {
            "Doctor check passed with no output.".into()
        } else {
            format!("Doctor exited with code: {}", output.status)
        };
    }

    Ok(result)
}
