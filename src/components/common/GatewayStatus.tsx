import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { gateway } from "@/api/gateway-client";
import { useAppStore } from "@/stores/app-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function GatewayStatus() {
  const { t } = useTranslation();
  const connected = useAppStore((s) => s.gatewayConnected);
  const prevConnectedRef = useRef(connected);
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [wsState, setWsState] = useState(gateway.wsState);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    setLogs([...gateway.debugLog]);
    setWsState(gateway.wsState);
  }, []);

  useEffect(() => {
    if (prevConnectedRef.current !== connected) {
      prevConnectedRef.current = connected;
      setWsState(gateway.wsState);
    }
  }, [connected]);

  useEffect(() => {
    if (!open) {
      gateway.setDebugCallback(() => {});
      return;
    }
    refresh();
    gateway.setDebugCallback(refresh);
    return () => gateway.setDebugCallback(() => {});
  }, [open, refresh]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, open]);

  return (
    <>
      <div className="px-3 py-1">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-success" : "bg-destructive"
            }`}
          />
          <Badge variant={connected ? "success" : "destructive"} className="text-[10px] px-1.5 py-0">
            {connected ? t("common.connected") : t("common.disconnected")}
          </Badge>
          <span className="text-xs text-muted-foreground opacity-50 ml-1">
            WS: {wsState}
          </span>
          <Button
            variant="link"
            size="xs"
            onClick={() => setOpen(true)}
            className="ml-auto p-0 h-auto"
          >
            {t("common.debug")}
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl h-[500px] flex flex-col gap-0 p-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-border">
            <DialogTitle className="text-sm font-mono">
              {t("common.debug")} — URL: {gateway.url || "(none)"} | WS: {wsState} | Connected: {String(connected)}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 px-4 py-2">
            <div className="font-mono text-[11px] leading-relaxed space-y-0.5">
              {logs.length === 0 ? (
                <span className="text-muted-foreground">No messages yet...</span>
              ) : (
                logs.map((line, i) => {
                  const isError = line.includes("ERROR") || line.includes("error") || line.includes("FAILED");
                  const isEvent = line.includes("EVENT chat") || line.includes("EVENT agent");
                  return (
                    <div
                      key={i}
                      className={
                        isError
                          ? "text-destructive"
                          : isEvent
                            ? "text-cyan-400"
                            : "text-green-400"
                      }
                    >
                      {line}
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
