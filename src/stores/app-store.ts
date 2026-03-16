import { create } from "zustand";

type SetupStep = "choosing-mode" | "checking" | "install-git" | "install-node" | "install-openclaw" | "ready" | "error";
type InstallMode = "native" | "docker";

interface AppState {
  setupComplete: boolean;
  setupStep: SetupStep;
  setupError: string | null;
  installMode: InstallMode;
  gatewayRunning: boolean;
  gatewayConnected: boolean;
  gatewayPort: number;
  currentPage: "home" | "settings";

  setSetupComplete: (v: boolean) => void;
  setSetupStep: (step: SetupStep) => void;
  setSetupError: (err: string | null) => void;
  setInstallMode: (mode: InstallMode) => void;
  setGatewayRunning: (v: boolean) => void;
  setGatewayConnected: (v: boolean) => void;
  setGatewayPort: (port: number) => void;
  setCurrentPage: (page: "home" | "settings") => void;
}

const savedMode = (localStorage.getItem("maxauto-install-mode") as InstallMode) || "native";

export const useAppStore = create<AppState>((set) => ({
  setupComplete: false,
  setupStep: "choosing-mode",
  setupError: null,
  installMode: savedMode,
  gatewayRunning: false,
  gatewayConnected: false,
  gatewayPort: 51789,
  currentPage: "home",

  setSetupComplete: (v) => set({ setupComplete: v }),
  setSetupStep: (step) => set({ setupStep: step }),
  setSetupError: (err) => set({ setupError: err }),
  setInstallMode: (mode) => {
    localStorage.setItem("maxauto-install-mode", mode);
    set({ installMode: mode });
  },
  setGatewayRunning: (v) => set({ gatewayRunning: v }),
  setGatewayConnected: (v) => set({ gatewayConnected: v }),
  setGatewayPort: (port) => set({ gatewayPort: port }),
  setCurrentPage: (page) => set({ currentPage: page }),
}));
