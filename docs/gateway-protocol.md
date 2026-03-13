# OpenClaw Gateway WebSocket Protocol

Protocol reference for connecting MaxAuto to the OpenClaw gateway.

## Protocol Version

Current: **3**

## Frame Types

All messages are JSON. Three frame types distinguished by `type` field:

### RequestFrame

```typescript
type RequestFrame = {
  type: "req";
  id: string; // unique request ID
  method: string; // method name
  params?: unknown; // method-specific parameters
};
```

### ResponseFrame

```typescript
type ResponseFrame = {
  type: "res";
  id: string; // matches request id
  ok: boolean; // success/failure
  payload?: unknown; // response data (when ok: true)
  error?: {
    // error details (when ok: false)
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  };
};
```

### EventFrame

```typescript
type EventFrame = {
  type: "event";
  event: string; // event name
  payload?: unknown;
  seq?: number; // sequence number
  stateVersion?: { presence: number; health: number };
};
```

## Connection Handshake

### ConnectParams (sent on WS open)

```typescript
{
  minProtocol: 3,
  maxProtocol: 3,
  client: {
    id: "openclaw-control-ui",   // or custom client ID
    displayName: "MaxAuto",
    version: "0.1.0",
    platform: "win32",           // or "darwin"
    mode: "ui"
  },
  auth: {
    token: "<gateway-auth-token>"
  }
}
```

### Valid client IDs

`openclaw-control-ui`, `webchat-ui`, `webchat`, `cli`, `gateway-client`,
`openclaw-macos`, `openclaw-ios`, `openclaw-android`, `node-host`, `test`

### Valid client modes

`webchat`, `cli`, `ui`, `backend`, `node`, `probe`, `test`

### HelloOk (server response)

```typescript
{
  type: "hello-ok",
  protocol: 3,
  server: { version: string, connId: string },
  features: { methods: string[], events: string[] },
  snapshot: Snapshot,
  auth: { deviceToken: string, role: string, scopes: string[] },
  policy: { maxPayload: number, maxBufferedBytes: number, tickIntervalMs: number }
}
```

## Core Methods

### Chat

| Method         | Params                                                             | Description      |
| -------------- | ------------------------------------------------------------------ | ---------------- |
| `chat.send`    | `{ sessionKey, message, idempotencyKey, thinking?, attachments? }` | Send message     |
| `chat.history` | `{ sessionKey, limit? }`                                           | Get history      |
| `chat.abort`   | `{ sessionKey, runId? }`                                           | Abort generation |

### Agents

| Method           | Params                                   | Returns                                 |
| ---------------- | ---------------------------------------- | --------------------------------------- |
| `agents.list`    | `{}`                                     | `{ defaultId, agents: AgentSummary[] }` |
| `agents.create`  | `{ name, workspace, emoji?, avatar? }`   | `{ agentId, name, workspace }`          |
| `agents.update`  | `{ agentId, name?, workspace?, model? }` | `{ agentId }`                           |
| `agents.delete`  | `{ agentId, deleteFiles? }`              | `{ agentId }`                           |
| `agent.identity` | `{ agentId? }`                           | `{ agentId, name, avatar, emoji }`      |

### Models

| Method        | Params | Returns                     |
| ------------- | ------ | --------------------------- |
| `models.list` | `{}`   | `{ models: ModelChoice[] }` |

Each ModelChoice: `{ id, name, provider, contextWindow?, reasoning? }`

### Configuration

| Method          | Params                                        | Description           |
| --------------- | --------------------------------------------- | --------------------- |
| `config.get`    | `{}`                                          | Get current config    |
| `config.set`    | `{ raw: string, baseHash? }`                  | Replace entire config |
| `config.patch`  | `{ raw: string, baseHash? }`                  | Merge changes         |
| `config.apply`  | `{ raw: string, baseHash?, restartDelayMs? }` | Apply + restart       |
| `config.schema` | `{}`                                          | Get full schema       |

### Sessions

| Method             | Params                           | Description     |
| ------------------ | -------------------------------- | --------------- |
| `sessions.list`    | `{ limit?, agentId?, search? }`  | List sessions   |
| `sessions.resolve` | `{ key?, sessionId?, agentId? }` | Resolve session |
| `sessions.reset`   | `{ key }`                        | Reset session   |
| `sessions.delete`  | `{ key }`                        | Delete session  |

