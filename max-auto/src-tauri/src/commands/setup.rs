use serde::Serialize;
use std::path::PathBuf;
use tauri::Emitter;

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

fn git_download_url() -> (String, String) {
    let version = "2.49.0";
    if cfg!(windows) {
        let arch = if cfg!(target_arch = "aarch64") {
            "arm64"
        } else {
            "64-bit"
        };
        let filename = format!("MinGit-{}-{}.zip", version, arch);
        let url = format!(
            "https://github.com/git-for-windows/git/releases/download/v{}.windows.1/{}",
            version, filename
        );
        (url, filename)
    } else {
        // macOS — not used, we install via xcode-select
        ("".into(), "".into())
    }
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
        // Windows: download MinGit portable
        let _ = app.emit("setup-progress", SetupProgress {
            step: "git".into(),
            message: "Downloading Git...".into(),
            progress: Some(0.0),
            error: None,
        });

        let (url, filename) = git_download_url();
        let temp_dir = maxauto_dir().join("tmp");
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp dir: {}", e))?;
        let archive_path = temp_dir.join(&filename);

        let response = reqwest::get(&url)
            .await
            .map_err(|e| format!("Git download failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Git download failed with status: {}", response.status()));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read download: {}", e))?;

        std::fs::write(&archive_path, &bytes)
            .map_err(|e| format!("Failed to save archive: {}", e))?;

        let _ = app.emit("setup-progress", SetupProgress {
            step: "git".into(),
            message: "Extracting Git...".into(),
            progress: Some(0.5),
            error: None,
        });

        let git_dir = maxauto_dir().join("git");
        std::fs::create_dir_all(&git_dir)
            .map_err(|e| format!("Failed to create git dir: {}", e))?;

        // MinGit ZIP extracts flat (no top-level directory wrapper)
        let file = std::fs::File::open(&archive_path)
            .map_err(|e| format!("Failed to open archive: {}", e))?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| format!("Failed to read zip: {}", e))?;

        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
            let name = entry.name().to_string();
            let outpath = git_dir.join(&name);

            if entry.is_dir() {
                std::fs::create_dir_all(&outpath).ok();
            } else {
                if let Some(parent) = outpath.parent() {
                    std::fs::create_dir_all(parent).ok();
                }
                let mut outfile = std::fs::File::create(&outpath)
                    .map_err(|e| format!("Failed to create {}: {}", outpath.display(), e))?;
                std::io::copy(&mut entry, &mut outfile)
                    .map_err(|e| format!("Failed to extract {}: {}", name, e))?;
            }
        }

        // Cleanup
        let _ = std::fs::remove_file(&archive_path);
        let _ = std::fs::remove_dir_all(&temp_dir);

        let _ = app.emit("setup-progress", SetupProgress {
            step: "git".into(),
            message: "Git installed".into(),
            progress: Some(1.0),
            error: None,
        });

        Ok("Git installed successfully".into())
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

    let output = if use_system_npm {
        // Use system npm directly
        let npm_cmd = if cfg!(windows) { "npm.cmd" } else { "npm" };
        tokio::process::Command::new(npm_cmd)
            .env("PATH", &new_path)
            .env("npm_config_cache", npm_cache.to_str().unwrap())
            .args([
                "install",
                "--prefix",
                openclaw_prefix.to_str().unwrap(),
                "openclaw",
            ])
            .output()
            .await
            .map_err(|e| format!("npm install failed: {}", e))?
    } else {
        // Use local node + npm-cli.js
        tokio::process::Command::new(&node_cmd)
            .env("PATH", &new_path)
            .env("npm_config_cache", npm_cache.to_str().unwrap())
            .arg(local_npm_cli.to_str().unwrap())
            .args([
                "install",
                "--prefix",
                openclaw_prefix.to_str().unwrap(),
                "openclaw",
            ])
            .output()
            .await
            .map_err(|e| format!("npm install failed: {}", e))?
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("npm install failed: {}", stderr));
    }

    let _ = app.emit("setup-progress", SetupProgress {
        step: "openclaw".into(),
        message: "OpenClaw installed".into(),
        progress: Some(1.0),
        error: None,
    });

    Ok("OpenClaw installed successfully".into())
}
