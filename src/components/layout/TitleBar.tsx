import { useTranslation } from "react-i18next";

export function TitleBar() {
  const { t } = useTranslation();
  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-9 bg-card border-b border-border select-none px-3"
    >
      <span data-tauri-drag-region className="text-sm font-semibold text-muted-foreground">
        {t("app.title")}
      </span>
    </div>
  );
}
