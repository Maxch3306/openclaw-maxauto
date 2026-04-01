use serde::Serialize;
use std::path::PathBuf;
use tauri::Emitter;

/// On Windows, refresh the PATH env var from the registry so we can detect
/// newly-installed programs (like Git) without restarting the app.
#[cfg(windows)]
pub fn refresh_path_from_registry() {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use winreg::enums::*;
    use winreg::RegKey;

    let mut parts: Vec<String> = Vec::new();

    // System PATH
    if let Ok(env) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment")
    {
        if let Ok(val) = env.get_raw_value("Path") {
            let wide: Vec<u16> = val.bytes.chunks_exact(2)
                .map(|c| u16::from_le_bytes([c[0], c[1]]))
                .collect();
            let s = OsString::from_wide(&wide);
            if let Some(s) = s.to_str() {
                parts.extend(s.trim_end_matches('\0').split(';').map(|p| p.to_string()));
            }
        }
    }

    // User PATH
    if let Ok(env) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Environment") {
        if let Ok(val) = env.get_raw_value("Path") {
            let wide: Vec<u16> = val.bytes.chunks_exact(2)
                .map(|c| u16::from_le_bytes([c[0], c[1]]))
                .collect();
            let s = OsString::from_wide(&wide);
            if let Some(s) = s.to_str() {
                parts.extend(s.trim_end_matches('\0').split(';').map(|p| p.to_string()));
            }
        }
    }

    if !parts.is_empty() {
        std::env::set_var("PATH", parts.join(";"));
    }
}

/// Try to find git.exe by checking well-known install paths.
/// Returns the path if found.
#[cfg(windows)]
pub fn find_git_in_default_paths() -> Option<PathBuf> {
    let candidates = [
        r"C:\Program Files\Git\cmd\git.exe",
        r"C:\Program Files (x86)\Git\cmd\git.exe",
    ];
    for p in &candidates {
        let path = PathBuf::from(p);
        if path.exists() {
            return Some(path);
        }
    }
    None
}

#[derive(Debug, Clone, Serialize)]
pub struct SetupProgress {
    pub step: String,
    pub message: String,
    pub progress: Option<f64>, // 0.0 - 1.0
    pub error: Option<String>,
}

fn maxauto_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Could not determine home directory")
        .join(".openclaw-maxauto")
}

fn node_download_url() -> (String, String) {
    let version = "24.14.0";
    let (os_name, arch_name, ext) = if cfg!(windows) {
        let arch = if cfg!(target_arch = "aarch64") {
            "arm64"
        } else {
            "x64"
        };
        ("win", arch, "zip")
    } else {
        let arch = if cfg!(target_arch = "aarch64") {
            "arm64"
        } else {
            "x64"
        };
        ("darwin", arch, "tar.gz")
    };

    let filename = format!("node-v{}-{}-{}.{}", version, os_name, arch_name, ext);
    let url = format!("https://nodejs.org/dist/v{}/{}", version, filename);
    (url, filename)
}

