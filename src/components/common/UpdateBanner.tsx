import { Download, RefreshCw, X } from "lucide-react";
import { useUpdateStore } from "../../stores/update-store";

export function UpdateBanner() {
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
    <div className="flex items-center gap-3 px-4 py-2 text-sm border-b border-[var(--color-border)] bg-[var(--color-accent)]/10">
      {status === "available" && (
        <>
          <Download size={14} className="text-[var(--color-accent)] shrink-0" />
          <span className="text-[var(--color-text)]">
            Update <strong>v{availableVersion}</strong> available
          </span>
          <button
            onClick={() => void downloadAndInstall()}
            className="ml-auto px-3 py-1 rounded-md text-xs font-medium bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
          >
            Update
          </button>
          <button
            onClick={dismiss}
            className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <X size={14} />
          </button>
        </>
      )}

      {status === "downloading" && (
        <>
          <RefreshCw size={14} className="text-[var(--color-accent)] shrink-0 animate-spin" />
          <span className="text-[var(--color-text)]">Downloading update... {downloadProgress}%</span>
          <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        </>
      )}

      {status === "installing" && (
        <>
          <RefreshCw size={14} className="text-[var(--color-accent)] shrink-0 animate-spin" />
          <span className="text-[var(--color-text)]">Installing update... Restarting soon.</span>
        </>
      )}

      {status === "error" && (
        <>
          <span className="text-[var(--color-error)] text-xs">Update failed: {error}</span>
          <button
            onClick={() => void checkForUpdate()}
            className="ml-auto px-3 py-1 rounded-md text-xs font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            Retry
          </button>
          <button
            onClick={dismiss}
            className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  );
}
