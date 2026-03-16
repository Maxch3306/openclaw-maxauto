use crate::commands::gateway::{ensure_config_with_token, maxauto_dir, GatewayStatus};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const OPENCLAW_IMAGE: &str = "ghcr.io/openclaw/openclaw";

#[derive(Debug, Serialize)]
pub struct DockerStatus {
    pub available: bool,
    pub version: Option<String>,
    pub daemon_running: bool,
}

/// Check if Docker CLI is installed and the daemon is running.
#[tauri::command]
pub async fn check_docker() -> Result<DockerStatus, String> {
    // Check if docker CLI exists
    let docker_bin = if cfg!(windows) { "docker.exe" } else { "docker" };
    let version_output = tokio::process::Command::new(docker_bin)
        .args(["version", "--format", "{{.Server.Version}}"])
        .output()
        .await;

    match version_output {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(DockerStatus {
                available: true,
                version: if version.is_empty() { None } else { Some(version) },
                daemon_running: true,
            })
        }
        Ok(_output) => {
            // Docker CLI exists but daemon might not be running
            // Try just `docker --version` to confirm CLI is there
            let cli_check = tokio::process::Command::new(docker_bin)
                .args(["--version"])
                .output()
                .await;
            match cli_check {
                Ok(o) if o.status.success() => {
                    let raw = String::from_utf8_lossy(&o.stdout).trim().to_string();
                    // Extract version from "Docker version 24.0.7, build ..."
                    let version = raw
                        .strip_prefix("Docker version ")
                        .and_then(|s| s.split(',').next())
                        .map(|s| s.to_string());
                    Ok(DockerStatus {
                        available: true,
                        version,
                        daemon_running: false,
                    })
                }
                _ => Ok(DockerStatus {
                    available: false,
                    version: None,
                    daemon_running: false,
                }),
            }
        }
        Err(_) => Ok(DockerStatus {
            available: false,
            version: None,
            daemon_running: false,
        }),
    }
}