#[tauri::command]
pub async fn install_node(app: tauri::AppHandle) -> Result<String, String> {
    let node_dir = maxauto_dir().join("node");

    // Check if already installed
    let node_bin = if cfg!(windows) {
        node_dir.join("node.exe")
    } else {
        node_dir.join("bin").join("node")
    };

    if node_bin.exists() {
        // Check if the installed version meets the minimum requirement
        let version_output = tokio::process::Command::new(&node_bin)
            .arg("--version")
            .output()
            .await
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                } else {
                    None
                }
            });

        let needs_upgrade = match &version_output {
            Some(v) => {
                let parts: Vec<u32> = v.trim_start_matches('v')
                    .split('.')
                    .filter_map(|s| s.parse().ok())
                    .collect();
                if parts.len() >= 3 {
                    (parts[0], parts[1], parts[2]) < (24, 14, 0)
                } else {
                    true
                }
            }
            None => true,
        };

        if !needs_upgrade {
            return Ok("Node.js already installed".into());
        }

        // Remove outdated installation
        let _ = std::fs::remove_dir_all(&node_dir);
    }

    let _ = app.emit("setup-progress", SetupProgress {
        step: "node".into(),
        message: "Downloading Node.js...".into(),
        progress: Some(0.0),
        error: None,
    });

    let (url, filename) = node_download_url();
    let temp_dir = maxauto_dir().join("tmp");
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;
    let archive_path = temp_dir.join(&filename);

    // Download
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read download: {}", e))?;

    std::fs::write(&archive_path, &bytes)
        .map_err(|e| format!("Failed to save archive: {}", e))?;

    let _ = app.emit("setup-progress", SetupProgress {
        step: "node".into(),
        message: "Extracting Node.js...".into(),
        progress: Some(0.5),
        error: None,
    });

    // Extract
    std::fs::create_dir_all(&node_dir).map_err(|e| format!("Failed to create node dir: {}", e))?;

    if cfg!(windows) {
        // ZIP extraction
        let file = std::fs::File::open(&archive_path)
            .map_err(|e| format!("Failed to open archive: {}", e))?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| format!("Failed to read zip: {}", e))?;

        // The zip contains a top-level directory like node-v22.12.0-win-x64/
        // We want to extract contents into node_dir
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
            let name = entry.name().to_string();

            // Strip the top-level directory
            let parts: Vec<&str> = name.splitn(2, '/').collect();
            if parts.len() < 2 || parts[1].is_empty() {
                continue;
            }
            let relative = parts[1];
            let outpath = node_dir.join(relative);

            if entry.is_dir() {
                std::fs::create_dir_all(&outpath).ok();
            } else {
                if let Some(parent) = outpath.parent() {
                    std::fs::create_dir_all(parent).ok();
                }
                let mut outfile = std::fs::File::create(&outpath)
                    .map_err(|e| format!("Failed to create {}: {}", outpath.display(), e))?;
                std::io::copy(&mut entry, &mut outfile)
                    .map_err(|e| format!("Failed to extract {}: {}", relative, e))?;
            }
        }
    } else {
        // tar.gz extraction
        let file = std::fs::File::open(&archive_path)
            .map_err(|e| format!("Failed to open archive: {}", e))?;
        let gz = flate2::read::GzDecoder::new(file);
        let mut archive = tar::Archive::new(gz);

        for entry in archive.entries().map_err(|e| e.to_string())? {
            let mut entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path().map_err(|e| e.to_string())?.to_path_buf();
            let components: Vec<_> = path.components().collect();

            if components.len() < 2 {
                continue;
            }

            // Strip top-level dir
            let relative: PathBuf = components[1..].iter().collect();
            let outpath = node_dir.join(&relative);

            if entry.header().entry_type().is_dir() {
                std::fs::create_dir_all(&outpath).ok();
            } else {
                if let Some(parent) = outpath.parent() {
                    std::fs::create_dir_all(parent).ok();
                }
                entry.unpack(&outpath).map_err(|e| {
                    format!("Failed to extract {}: {}", relative.display(), e)
                })?;
            }
        }
    }

    // Cleanup
    let _ = std::fs::remove_file(&archive_path);
    let _ = std::fs::remove_dir_all(&temp_dir);

    let _ = app.emit("setup-progress", SetupProgress {
        step: "node".into(),
        message: "Node.js installed".into(),
        progress: Some(1.0),
        error: None,
    });

    Ok("Node.js installed successfully".into())
}

