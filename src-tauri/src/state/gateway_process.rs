use std::sync::Mutex;
use tokio::process::Child;

pub struct GatewayProcess {
    pub child: Mutex<Option<Child>>,
    pub port: Mutex<u16>,
}

impl GatewayProcess {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            port: Mutex::new(51789),
        }
    }
}
