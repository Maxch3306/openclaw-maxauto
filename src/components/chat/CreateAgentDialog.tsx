import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "@/stores/chat-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateAgentDialogProps {
  onClose: () => void;
}

export function CreateAgentDialog({ onClose }: CreateAgentDialogProps) {
  const { t } = useTranslation();
  const createAgent = useChatStore((s) => s.createAgent);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t("agent.create.nameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createAgent({
        name: name.trim(),
        emoji: emoji.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[400px]">
        <DialogHeader>
          <DialogTitle>{t("agent.create.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1 text-muted-foreground">{t("agent.create.name")}</Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("agent.create.namePlaceholder")}
              autoFocus
            />
          </div>

          <div>
            <Label className="mb-1 text-muted-foreground">{t("agent.create.emoji")}</Label>
            <Input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder={t("agent.create.emojiPlaceholder")}
              maxLength={4}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? t("agent.create.creating") : t("agent.create.title")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
