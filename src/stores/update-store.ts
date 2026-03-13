import { create } from "zustand";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installing"
  | "error"
  | "up-to-date";

interface UpdateState {
  status: UpdateStatus;
  availableVersion: string | null;
  releaseNotes: string | null;
  downloadProgress: number;
  error: string | null;
  dismissed: boolean;

  checkForUpdate: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  dismiss: () => void;
}

// Non-serializable Update object stored outside Zustand
let pendingUpdate: Update | null = null;

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: "idle",
  availableVersion: null,
  releaseNotes: null,
  downloadProgress: 0,
  error: null,
  dismissed: false,

  checkForUpdate: async () => {
    if (get().status === "checking" || get().status === "downloading") return;
    set({ status: "checking", error: null, dismissed: false });
    try {
      const update = await check();
      if (update) {
        pendingUpdate = update;
        set({
          status: "available",
          availableVersion: update.version,
          releaseNotes: update.body ?? null,
        });
      } else {
        pendingUpdate = null;
        set({ status: "up-to-date", availableVersion: null, releaseNotes: null });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // "fallback platforms" error means no release exists for this OS yet — not a real error
      if (msg.includes("fallback platforms") || msg.includes("were found in the response")) {
        set({ status: "up-to-date", availableVersion: null, releaseNotes: null });
      } else {
        set({ status: "error", error: msg });
      }
    }
  },

  downloadAndInstall: async () => {
    if (!pendingUpdate) return;
    set({ status: "downloading", downloadProgress: 0, error: null });
    try {
      let downloaded = 0;
      let total = 0;
      await pendingUpdate.downloadAndInstall((progress) => {
        if (progress.event === "Started" && progress.data.contentLength) {
          total = progress.data.contentLength;
        } else if (progress.event === "Progress" && total > 0) {
          downloaded += progress.data.chunkLength;
          set({ downloadProgress: Math.round((downloaded / total) * 100) });
        }
      });
      set({ status: "installing" });
      await relaunch();
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  dismiss: () => set({ dismissed: true }),
}));
