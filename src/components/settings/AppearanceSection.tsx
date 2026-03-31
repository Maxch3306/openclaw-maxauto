import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppearanceStore } from "@/stores/appearance-store";
import { THEME_PRESETS } from "@/lib/theme-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function PresetGrid() {
  const { t } = useTranslation();
  const activePresetId = useAppearanceStore((s) => s.activePresetId);
  const applyPreset = useAppearanceStore((s) => s.applyPreset);

  return (
    <div className="grid grid-cols-2 gap-2">
      {THEME_PRESETS.map((preset) => {
        const isActive = activePresetId === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset.id)}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
              isActive
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-muted-foreground/30 hover:bg-secondary"
            }`}
          >
            {/* Color swatches */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <div className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: preset.accent }} />
              <div className="flex gap-0.5">
                <div className="w-2.5 h-2.5 rounded-sm border border-border/50" style={{ backgroundColor: preset.background }} />
                <div className="w-2.5 h-2.5 rounded-sm border border-border/50" style={{ backgroundColor: preset.foreground }} />
              </div>
            </div>
            <span className="text-xs font-medium text-foreground">
              {t(preset.name)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="relative">
          <div
            className="w-8 h-8 rounded-full border border-border cursor-pointer"
            style={{ backgroundColor: value }}
          />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>
        <Input
          value={value.toUpperCase()}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-f]{6}$/i.test(v)) {
              onChange(v);
            }
          }}
          className="w-24 h-8 text-xs font-mono bg-background"
        />
      </div>
    </div>
  );
}

function ContrastSlider() {
  const { t } = useTranslation();
  const contrast = useAppearanceStore((s) => s.contrast);
  const setContrast = useAppearanceStore((s) => s.setContrast);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-foreground">{t("settings.appearance.contrast")}</span>
        <span className="text-xs text-muted-foreground font-mono w-8 text-right">{contrast}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={contrast}
        onChange={(e) => setContrast(Number(e.target.value))}
        className="w-full appearance-slider"
      />
      <p className="text-[10px] text-muted-foreground mt-1">
        {t("settings.appearance.contrastDesc")}
      </p>
    </div>
  );
}

export function AppearanceSection() {
  const { t } = useTranslation();
  const accentColor = useAppearanceStore((s) => s.accentColor);
  const backgroundColor = useAppearanceStore((s) => s.backgroundColor);
  const foregroundColor = useAppearanceStore((s) => s.foregroundColor);
  const setAccentColor = useAppearanceStore((s) => s.setAccentColor);
  const setBackgroundColor = useAppearanceStore((s) => s.setBackgroundColor);
  const setForegroundColor = useAppearanceStore((s) => s.setForegroundColor);
  const resetToDefault = useAppearanceStore((s) => s.resetToDefault);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-lg font-semibold text-foreground mb-6">
        {t("settings.appearance.title")}
      </h1>

      <div className="space-y-6">
        {/* Presets */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            {t("settings.appearance.presets")}
          </h2>
          <PresetGrid />
        </section>

        {/* Colors */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            {t("settings.appearance.colors")}
          </h2>
          <Card className="p-4 space-y-4">
            <ColorRow
              label={t("settings.appearance.accentColor")}
              value={accentColor}
              onChange={setAccentColor}
            />
            <ColorRow
              label={t("settings.appearance.backgroundColor")}
              value={backgroundColor}
              onChange={setBackgroundColor}
            />
            <ColorRow
              label={t("settings.appearance.foregroundColor")}
              value={foregroundColor}
              onChange={setForegroundColor}
            />
          </Card>
        </section>

        {/* Contrast */}
        <section>
          <ContrastSlider />
        </section>

        {/* Reset */}
        <section>
          <Button variant="outline" size="sm" onClick={resetToDefault}>
            <RotateCcw size={12} />
            {t("settings.appearance.resetToDefault")}
          </Button>
        </section>
      </div>
    </div>
  );
}