#[tauri::command]
pub async fn install_git(app: tauri::AppHandle) -> Result<String, String> {
    // Check if git is already available
    let system_git = if cfg!(windows) { "git.exe" } else { "git" };
    let local_git = if cfg!(windows) {
        maxauto_dir().join("git").join("cmd").join("git.exe")
    } else {
        maxauto_dir().join("git").join("bin").join("git")
    };

    if local_git.exists() || tokio::process::Command::new(system_git)
        .arg("--version")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return Ok("Git already installed".into());
    }

    if cfg!(windows) {
        // Windows: download and launch the Git for Windows installer
        let version = "2.47.1";
        let filename = format!("Git-{}-64-bit.exe", version);
        let url = format!(
            "https://github.com/git-for-windows/git/releases/download/v{}.windows.1/{}",
            version, filename
        );

        let temp_dir = maxauto_dir().join("tmp");
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp dir: {}", e))?;
        let installer_path = temp_dir.join(&filename);

        let _ = app.emit("setup-progress", SetupProgress {
            step: "git".into(),
            message: "Downloading Git installer...".into(),
            progress: Some(0.1),
            error: None,
        });

        let response = reqwest::get(&url)
            .await
            .map_err(|_| "GIT_NOT_FOUND".to_string())?;

        if !response.status().is_success() {
            let _ = std::fs::remove_dir_all(&temp_dir);
            return Err("GIT_NOT_FOUND".into());
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|_| "GIT_NOT_FOUND".to_string())?;

        std::fs::write(&installer_path, &bytes)
            .map_err(|e| format!("Failed to save installer: {}", e))?;

        let _ = app.emit("setup-progress", SetupProgress {
            step: "git".into(),
            message: "Launching Git installer (please follow the wizard)...".into(),
            progress: Some(0.4),
            error: None,
        });

        // Launch the installer and wait for the user to finish the wizard
        let mut child = tokio::process::Command::new(&installer_path)
            .spawn()
            .map_err(|e| format!("Failed to launch Git installer: {}", e))?;

        // Wait for the installer process to exit (user clicks through the wizard)
        let _ = app.emit("setup-progress", SetupProgress {
            step: "git".into(),
            message: "Waiting for Git installer to finish...".into(),
            progress: Some(0.5),
            error: None,
        });

        let status = child.wait().await
            .map_err(|e| format!("Git installer process error: {}", e))?;

        // Cleanup installer file
        let _ = std::fs::remove_file(&installer_path);
        let _ = std::fs::remove_dir_all(&temp_dir);

        if !status.success() {
            return Err("Git installer exited with an error. Please try again.".into());
        }

        // Installer finished — refresh PATH from registry and verify git works
        #[cfg(windows)]
        refresh_path_from_registry();

        let git_ok = tokio::process::Command::new("git.exe")
            .arg("--version")
            .output()
            .await
            .map(|o| o.status.success())
            .unwrap_or(false);

        // Also check default install locations directly
        #[cfg(windows)]
        if !git_ok {
            if let Some(git_path) = find_git_in_default_paths() {
                git_ok = tokio::process::Command::new(&git_path)
                    .arg("--version")
                    .output()
                    .await
                    .map(|o| o.status.success())
                    .unwrap_or(false);
            }
        }

        if git_ok {
            let _ = app.emit("setup-progress", SetupProgress {
                step: "git".into(),
                message: "Git installed".into(),
                progress: Some(1.0),
                error: None,
            });
            return Ok("Git installed successfully".into());
        }

        Err("Git installer completed but Git was not detected. \
             Please install Git manually from https://git-scm.com/downloads and retry.".into())
    } else {
        // macOS: trigger Xcode Command Line Tools install
        let _ = app.emit("setup-progress", SetupProgress {
            step: "git".into(),
            message: "Installing Command Line Tools (please follow the system dialog)...".into(),
            progress: Some(0.1),
            error: None,
        });

        // Trigger the CLT installer dialog
        let _ = tokio::process::Command::new("xcode-select")
            .arg("--install")
            .output()
            .await;

        // Poll for git availability (the user clicks through the system dialog)
        let max_wait = std::time::Duration::from_secs(600); // 10 min timeout
        let start = std::time::Instant::now();
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(3)).await;

            let git_ok = tokio::process::Command::new("git")
                .arg("--version")
                .output()
                .await
                .map(|o| o.status.success())
                .unwrap_or(false);

            if git_ok {
                let _ = app.emit("setup-progress", SetupProgress {
                    step: "git".into(),
                    message: "Git installed".into(),
                    progress: Some(1.0),
                    error: None,
                });
                return Ok("Git installed successfully".into());
            }

            if start.elapsed() > max_wait {
                return Err(
                    "Timed out waiting for Git installation. \
                     Please install Git manually from https://git-scm.com/downloads and restart MaxAuto."
                        .into(),
                );
            }

            let elapsed_pct = (start.elapsed().as_secs_f64() / max_wait.as_secs_f64()).min(0.9);
            let _ = app.emit("setup-progress", SetupProgress {
                step: "git".into(),
                message: "Waiting for Command Line Tools installation...".into(),
                progress: Some(0.1 + elapsed_pct * 0.9),
                error: None,
            });
        }
    }
}

