mod commands;
mod state;
mod tray;

use state::GatewayProcess;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(GatewayProcess::new())
        .invoke_handler(tauri::generate_handler![
            // Gateway
            commands::gateway::start_gateway,
            commands::gateway::stop_gateway,
            commands::gateway::gateway_status,
            commands::gateway::get_gateway_token,
            commands::gateway::run_doctor,
            // System
            commands::system::get_platform_info,
            commands::system::check_node,
            commands::system::check_git,
            commands::system::check_openclaw,
            commands::system::open_folder,
            // Setup
            commands::setup::install_node,
            commands::setup::install_git,
            commands::setup::install_openclaw,
            commands::setup::install_winget_package,
            // Config
            commands::config::read_config,
            commands::config::write_config,
            commands::config::read_provider_api_key,
            // Pairing
            commands::pairing::list_pairing_requests,
            commands::pairing::approve_pairing_request,
            commands::pairing::reject_pairing_request,
            // Docker
            commands::docker::check_docker,
            commands::docker::pull_openclaw_image,
            commands::docker::start_docker_gateway,
            commands::docker::stop_docker_gateway,
            commands::docker::docker_gateway_status,
        ])
        .setup(|app| {
            tray::menu::setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