### Skills

| Method           | Params                | Description       |
| ---------------- | --------------------- | ----------------- |
| `skills.status`  | `{ agentId? }`        | Get skills status |
| `skills.install` | `{ name, installId }` | Install a skill   |
| `skills.bins`    | `{}`                  | List skill bins   |

### Cron

| Method        | Params              | Description     |
| ------------- | ------------------- | --------------- |
| `cron.list`   | `{}`                | List cron jobs  |
| `cron.add`    | `{ schedule, ... }` | Add cron job    |
| `cron.remove` | `{ jobId }`         | Remove cron job |
| `cron.run`    | `{ jobId }`         | Run immediately |

### Channels

| Method            | Params           | Description        |
| ----------------- | ---------------- | ------------------ |
| `channels.status` | `{ channelId? }` | Get channel status |

## Events

| Event         | Payload                                               | Description          |
| ------------- | ----------------------------------------------------- | -------------------- |
| `tick`        | `{ ts }`                                              | Heartbeat/keep-alive |
| `shutdown`    | `{ reason, restartExpectedMs? }`                      | Server shutdown      |
| `chat-event`  | `{ runId, sessionKey, seq, state, message?, usage? }` | Chat stream          |
| `agent-event` | `{ runId, seq, stream, ts, data }`                    | Agent execution      |
| `presence`    | Presence changes                                      | Connection state     |
| `health`      | Health updates                                        | Gateway health       |

`chat-event.state` values: `"delta"`, `"final"`, `"aborted"`, `"error"`

## Configuration Types

### ModelsConfig

```typescript
type ModelsConfig = {
  mode?: "merge" | "replace";
  providers?: Record<string, ModelProviderConfig>;
};

type ModelProviderConfig = {
  baseUrl: string;
  apiKey?: string | SecretRef;
  api?: ModelApi;
  models: ModelDefinitionConfig[];
};

type ModelDefinitionConfig = {
  id: string;
  name: string;
  api?: ModelApi;
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
};

type ModelApi =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages"
  | "google-generative-ai"
  | "github-copilot"
  | "bedrock-converse-stream"
  | "ollama";
```

### GatewayConfig

```typescript
type GatewayConfig = {
  port?: number; // default: 18789
  bind?: "auto" | "lan" | "loopback" | "custom" | "tailnet";
  auth?: {
    mode?: "none" | "token" | "password" | "trusted-proxy";
    token?: string | SecretRef;
    password?: string | SecretRef;
  };
};
```

## Environment Variables

| Variable                | Default                     | Description      |
| ----------------------- | --------------------------- | ---------------- |
| `OPENCLAW_STATE_DIR`    | `~/.openclaw`               | State directory  |
| `OPENCLAW_CONFIG_PATH`  | `{state_dir}/openclaw.json` | Config file path |
| `OPENCLAW_GATEWAY_PORT` | `18789`                     | Gateway port     |

MaxAuto sets these to `~/.openclaw-maxauto` for isolation.

### Path resolution order

1. Check `OPENCLAW_CONFIG_PATH` env var
2. Check `OPENCLAW_STATE_DIR` env var -> `{dir}/openclaw.json`
3. Check `~/.openclaw/openclaw.json`
4. Legacy dirs: `.clawdbot`, `.moldbot`, `.moltbot`

## Error Codes

| Code              | Description                     |
| ----------------- | ------------------------------- |
| `NOT_LINKED`      | Client not authenticated        |
| `NOT_PAIRED`      | Device not paired               |
| `AGENT_TIMEOUT`   | Agent execution timed out       |
| `INVALID_REQUEST` | Request validation failed       |
| `UNAVAILABLE`     | Service temporarily unavailable |

## Implementation Notes

1. Open WS to `ws://localhost:18789/`
2. Send ConnectParams as first message
3. Receive HelloOk with negotiated protocol
4. All subsequent communication uses req/res/event frames
5. Respond to `tick` events to maintain connection
6. Use `baseHash` in config methods for optimistic locking
7. Config is JSON5 format (supports comments, trailing commas)
