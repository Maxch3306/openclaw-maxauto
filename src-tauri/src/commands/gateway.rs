use crate::state::GatewayProcess;
use serde::Serialize;
use std::path::PathBuf;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct GatewayStatus {
    pub running: bool,
    pub port: u16,
    pub pid: Option<u32>,
}

fn maxauto_dir() -> PathBuf {
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

fn generate_token() -> String {
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

fn ensure_config_with_token(config_path: &std::path::Path, port: u16, bind: &str) -> Result<String, String> {
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

            // Ensure gateway.mode and controlUi config are set
            if let Some(gw) = config.get_mut("gateway").and_then(|g| g.as_object_mut()) {
                if !gw.contains_key("mode") {
                    gw.insert("mode".into(), serde_json::json!("local"));
                }

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
        let _ = tokio::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .await;
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
    state: State<'_, GatewayProcess>,
    port: Option<u16>,
    bind: Option<String>,
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
    let bind = bind.unwrap_or_else(|| "loopback".to_string());
    let base_dir = maxauto_dir();
    let config_path = base_dir.join("config").join("openclaw.json");

    // Kill any orphaned process on our port (from a previous crash/restart)
    kill_process_on_port(port).await;

    // Ensure config exists with token auth
    let _token = ensure_config_with_token(&config_path, port, &bind)?;

    let node = node_binary();
    let entry = openclaw_js_entry();

    if !entry.exists() {
        return Err(format!(
            "OpenClaw not installed. Expected at: {}",
            entry.display()
        ));
    }

    let mut child = tokio::process::Command::new(&node)
        .arg(&entry)
        .args(["gateway", "run", "--bind", &bind, "--port", &port.to_string()])
        .env("OPENCLAW_STATE_DIR", base_dir.to_str().unwrap())
        .env("OPENCLAW_CONFIG_PATH", config_path.to_str().unwrap())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start gateway: {}", e))?;

    // Wait briefly and check if the process crashed on startup
    tokio::time::sleep(std::time::Duration::from_millis(2000)).await;
    match child.try_wait() {
        Ok(Some(status)) => {
            // Process already exited — collect stderr for diagnostics
            let stderr = if let Some(mut err) = child.stderr.take() {
                let mut buf = String::new();
                use tokio::io::AsyncReadExt;
                let _ = err.read_to_string(&mut buf).await;
                buf
            } else {
                String::new()
            };
            let msg = if stderr.trim().is_empty() {
                format!("Gateway exited immediately with {}", status)
            } else {
                format!("Gateway exited with {}: {}", status, stderr.trim().chars().take(500).collect::<String>())
            };
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

    let output = tokio::process::Command::new(&node)
        .arg(&entry)
        .arg("doctor")
        .env("OPENCLAW_STATE_DIR", base_dir.to_str().unwrap())
        .env("OPENCLAW_CONFIG_PATH", config_path.to_str().unwrap())
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
