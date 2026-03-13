export interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

export interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  };
}

export interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: { presence: number; health: number };
}

type Frame = RequestFrame | ResponseFrame | EventFrame;
type EventHandler = (payload: unknown) => void;
type PendingRequest = {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class GatewayClient {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pending = new Map<string, PendingRequest>();
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;
  private _url = "";
  private _token = "";
  private _intentionalClose = false;
  private onStatusChange: ((connected: boolean) => void) | null = null;

  // Debug log buffer
  debugLog: string[] = [];
  private onDebugUpdate: (() => void) | null = null;

  private log(msg: string) {
    const ts = new Date().toLocaleTimeString();
    const entry = `[${ts}] ${msg}`;
    console.log("[gateway]", msg);
    this.debugLog.push(entry);
    if (this.debugLog.length > 200) {
      this.debugLog.shift();
    }
    this.onDebugUpdate?.();
  }

  setDebugCallback(cb: () => void) {
    this.onDebugUpdate = cb;
  }

  get connected() {
    return this._connected;
  }

  get wsState(): string {
    if (!this.ws) {
      return "NO_SOCKET";
    }
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return "CONNECTING";
      case WebSocket.OPEN:
        return "OPEN";
      case WebSocket.CLOSING:
        return "CLOSING";
      case WebSocket.CLOSED:
        return "CLOSED";
      default:
        return `UNKNOWN(${String(this.ws.readyState)})`;
    }
  }

  get url() {
    return this._url;
  }

  setStatusCallback(cb: (connected: boolean) => void) {
    this.onStatusChange = cb;
  }

  connect(port = 18789, token = "") {
    const url = `ws://127.0.0.1:${port}/`;
    // Skip if already connected/connecting to same endpoint
    if (
      this._url === url &&
      this._token === token &&
      this.ws &&
      this.ws.readyState <= WebSocket.OPEN
    ) {
      this.log("connect() skipped — already connected/connecting to same endpoint");
      return;
    }
    this._url = url;
    this._token = token;
    this.doConnect();
  }

  disconnect() {
    this._intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnected(false);
  }

  reconnect() {
    this.disconnect();
    if (this._url) {
      this.doConnect();
    }
  }

  async request<T = unknown>(method: string, params?: unknown, timeoutMs = 30000): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected to gateway");
    }

    const id = String(++this.requestId);
    const frame: RequestFrame = { type: "req", id, method, params };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: resolve as (payload: unknown) => void,
        reject,
        timer,
      });

      const payload = JSON.stringify(frame);
      this.log(`SEND: ${payload.slice(0, 300)}`);
      this.ws!.send(payload);
    });
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  private doConnect() {
    this._intentionalClose = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
    }

    this.log(`Connecting to ${this._url}`);
    const ws = new WebSocket(this._url);
    this.ws = ws;
    let handshakeDone = false;

    ws.addEventListener("open", () => {
      this.log("WebSocket opened, waiting for challenge...");
    });

    ws.addEventListener("message", (ev) => {
      try {
        const raw = typeof ev.data === "string" ? ev.data : String(ev.data);
        this.log(`RECV: ${raw.slice(0, 300)}`);
        const frame = JSON.parse(raw) as Frame | { type: string; [k: string]: unknown };

        // Phase 1: Server sends connect.challenge event with nonce
        if (
          !handshakeDone &&
          frame.type === "event" &&
          (frame as EventFrame).event === "connect.challenge"
        ) {
          this.log("Got challenge, sending connect request...");
          const connectFrame = {
            type: "req",
            id: "connect-0",
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "openclaw-control-ui",
                displayName: "MaxAuto",
                version: "0.1.0",
                platform: navigator.platform.includes("Win") ? "win32" : "darwin",
                mode: "ui",
              },
              role: "operator",
              scopes: ["operator.admin", "operator.read", "operator.write", "operator.approvals", "operator.pairing"],
              auth: this._token ? { token: this._token } : {},
            },
          };
          const sent = JSON.stringify(connectFrame);
          this.log(`SEND: ${sent.slice(0, 300)}`);
          ws.send(sent);
          return;
        }

        // Phase 2: Server responds to our connect request
        if (!handshakeDone && frame.type === "res" && (frame as ResponseFrame).id === "connect-0") {
          const res = frame as ResponseFrame;
          if (res.ok) {
            handshakeDone = true;
            this.log("Connected successfully (hello-ok)");
            this.setConnected(true);
          } else {
            this.log(`Connect FAILED: ${res.error?.code} - ${res.error?.message}`);
            ws.close();
          }
          return;
        }

        // Normal message handling after handshake
        if (frame.type === "res") {
          this.handleResponse(frame as ResponseFrame);
        } else if (frame.type === "event") {
          this.handleEvent(frame as EventFrame);
        }
      } catch (err) {
        this.log(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    ws.addEventListener("close", (ev) => {
      this.log(`WebSocket closed: code=${ev.code} reason="${ev.reason}"`);
      this.setConnected(false);
      this.rejectAllPending("Connection closed");
      if (!this._intentionalClose) {
        this.scheduleReconnect();
      }
    });

    ws.addEventListener("error", () => {
      this.log("WebSocket error");
    });
  }

  private handleResponse(frame: ResponseFrame) {
    const req = this.pending.get(frame.id);
    if (!req) {
      return;
    }

    this.pending.delete(frame.id);
    clearTimeout(req.timer);

    if (frame.ok) {
      req.resolve(frame.payload);
    } else {
      req.reject(new Error(frame.error?.message ?? "Unknown error"));
    }
  }

  private handleEvent(frame: EventFrame) {
    // Log chat-event and agent-event details for debugging
    if (frame.event === "chat" || frame.event === "agent") {
      const p = frame.payload as Record<string, unknown> | undefined;
      this.log(
        `EVENT ${frame.event}: state=${String(p?.state)} runId=${String(p?.runId)} seq=${frame.seq}`,
      );
    }
    const handlers = this.eventHandlers.get(frame.event);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(frame.payload);
        } catch {
          // ignore handler errors
        }
      }
    }
  }

  private setConnected(v: boolean) {
    if (this._connected !== v) {
      this._connected = v;
      this.onStatusChange?.(v);
    }
  }

  private rejectAllPending(reason: string) {
    for (const [, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new Error(reason));
    }
    this.pending.clear();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, 3000);
  }
}

// Singleton
export const gateway = new GatewayClient();
