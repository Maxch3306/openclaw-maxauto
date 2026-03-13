import { ExternalLink, Mail } from "lucide-react";

const VERSION = __APP_VERSION__;

export function AboutSection() {
  return (
    <div className="max-w-xl mx-auto py-12 px-6 space-y-8">
      {/* App name + version */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">MaxAuto</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Version {VERSION}</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          A vendor-free, open-source desktop wrapper for OpenClaw.
        </p>
      </div>

      <hr className="border-[var(--color-border)]" />

      {/* Creator */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Creator</h2>
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <span>Max Cheung</span>
          <span className="text-[var(--color-border)]">|</span>
          <a
            href="mailto:max@maxckm.com"
            className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
          >
            <Mail size={13} />
            max@maxckm.com
          </a>
        </div>
      </div>

      <hr className="border-[var(--color-border)]" />

      {/* Sponsors */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Sponsored by</h2>
        <div className="space-y-2">
          <a
            href="https://www.bsoltec.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[var(--color-accent)] hover:underline"
          >
            Brilliant Solution Limited
            <ExternalLink size={13} />
          </a>
          <a
            href="https://bkrose.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[var(--color-accent)] hover:underline"
          >
            BlackROSE Limited
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