#[tauri::command]
pub async fn install_openclaw(app: tauri::AppHandle) -> Result<String, String> {
    let base_dir = maxauto_dir();
    let openclaw_prefix = base_dir.join("openclaw");

    let _ = app.emit("setup-progress", SetupProgress {
        step: "openclaw".into(),
        message: "Installing OpenClaw...".into(),
        progress: Some(0.0),
        error: None,
    });

    // Find node binary
    let local_node = if cfg!(windows) {
        base_dir.join("node").join("node.exe")
    } else {
        base_dir.join("node").join("bin").join("node")
    };

    let node_cmd = if local_node.exists() {
        local_node.to_string_lossy().to_string()
    } else {
        (if cfg!(windows) { "node.exe" } else { "node" }).to_string()
    };

    // Find npm-cli.js — check local install first, then fall back to system npm
    let local_npm_cli = if cfg!(windows) {
        base_dir
            .join("node")
            .join("node_modules")
            .join("npm")
            .join("bin")
            .join("npm-cli.js")
    } else {
        base_dir
            .join("node")
            .join("lib")
            .join("node_modules")
            .join("npm")
            .join("bin")
            .join("npm-cli.js")
    };

    // If we have a local npm-cli.js, use node + npm-cli.js directly.
    // Otherwise, fall back to system "npm" command.
    let use_system_npm = !local_npm_cli.exists();

    std::fs::create_dir_all(&openclaw_prefix)
        .map_err(|e| format!("Failed to create openclaw dir: {}", e))?;

    let _ = app.emit("setup-progress", SetupProgress {
        step: "openclaw".into(),
        message: "Running npm install...".into(),
        progress: Some(0.3),
        error: None,
    });

    // Build PATH with local node and git bin dirs so post-install scripts can find them
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

    // Use our own npm cache to avoid EACCES on root-owned ~/.npm
    let npm_cache = base_dir.join("npm-cache");
    std::fs::create_dir_all(&npm_cache).ok();

    // Some npm dependencies reference ssh://git@github.com/... which fails
    // without SSH keys. Use GIT_CONFIG_* env vars to rewrite to HTTPS
    // scoped only to these subprocesses — no persistent global git config changes.
    let git_config_count = "1";
    let git_config_key = "url.https://github.com/.insteadOf";
    let git_config_val = "ssh://git@github.com/";

    let pkg_spec = format!("openclaw@{}", super::gateway::REQUIRED_OPENCLAW_VERSION);

    let output = if use_system_npm {
        // Use system npm directly
        let npm_cmd = if cfg!(windows) { "npm.cmd" } else { "npm" };
        tokio::process::Command::new(npm_cmd)
            .env("PATH", &new_path)
            .env("npm_config_cache", npm_cache.to_str().unwrap())
            .env("GIT_CONFIG_COUNT", git_config_count)
            .env("GIT_CONFIG_KEY_0", git_config_key)
            .env("GIT_CONFIG_VALUE_0", git_config_val)
            .args([
                "install",
                "--prefix",
                openclaw_prefix.to_str().unwrap(),
                &pkg_spec,
            ])
            .output()
            .await
            .map_err(|e| format!("npm install failed: {}", e))?
    } else {
        // Use local node + npm-cli.js
        tokio::process::Command::new(&node_cmd)
            .env("PATH", &new_path)
            .env("npm_config_cache", npm_cache.to_str().unwrap())
            .env("GIT_CONFIG_COUNT", git_config_count)
            .env("GIT_CONFIG_KEY_0", git_config_key)
            .env("GIT_CONFIG_VALUE_0", git_config_val)
            .arg(local_npm_cli.to_str().unwrap())
            .args([
                "install",
                "--prefix",
                openclaw_prefix.to_str().unwrap(),
                &pkg_spec,
            ])
            .output()
            .await
            .map_err(|e| format!("npm install failed: {}", e))?
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Filter out "npm notice" lines (upgrade ads, changelogs) to surface actual errors
        let errors: String = stderr
            .lines()
            .filter(|l| !l.trim_start().starts_with("npm notice"))
            .collect::<Vec<_>>()
            .join("\n");
        return Err(format!("npm install failed: {}", errors.trim()));
    }

    let _ = app.emit("setup-progress", SetupProgress {
        step: "openclaw".into(),
        message: "OpenClaw installed".into(),
        progress: Some(1.0),
        error: None,
    });

    Ok("OpenClaw installed successfully".into())
}

/// Install a package via winget (Windows only).
/// Returns the combined stdout+stderr output.
#[tauri::command]
pub async fn install_winget_package(package_id: String) -> Result<String, String> {
    // Validate package_id: only allow alphanumeric, dots, hyphens, underscores, slashes
    if !package_id
        .chars()
        .all(|c| c.is_alphanumeric() || c == '.' || c == '-' || c == '_' || c == '/')
    {
        return Err("Invalid package ID".into());
    }

    #[cfg(not(windows))]
    {
        let _ = package_id;
        return Err("winget is only available on Windows".into());
    }

    #[cfg(windows)]
    {
        let output = tokio::process::Command::new("winget")
            .args([
                "install",
                "-e",
                "--id",
                &package_id,
                "--accept-source-agreements",
                "--accept-package-agreements",
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to run winget: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if output.status.success() {
            // Refresh PATH so the new binary is detectable immediately
            refresh_path_from_registry();
            Ok(format!("{}\n{}", stdout, stderr).trim().to_string())
        } else {
            Err(format!(
                "winget install failed (exit {}):\n{}\n{}",
                output.status.code().unwrap_or(-1),
                stdout,
                stderr
            ))
        }
    }
}