/// Pull the official OpenClaw Docker image.
#[tauri::command]
pub async fn pull_openclaw_image(app: AppHandle, tag: Option<String>) -> Result<String, String> {
    let tag = tag.unwrap_or_else(|| "latest".to_string());
    let image = format!("{}:{}", OPENCLAW_IMAGE, tag);

    let _ = app.emit("setup-progress", format!("Pulling {}...", image));

    let docker_bin = if cfg!(windows) { "docker.exe" } else { "docker" };
    let output = tokio::process::Command::new(docker_bin)
        .args(["pull", &image])
        .output()
        .await
        .map_err(|e| format!("Failed to run docker pull: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("docker pull failed: {}", stderr));
    }

    let _ = app.emit("setup-progress", "Image pulled successfully");
    Ok(format!("Pulled {}", image))
}

/// Start OpenClaw in a Docker container with bind-mounted config and workspace.
#[tauri::command]
pub async fn start_docker_gateway(
    app: AppHandle,
    port: Option<u16>,
    tag: Option<String>,
) -> Result<GatewayStatus, String> {
    let port = port.unwrap_or(51789);
    let tag = tag.unwrap_or_else(|| "latest".to_string());
    let image = format!("{}:{}", OPENCLAW_IMAGE, tag);
    let base_dir = maxauto_dir();
    let config_dir = base_dir.join("config");
    let workspace_dir = base_dir.join("workspace");
    let config_path = config_dir.join("openclaw.json");

    // Ensure directories exist
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;
    std::fs::create_dir_all(&workspace_dir)
        .map_err(|e| format!("Failed to create workspace dir: {}", e))?;

    // Ensure config with token (use "lan" bind since container needs 0.0.0.0)
    let token = ensure_config_with_token(&config_path, 18789, "lan")?;

    // Remove existing container if it exists (ignore errors)
    let docker_bin = if cfg!(windows) { "docker.exe" } else { "docker" };
    let _ = tokio::process::Command::new(docker_bin)
        .args(["rm", "-f", "maxauto-openclaw"])
        .output()
        .await;

    let _ = app.emit("setup-progress", "Starting Docker container...");

    let config_mount = format!(
        "{}:/home/node/.openclaw",
        config_dir.to_str().ok_or("Invalid config dir path")?
    );
    let workspace_mount = format!(
        "{}:/home/node/.openclaw/workspace",
        workspace_dir.to_str().ok_or("Invalid workspace dir path")?
    );
    // Bind to 127.0.0.1 on the host so the port is not exposed to the LAN
    let port_mapping = format!("127.0.0.1:{}:18789", port);
    let token_env = format!("OPENCLAW_GATEWAY_TOKEN={}", token);

    let output = tokio::process::Command::new(docker_bin)
        .args([
            "run",
            "-d",
            "--name",
            "maxauto-openclaw",
            "-p",
            &port_mapping,
            "-e",
            &token_env,
            "-e",
            "OPENCLAW_GATEWAY_BIND=lan",
            "-v",
            &config_mount,
            "-v",
            &workspace_mount,
            "--restart",
            "unless-stopped",
            &image,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to start Docker container: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("docker run failed: {}", stderr));
    }

    // Wait for the gateway to be ready (TCP connect check, up to 30s)
    // The gateway is a WebSocket server — there's no HTTP /healthz endpoint,
    // so we check readiness by attempting a TCP connection to the mapped port.
    let _ = app.emit("setup-progress", "Waiting for gateway to be ready...");
    let addr = format!("127.0.0.1:{}", port);
    let mut healthy = false;
    for _ in 0..30 {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        if tokio::net::TcpStream::connect(&addr).await.is_ok() {
            healthy = true;
            break;
        }
    }

    if !healthy {
        // Check if container is still running
        let inspect = tokio::process::Command::new(docker_bin)
            .args(["inspect", "--format", "{{.State.Running}}", "maxauto-openclaw"])
            .output()
            .await;

        let container_running = inspect
            .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "true")
            .unwrap_or(false);

        if !container_running {
            // Get container logs for debugging
            let logs = tokio::process::Command::new(docker_bin)
                .args(["logs", "--tail", "20", "maxauto-openclaw"])
                .output()
                .await;
            let log_text = logs
                .map(|o| {
                    let stdout = String::from_utf8_lossy(&o.stdout);
                    let stderr = String::from_utf8_lossy(&o.stderr);
                    format!("{}{}", stdout, stderr)
                })
                .unwrap_or_default();

            return Err(format!(
                "Container exited unexpectedly. Logs:\n{}",
                log_text
            ));
        }

        return Err("Gateway health check timed out after 30s".into());
    }

    let _ = app.emit("setup-progress", "Gateway is ready!");

    Ok(GatewayStatus {
        running: true,
        port,
        pid: None, // Docker manages the PID
    })
}

/// Stop the OpenClaw Docker container (without removing it).
#[tauri::command]
pub async fn stop_docker_gateway() -> Result<String, String> {
    let docker_bin = if cfg!(windows) { "docker.exe" } else { "docker" };

    let output = tokio::process::Command::new(docker_bin)
        .args(["stop", "maxauto-openclaw"])
        .output()
        .await
        .map_err(|e| format!("Failed to stop container: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // If container doesn't exist, that's fine
        if !stderr.contains("No such container") {
            return Err(format!("docker stop failed: {}", stderr));
        }
    }

    Ok("Docker gateway stopped".into())
}

/// Check if the Docker container is running.
#[tauri::command]
pub async fn docker_gateway_status(port: Option<u16>) -> Result<GatewayStatus, String> {
    let port = port.unwrap_or(51789);
    let docker_bin = if cfg!(windows) { "docker.exe" } else { "docker" };

    let output = tokio::process::Command::new(docker_bin)
        .args([
            "inspect",
            "--format",
            "{{.State.Running}}",
            "maxauto-openclaw",
        ])
        .output()
        .await;

    match output {
        Ok(o) if o.status.success() => {
            let running = String::from_utf8_lossy(&o.stdout).trim() == "true";
            Ok(GatewayStatus {
                running,
                port,
                pid: None,
            })
        }
        _ => Ok(GatewayStatus {
            running: false,
            port,
            pid: None,
        }),
    }
}
