import { create } from "zustand";

type SetupStep = "checking" | "install-git" | "install-node" | "install-openclaw" | "ready" | "error";

interface AppState {
  setupComplete: boolean;
  setupStep: SetupStep;
  setupError: string | null;
  gatewayRunning: boolean;
  gatewayConnected: boolean;
  gatewayPort: number;
  currentPage: "home" | "settings";

  setSetupComplete: (v: boolean) => void;
  setSetupStep: (step: SetupStep) => void;
  setSetupError: (err: string | null) => void;
  setGatewayRunning: (v: boolean) => void;
  setGatewayConnected: (v: boolean) => void;
  setGatewayPort: (port: number) => void;
  setCurrentPage: (page: "home" | "settings") => void;
}

export const useAppStore = create<AppState>((set) => ({
  setupComplete: false,
  setupStep: "checking",
  setupError: null,
  gatewayRunning: false,
  gatewayConnected: false,
  gatewayPort: 18789,
  currentPage: "home",

  setSetupComplete: (v) => set({ setupComplete: v }),
  setSetupStep: (step) => set({ setupStep: step }),
  setSetupError: (err) => set({ setupError: err }),
  setGatewayRunning: (v) => set({ gatewayRunning: v }),
  setGatewayConnected: (v) => set({ gatewayConnected: v }),
  setGatewayPort: (port) => set({ gatewayPort: port }),
  setCurrentPage: (page) => set({ currentPage: page }),
}));
