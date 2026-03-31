import { create } from "zustand";
import {
  THEME_PRESETS,
  deriveThemeVariables,
  applyThemeVariables,
} from "@/lib/theme-utils";

const STORAGE_KEY = "maxauto-appearance";

interface AppearanceData {
  activePresetId: string | null;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  contrast: number;
}

interface AppearanceState extends AppearanceData {
  applyPreset: (presetId: string) => void;
  setAccentColor: (hex: string) => void;
  setBackgroundColor: (hex: string) => void;
  setForegroundColor: (hex: string) => void;
  setContrast: (value: number) => void;
  resetToDefault: () => void;
}

const DEFAULT_PRESET = THEME_PRESETS[1]; // default-light

function getDefaults(): AppearanceData {
  return {
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
    const parsed = JSON.parse(raw) as Partial<AppearanceData> & { themeMode?: unknown };
    const { themeMode: _themeMode, ...rest } = parsed;
    return { ...getDefaults(), ...rest };
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

  applyTheme(initial);

  function update(partial: Partial<AppearanceData>) {
    set(partial);
    const state = get();
    const data: AppearanceData = {
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
        activePresetId: DEFAULT_PRESET.id,
        accentColor: DEFAULT_PRESET.accent,
        backgroundColor: DEFAULT_PRESET.background,
        foregroundColor: DEFAULT_PRESET.foreground,
        contrast: DEFAULT_PRESET.contrast,
      });
    },
  };
});
