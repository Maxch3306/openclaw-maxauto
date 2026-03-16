import { Download, RefreshCw, X } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { useUpdateStore } from "@/stores/update-store";
import { Button } from "@/components/ui/button";

export function UpdateBanner() {
  const { t } = useTranslation();
  const status = useUpdateStore((s) => s.status);
  const availableVersion = useUpdateStore((s) => s.availableVersion);
  const downloadProgress = useUpdateStore((s) => s.downloadProgress);
  const error = useUpdateStore((s) => s.error);
  const dismissed = useUpdateStore((s) => s.dismissed);
  const downloadAndInstall = useUpdateStore((s) => s.downloadAndInstall);
  const checkForUpdate = useUpdateStore((s) => s.checkForUpdate);
  const dismiss = useUpdateStore((s) => s.dismiss);

  if (dismissed || status === "idle" || status === "checking" || status === "up-to-date") {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm border-b border-border bg-primary/10">
      {status === "available" && (
        <>
          <Download size={14} className="text-primary shrink-0" />
          <span className="text-foreground">
            <Trans i18nKey="update.available" values={{ version: availableVersion }} components={{ strong: <strong /> }} />
          </span>
          <Button
            onClick={() => void downloadAndInstall()}
            size="xs"
            className="ml-auto"
          >
            {t("update.button")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={dismiss}
            className="h-7 w-7"
          >
            <X size={14} />
          </Button>
        </>
      )}

      {status === "downloading" && (
        <>
          <RefreshCw size={14} className="text-primary shrink-0 animate-spin" />
          <span className="text-foreground">{t("update.downloading", { progress: downloadProgress })}</span>
          <div className="flex-1 h-1.5 rounded-full bg-card overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        </>
      )}

      {status === "installing" && (
        <>
          <RefreshCw size={14} className="text-primary shrink-0 animate-spin" />
          <span className="text-foreground">{t("update.installing")}</span>
        </>
      )}

      {status === "error" && (
        <>
          <span className="text-destructive text-xs">{t("update.failed", { error })}</span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => void checkForUpdate()}
            className="ml-auto"
          >
            {t("common.retry")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={dismiss}
            className="h-7 w-7"
          >
            <X size={14} />
          </Button>
        </>
      )}
    </div>
  );
}
