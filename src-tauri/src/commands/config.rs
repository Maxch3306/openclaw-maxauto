use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigData {
    pub raw: String,
    pub path: String,
}

fn config_path() -> PathBuf {
    dirs::home_dir()
        .expect("Could not determine home directory")
        .join(".openclaw-maxauto")
        .join("config")
        .join("openclaw.json")
}

#[tauri::command]
pub async fn read_config() -> Result<ConfigData, String> {
    let path = config_path();

    if !path.exists() {
        // Return empty default config
        return Ok(ConfigData {
            raw: "{}".into(),
            path: path.to_string_lossy().to_string(),
        });
    }

    let raw =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read config: {}", e))?;

    Ok(ConfigData {
        raw,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn write_config(json: String) -> Result<String, String> {
    let path = config_path();

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }

    // Validate JSON
    serde_json::from_str::<serde_json::Value>(&json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    std::fs::write(&path, &json).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok("Config saved".into())
}
