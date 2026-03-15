import { ExternalLink, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

const VERSION = __APP_VERSION__;

export function AboutSection() {
  const { t } = useTranslation();

  return (
    <div className="max-w-xl mx-auto py-12 px-6 space-y-8">
      {/* App name + version */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t("settings.about.title")}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{t("settings.about.version", { version: VERSION })}</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {t("settings.about.description")}
        </p>
      </div>

      <hr className="border-[var(--color-border)]" />

      {/* Creator */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{t("settings.about.creator")}</h2>
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
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{t("settings.about.sponsoredBy")}</h2>
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
