import { create } from "zustand";
import {
  THEME_PRESETS,
  deriveThemeVariables,
  applyThemeVariables,
} from "@/lib/theme-utils";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "maxauto-appearance";

interface AppearanceData {
  themeMode: ThemeMode;
  activePresetId: string | null;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  contrast: number;
}

interface AppearanceState extends AppearanceData {
  setThemeMode: (mode: ThemeMode) => void;
  applyPreset: (presetId: string) => void;
  setAccentColor: (hex: string) => void;
  setBackgroundColor: (hex: string) => void;
  setForegroundColor: (hex: string) => void;
  setContrast: (value: number) => void;
  resetToDefault: () => void;
}

const DEFAULT_PRESET = THEME_PRESETS[0]; // default-dark

function getDefaults(): AppearanceData {
  return {
    themeMode: "dark",
    activePresetId: DEFAULT_PRESET.id,
    accentColor: DEFAULT_PRESET.accent,
    backgroundColor: DEFAULT_PRESET.background,
    foregroundColor: DEFAULT_PRESET.foreground,
    contrast: DEFAULT_PRESET.contrast,
  };
}

function loadFromStorage(): AppearanceData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaults();
    return { ...getDefaults(), ...JSON.parse(raw) };
  } catch {
    return getDefaults();
  }
}

function persist(data: AppearanceData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function applyTheme(data: AppearanceData) {
  const vars = deriveThemeVariables(
    data.accentColor,
    data.backgroundColor,
    data.foregroundColor,
    data.contrast,
  );
  applyThemeVariables(vars);
}

/** Call before React render to prevent flash of wrong theme. */
export function initializeTheme() {
  const data = loadFromStorage();
  applyTheme(data);
}

export const useAppearanceStore = create<AppearanceState>((set, get) => {
  const initial = loadFromStorage();

  // Apply on store creation (covers HMR)
  applyTheme(initial);

  function update(partial: Partial<AppearanceData>) {
    set(partial);
    const state = get();
    const data: AppearanceData = {
      themeMode: state.themeMode,
      activePresetId: state.activePresetId,
      accentColor: state.accentColor,
      backgroundColor: state.backgroundColor,
      foregroundColor: state.foregroundColor,
      contrast: state.contrast,
    };
    applyTheme(data);
    persist(data);
  }

  return {
    ...initial,

    setThemeMode: (mode) => update({ themeMode: mode }),

    applyPreset: (presetId) => {
      const preset = THEME_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      update({
        activePresetId: presetId,
        accentColor: preset.accent,
        backgroundColor: preset.background,
        foregroundColor: preset.foreground,
        contrast: preset.contrast,
      });
    },

    setAccentColor: (hex) => update({ accentColor: hex, activePresetId: null }),
    setBackgroundColor: (hex) => update({ backgroundColor: hex, activePresetId: null }),
    setForegroundColor: (hex) => update({ foregroundColor: hex, activePresetId: null }),
    setContrast: (value) => update({ contrast: value, activePresetId: null }),

    resetToDefault: () => {
      update({
        themeMode: "dark",
        activePresetId: DEFAULT_PRESET.id,
        accentColor: DEFAULT_PRESET.accent,
        backgroundColor: DEFAULT_PRESET.background,
        foregroundColor: DEFAULT_PRESET.foreground,
        contrast: DEFAULT_PRESET.contrast,
      });
    },
  };
});
