use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::SystemTime;

fn maxauto_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Could not determine home directory")
        .join(".openclaw-maxauto")
}

fn pairing_file_path() -> PathBuf {
    maxauto_dir()
        .join("credentials")
        .join("telegram-pairing.json")
}

fn allow_from_file_path(account_id: Option<&str>) -> PathBuf {
    let creds = maxauto_dir().join("credentials");
    match account_id {
        Some(id) if !id.is_empty() => creds.join(format!("telegram-{}-allowFrom.json", id)),
        _ => creds.join("telegram-allowFrom.json"),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingRequest {
    pub id: String,
    pub code: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "lastSeenAt")]
    pub last_seen_at: String,
    #[serde(default)]
    pub meta: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct PairingStore {
    version: u32,
    requests: Vec<PairingRequest>,
}

/// Get current Unix timestamp in seconds
fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Parse an ISO 8601 / RFC 3339 timestamp to Unix seconds (basic parser)
fn parse_iso_timestamp(s: &str) -> Option<u64> {
    // Format: "2026-03-12T10:30:00.000Z" or "2026-03-12T10:30:00Z"
    let s = s.trim();
    let date_part = s.get(..10)?;
    let time_part = s.get(11..19)?;

    let year: u64 = date_part.get(..4)?.parse().ok()?;
    let month: u64 = date_part.get(5..7)?.parse().ok()?;
    let day: u64 = date_part.get(8..10)?.parse().ok()?;
    let hour: u64 = time_part.get(..2)?.parse().ok()?;
    let min: u64 = time_part.get(3..5)?.parse().ok()?;
    let sec: u64 = time_part.get(6..8)?.parse().ok()?;

    // Days in months (non-leap approximation, close enough for TTL checks)
    let days_before_month = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let m = month.checked_sub(1)? as usize;
    if m >= 12 { return None; }

    let mut days = (year - 1970) * 365 + (year - 1969) / 4;
    days += days_before_month[m] + (day - 1);
    if month > 2 && year % 4 == 0 { days += 1; }

    Some(days * 86400 + hour * 3600 + min * 60 + sec)
}

/// List pending Telegram pairing requests
#[tauri::command]
pub async fn list_pairing_requests() -> Result<Vec<PairingRequest>, String> {
    let path = pairing_file_path();
    if !path.exists() {
        return Ok(vec![]);
    }

    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read pairing file: {}", e))?;
    let store: PairingStore = serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse pairing file: {}", e))?;

    // Filter out expired requests (1 hour TTL)
    let now = now_secs();
    let valid: Vec<PairingRequest> = store
        .requests
        .into_iter()
        .filter(|r| {
            if let Some(created) = parse_iso_timestamp(&r.created_at) {
                now.saturating_sub(created) < 3600
            } else {
                true // Keep if we can't parse the date
            }
        })
        .collect();

    Ok(valid)
}

/// Approve a Telegram pairing request by code.
/// This removes the request from the pairing store and adds the user ID to the allowFrom list.
#[tauri::command]
pub async fn approve_pairing_request(code: String) -> Result<String, String> {
    let path = pairing_file_path();
    if !path.exists() {
        return Err("No pairing requests found".into());
    }

    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read pairing file: {}", e))?;
    let mut store: PairingStore = serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse pairing file: {}", e))?;

    // Find the request by code (case-insensitive, matching OpenClaw behavior)
    let idx = store
        .requests
        .iter()
        .position(|r| r.code.eq_ignore_ascii_case(&code))
        .ok_or_else(|| format!("No pairing request found with code: {}", code))?;

    let request = store.requests.remove(idx);
    let user_id = request.id.clone();

    // Write back the updated pairing store
    let updated = serde_json::json!({
        "version": store.version,
        "requests": store.requests,
    });
    std::fs::write(&path, serde_json::to_string_pretty(&updated).unwrap())
        .map_err(|e| format!("Failed to write pairing file: {}", e))?;

    // Add user ID to allowFrom list (format: { "version": 1, "allowFrom": [...] })
    let allow_path = allow_from_file_path(None);
    let mut allow_list: Vec<String> = if allow_path.exists() {
        let raw = std::fs::read_to_string(&allow_path).unwrap_or_default();
        let store: serde_json::Value = serde_json::from_str(&raw).unwrap_or_default();
        store
            .get("allowFrom")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default()
    } else {
        vec![]
    };

    if !allow_list.contains(&user_id) {
        allow_list.push(user_id.clone());
    }

    // Ensure credentials dir exists
    if let Some(parent) = allow_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create credentials dir: {}", e))?;
    }

    let allow_store = serde_json::json!({
        "version": 1,
        "allowFrom": allow_list,
    });
    std::fs::write(
        &allow_path,
        serde_json::to_string_pretty(&allow_store).unwrap(),
    )
    .map_err(|e| format!("Failed to write allowFrom file: {}", e))?;

    Ok(user_id)
}

/// Reject a Telegram pairing request by code (just removes it from pending).
#[tauri::command]
pub async fn reject_pairing_request(code: String) -> Result<(), String> {
    let path = pairing_file_path();
    if !path.exists() {
        return Ok(());
    }

    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read pairing file: {}", e))?;
    let mut store: PairingStore = serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse pairing file: {}", e))?;

    store.requests.retain(|r| r.code != code);

    let updated = serde_json::json!({
        "version": store.version,
        "requests": store.requests,
    });
    std::fs::write(&path, serde_json::to_string_pretty(&updated).unwrap())
        .map_err(|e| format!("Failed to write pairing file: {}", e))?;

    Ok(())
}
