import { create } from "zustand";
import { gateway } from "../api/gateway-client";
import { readConfig } from "../api/tauri-commands";
import { patchConfig, waitForReconnect } from "../api/config-helpers";

export type SettingsSection =
  | "general"
  | "usage"
  | "credits"
  | "models"
  | "mcp"
  | "skills"
  | "im-channels"
  | "workspace"
  | "privacy"
  | "feedback"
  | "about";

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
}

export interface CustomModel {
  id: string;
  displayName: string;
  provider: string;
  apiKey?: string;
  apiProtocol: string;
  baseUrl: string;
  contextWindow?: number;
  maxTokens?: number;
  input?: string[];
  reasoning?: boolean;
}

/**
 * Static defaults for known OpenClaw built-in providers.
 * Source: OpenClaw src/agents/models-config.providers.static.ts
 *
 * When configuring a built-in provider via openclaw.json, the full provider
 * config (baseUrl, api, models) must be written — OpenClaw's implicit loaders
 * only activate via environment variables, not JSON config apiKey entries.
 */

interface ProviderModelDef {
  id: string;
  name: string;
  reasoning: boolean;
  input: string[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
  compat?: Record<string, unknown>;
}

interface ProviderDefaults {
  baseUrl: string;
  api: string;
  models: ProviderModelDef[];
  /** Extra provider-level config fields (e.g. authHeader) written to openclaw.json */
  extraConfig?: Record<string, unknown>;
}

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export const PROVIDER_DEFAULTS: Record<string, ProviderDefaults> = {
  "maxauto-crs-openai": {
    baseUrl: "https://claude-proxy.bsoltest.com/openai",
    api: "openai-responses",
    models: [
      { id: "gpt-5.4", name: "GPT-5.4", reasoning: true, input: ["text","image"], cost: ZERO_COST, contextWindow: 1050000, maxTokens: 272000 },
    ],
  },
  "kimi-coding": {
    baseUrl: "https://api.kimi.com/coding/",
    api: "anthropic-messages",
    models: [
      {
        id: "k2p5",
        name: "Kimi for Coding",
        reasoning: true,
        input: ["text", "image"],
        cost: ZERO_COST,
        contextWindow: 262144,
        maxTokens: 32768,
      },
    ],
  },
  moonshot: {
    baseUrl: "https://api.moonshot.ai/v1",
    api: "openai-completions",
    models: [
      { id: "kimi-k2.5", name: "Kimi K2.5", reasoning: false, input: ["text", "image"], cost: ZERO_COST, contextWindow: 256000, maxTokens: 8192 },
    ],
  },
  minimax: {
    baseUrl: "https://api.minimax.io/anthropic",
    api: "anthropic-messages",
    extraConfig: { authHeader: true },
    models: [
      { id: "MiniMax-M2.5", name: "MiniMax M2.5", reasoning: true, input: ["text"], cost: { input: 0.3, output: 1.2, cacheRead: 0.03, cacheWrite: 0.12 }, contextWindow: 200000, maxTokens: 8192 },
      { id: "MiniMax-M2.5-highspeed", name: "MiniMax M2.5 Highspeed", reasoning: true, input: ["text"], cost: { input: 0.3, output: 1.2, cacheRead: 0.03, cacheWrite: 0.12 }, contextWindow: 200000, maxTokens: 8192 },
    ],
  },
  "minimax-cn": {
    baseUrl: "https://api.minimaxi.com/anthropic",
    api: "anthropic-messages",
    extraConfig: { authHeader: true },
    models: [
      { id: "MiniMax-M2.5", name: "MiniMax M2.5", reasoning: true, input: ["text"], cost: { input: 0.3, output: 1.2, cacheRead: 0.03, cacheWrite: 0.12 }, contextWindow: 200000, maxTokens: 8192 },
      { id: "MiniMax-M2.5-highspeed", name: "MiniMax M2.5 Highspeed", reasoning: true, input: ["text"], cost: { input: 0.3, output: 1.2, cacheRead: 0.03, cacheWrite: 0.12 }, contextWindow: 200000, maxTokens: 8192 },
    ],
  },
  "maxauto-aliyun-cn": {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    api: "openai-completions",
    models: [
      { id: "qwen3.5-plus", name: "qwen3.5-plus", reasoning: false, input: ["text", "image"], cost: ZERO_COST, contextWindow: 1000000, maxTokens: 65536 },
      { id: "qwen3-coder-next", name: "qwen3-coder-next", reasoning: false, input: ["text"], cost: ZERO_COST, contextWindow: 262144, maxTokens: 65536 }    ],
  },
  "maxauto-glm-coding-plan": {
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    api: "openai-completions",
    models: [
      { id: "glm-5", name: "GLM-5", reasoning: true, input: ["text"], cost: ZERO_COST, contextWindow: 204800, maxTokens: 131072 },
      { id: "glm-4.7", name: "GLM-4.7", reasoning: true, input: ["text"], cost: ZERO_COST, contextWindow: 204800, maxTokens: 131072 },
      { id: "glm-4.6v", name: "GLM-4.6V", reasoning: false, input: ["text", "image"], cost: ZERO_COST, contextWindow: 128000, maxTokens: 32768 },
    ],
  }
};

/**
 * Quick-setup preset: Bailian Coding (阿里云百炼 Coding endpoint).
 * Includes multi-vendor models accessible through a single API key.
 */
export const BAILIAN_CODING_PROVIDER_KEY = "bailian-coding-maxauto";

export const BAILIAN_CODING_PRESET = {
  baseUrl: "https://coding.dashscope.aliyuncs.com/v1",
  api: "openai-completions",
  models: [
    {
      id: "qwen3.5-plus",
      name: "qwen3.5-plus",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 1000000,
      maxTokens: 65536,
      compat: { thinkingFormat: "qwen" },
    },
    {
      id: "MiniMax-M2.5",
      name: "MiniMax-M2.5",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 196608,
      maxTokens: 32768,
    },
    {
      id: "glm-5",
      name: "glm-5",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 202752,
      maxTokens: 16384,
      compat: { thinkingFormat: "qwen" },
    },
    {
      id: "kimi-k2.5",
      name: "kimi-k2.5",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 262144,
      maxTokens: 32768,
      compat: { thinkingFormat: "qwen" },
    },
  ],
} as const;

export const BAILIAN_CODING_AGENTS_DEFAULTS = {
  model: { primary: `${BAILIAN_CODING_PROVIDER_KEY}/qwen3.5-plus` },
  models: {
    [`${BAILIAN_CODING_PROVIDER_KEY}/qwen3.5-plus`]: {},
    [`${BAILIAN_CODING_PROVIDER_KEY}/MiniMax-M2.5`]: {},
    [`${BAILIAN_CODING_PROVIDER_KEY}/glm-5`]: {},
    [`${BAILIAN_CODING_PROVIDER_KEY}/kimi-k2.5`]: {},
  },
} as const;

/** Map UI protocol label to OpenClaw `api` value */
function mapProtocolToApi(protocol: string): string {
  switch (protocol) {
    case "Anthropic":
      return "anthropic-messages";
    case "OpenAI":
    default:
      return "openai-completions";
  }
}

/** Derive a config-safe provider key from label (e.g. "ZhipuAI" → "zhipuai") */
function providerKey(provider: string): string {
  return provider
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Build the OpenClaw `models.providers` patch object from a list of CustomModels.
 * Each unique provider becomes a key; models with the same provider are grouped.
 */
const REDACTED_SENTINEL = "__OPENCLAW_REDACTED__";

function buildProvidersPatch(models: CustomModel[], existingProviders?: Record<string, unknown>): Record<string, unknown> {
  const grouped: Record<string, CustomModel[]> = {};
  for (const m of models) {
    const key = providerKey(m.provider);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(m);
  }

  const providers: Record<string, unknown> = {};
  for (const [key, group] of Object.entries(grouped)) {
    const first = group[0];
    const hasRealKey = first.apiKey && first.apiKey !== REDACTED_SENTINEL;
    // If key is redacted or missing, try to preserve the existing key from the raw config
    let apiKey: string | undefined;
    if (hasRealKey) {
      apiKey = first.apiKey;
    } else if (existingProviders) {
      const existing = existingProviders[key] as { apiKey?: string } | undefined;
      if (existing?.apiKey && existing.apiKey !== REDACTED_SENTINEL) {
        apiKey = existing.apiKey;
      }
    }
    providers[key] = {
      baseUrl: first.baseUrl,
      ...(apiKey ? { apiKey } : {}),
      api: mapProtocolToApi(first.apiProtocol),
      models: group.map((m) => ({
        id: m.id,
        name: m.displayName,
        reasoning: m.reasoning ?? false,
        input: m.input ?? ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: m.contextWindow ?? 128000,
        maxTokens: m.maxTokens ?? 8192,
      })),
    };
  }
  return providers;
}

/**
 * Build agents.defaults.models entries from custom models list.
 * Each model gets an entry like `"providerKey/modelId": {}`.
 */
function buildAgentsDefaultsModels(customModels: CustomModel[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const m of customModels) {
    const key = providerKey(m.provider);
    result[`${key}/${m.id}`] = {};
  }
  return result;
}

interface ProviderConfig {
  baseUrl: string;
  apiKey?: string;
  api?: string;
  models?: Array<{
    id: string;
    name: string;
    contextWindow?: number;
    maxTokens?: number;
    input?: string[];
    reasoning?: boolean;
    cost?: { input: number; output: number; cacheRead: number; cacheWrite: number };
    compat?: Record<string, unknown>;
  }>;
}

/** Parse only custom (non-built-in) providers from config into CustomModel[] */
function parseCustomProvidersOnly(
  providers: Record<string, ProviderConfig> | undefined,
): CustomModel[] {
  if (!providers) {
    return [];
  }
  const result: CustomModel[] = [];
  for (const [key, provCfg] of Object.entries(providers)) {
    // Skip built-in providers — they're managed by setProviderAuth/removeProvider
    if (key in PROVIDER_DEFAULTS) {
      continue;
    }
    const protocol = provCfg.api === "anthropic-messages" ? "Anthropic" : "OpenAI";
    for (const m of provCfg.models ?? []) {
      result.push({
        id: m.id,
        displayName: m.name ?? m.id,
        provider: key,
        apiKey: typeof provCfg.apiKey === "string" ? provCfg.apiKey : undefined,
        apiProtocol: protocol,
        baseUrl: provCfg.baseUrl,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
        input: m.input,
        reasoning: m.reasoning,
      });
    }
  }
  return result;
}

/**
 * Parse resolved model definitions for built-in providers from config.get.
 * Returns a map of providerKey → ProviderModelDef[] for providers that exist
 * in both PROVIDER_DEFAULTS and the config's models.providers section.
 */
function parseBuiltInProviderModels(
  providers: Record<string, ProviderConfig> | undefined,
): BuiltInProviderModels {
  const result: BuiltInProviderModels = new Map();
  if (!providers) {
    return result;
  }
  for (const [key, provCfg] of Object.entries(providers)) {
    if (!(key in PROVIDER_DEFAULTS)) {
      continue;
    }
    const models: ProviderModelDef[] = (provCfg.models ?? []).map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      reasoning: m.reasoning ?? false,
      input: m.input ?? ["text"],
      cost: m.cost ?? ZERO_COST,
      contextWindow: m.contextWindow ?? 128000,
      maxTokens: m.maxTokens ?? 8192,
      compat: m.compat,
    }));
    if (models.length > 0) {
      result.set(key, models);
    }
  }
  return result;
}

async function readConfigFile(): Promise<Record<string, unknown>> {
  const { raw } = await readConfig();
  return JSON.parse(raw);
}

/** Resolved model definitions for built-in providers, keyed by provider key */
export type BuiltInProviderModels = Map<string, ProviderModelDef[]>;

interface SettingsState {
  activeSection: SettingsSection;
  models: ModelInfo[];
  customModels: CustomModel[];
  configuredProviders: Set<string>;
  /** Actual model definitions resolved from config.get for built-in providers */
  builtInProviderModels: BuiltInProviderModels;
  defaultModelId: string | null;
  configBaseHash: string | null;
  showAddModelDialog: boolean;
  editingModel: CustomModel | null;
  editingProviderGroup: CustomModel[] | null;
  showQuickConfig: boolean;

  setActiveSection: (section: SettingsSection) => void;
  setShowAddModelDialog: (v: boolean, editModel?: CustomModel | null, providerGroup?: CustomModel[] | null) => void;
  setShowQuickConfig: (v: boolean) => void;
  setDefaultModelId: (id: string | null) => void;

  loadModels: () => Promise<void>;
  loadConfig: () => Promise<void>;
  addCustomModel: (model: CustomModel) => Promise<void>;
  updateCustomModel: (oldId: string, model: CustomModel) => Promise<void>;
  removeCustomModel: (modelId: string) => Promise<void>;
  setProviderAuth: (providerKey: string, apiKey: string, baseUrl?: string) => Promise<void>;
  removeProvider: (providerKey: string) => Promise<void>;
  addQuickProvider: (apiKey: string, baseUrl?: string) => Promise<void>;
  removeQuickProvider: () => Promise<void>;
  replaceProviderModels: (providerName: string, oldModelIds: string[], newModels: CustomModel[]) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  activeSection: "models",
  models: [],
  customModels: [],
  configuredProviders: new Set<string>(),
  builtInProviderModels: new Map(),
  defaultModelId: null,
  configBaseHash: null,
  showAddModelDialog: false,
  editingModel: null,
  editingProviderGroup: null,
  showQuickConfig: false,

  setActiveSection: (section) => set({ activeSection: section }),
  setShowAddModelDialog: (v, editModel, providerGroup) =>
    set({ showAddModelDialog: v, editingModel: editModel ?? null, editingProviderGroup: providerGroup ?? null }),
  setShowQuickConfig: (v) => set({ showQuickConfig: v }),
  setDefaultModelId: (id) => set({ defaultModelId: id }),

  loadModels: async () => {
    try {
      const result = await gateway.request<{ models: ModelInfo[] }>("models.list", {});
      set({ models: result.models });
    } catch {
      // Gateway might not be ready
    }
  },

  loadConfig: async () => {
    try {
      // Try gateway first (has hash + runtime state)
      const result = await gateway.request<{
        config: Record<string, unknown>;
        hash: string;
      }>("config.get", {});
      set({ configBaseHash: result.hash });

      const cfg = result.config as {
        models?: {
          providers?: Record<string, ProviderConfig>;
        };
        agents?: {
          defaults?: { model?: string };
        };
      };
      const customModels = parseCustomProvidersOnly(cfg.models?.providers);
      const configuredProviders = new Set(Object.keys(cfg.models?.providers ?? {}));
      const defaultModelId = cfg.agents?.defaults?.model ?? null;

      // Parse resolved model definitions for built-in providers from config.get
      const builtInProviderModels = parseBuiltInProviderModels(cfg.models?.providers);

      set({ customModels, configuredProviders, defaultModelId, builtInProviderModels });
    } catch {
      // Gateway not ready — fall back to reading file directly
      try {
        const config = await readConfigFile();
        const cfg = config as {
          models?: { providers?: Record<string, ProviderConfig> };
          agents?: { defaults?: { model?: string } };
        };
        const customModels = parseCustomProvidersOnly(cfg.models?.providers);
        const configuredProviders = new Set(Object.keys(cfg.models?.providers ?? {}));
        const defaultModelId = cfg.agents?.defaults?.model ?? null;
        const builtInProviderModels = parseBuiltInProviderModels(
          cfg.models?.providers as Record<string, ProviderConfig> | undefined,
        );
        set({ customModels, configuredProviders, defaultModelId, builtInProviderModels });
      } catch {
        // Config file not available either
      }
    }
  },

  addCustomModel: async (model) => {
    const config = await readConfigFile();
    const cfg = config as {
      models?: { providers?: Record<string, unknown> };
      agents?: { defaults?: Record<string, unknown> };
    };

    const currentCustomModels = parseCustomProvidersOnly(
      cfg.models?.providers as Record<string, ProviderConfig> | undefined,
    );
    const updated = [...currentCustomModels, model];
    const customProviders = buildProvidersPatch(updated, cfg.models?.providers as Record<string, unknown> | undefined);

    // Build model entries for agents.defaults.models
    const customDefaultModels = buildAgentsDefaultsModels(updated);

    await patchConfig({
      models: { providers: customProviders },
      agents: { defaults: { models: customDefaultModels } },
    });
    await waitForReconnect();
    await get().loadConfig();
    await get().loadModels();
  },

  updateCustomModel: async (oldId, model) => {
    const config = await readConfigFile();
    const cfg = config as {
      models?: { providers?: Record<string, unknown> };
      agents?: { defaults?: Record<string, unknown> };
    };

    const currentCustomModels = parseCustomProvidersOnly(
      cfg.models?.providers as Record<string, ProviderConfig> | undefined,
    );
    const updated = currentCustomModels.map((m) => (m.id === oldId ? model : m));
    const customProviders = buildProvidersPatch(updated, cfg.models?.providers as Record<string, unknown> | undefined);

    // Null-out old custom model entries, then add updated ones
    const oldCustomDefaultKeys = Object.keys(buildAgentsDefaultsModels(currentCustomModels));
    const modelsPatch: Record<string, unknown> = {};
    for (const k of oldCustomDefaultKeys) {
      modelsPatch[k] = null; // delete old entries via merge-patch
    }
    const customDefaultModels = buildAgentsDefaultsModels(updated);
    Object.assign(modelsPatch, customDefaultModels);

    await patchConfig({
      models: { providers: customProviders },
      agents: { defaults: { models: modelsPatch } },
    });
    await waitForReconnect();
    await get().loadConfig();
    await get().loadModels();
  },

  removeCustomModel: async (modelId) => {
    // Need to read current config to know provider structure for the model being removed
    const configResult = await gateway.request<{
      config: Record<string, unknown>;
      hash: string;
    }>("config.get", {});
    const cfg = configResult.config as {
      models?: { providers?: Record<string, unknown> };
      agents?: { defaults?: Record<string, unknown> };
    };

    const currentCustomModels = parseCustomProvidersOnly(
      cfg.models?.providers as Record<string, ProviderConfig> | undefined,
    );
    const removedModel = currentCustomModels.find((m) => m.id === modelId);
    const updated = currentCustomModels.filter((m) => m.id !== modelId);

    // Build the patch for providers
    const providersPatch: Record<string, unknown> = {};
    if (removedModel) {
      const key = providerKey(removedModel.provider);
      // Check if this provider has other models remaining
      const remainingForProvider = updated.filter((m) => providerKey(m.provider) === key);
      if (remainingForProvider.length === 0) {
        // No models left for this provider -- delete it
        providersPatch[key] = null;
      } else {
        // Rebuild provider with remaining models
        const providerPatch = buildProvidersPatch(remainingForProvider, cfg.models?.providers as Record<string, unknown> | undefined);
        Object.assign(providersPatch, providerPatch);
      }
    }

    // Build the patch for agents.defaults.models
    const modelsPatch: Record<string, unknown> = {};
    // Null-out old custom model entries
    const oldCustomDefaultKeys = Object.keys(buildAgentsDefaultsModels(currentCustomModels));
    for (const k of oldCustomDefaultKeys) {
      modelsPatch[k] = null;
    }
    // Add back remaining entries
    const customDefaultModels = buildAgentsDefaultsModels(updated);
    Object.assign(modelsPatch, customDefaultModels);

    // Clear default model if it belonged to the removed model
    const defaultsPatch: Record<string, unknown> = { models: modelsPatch };
    if (removedModel) {
      const removedKey = `${providerKey(removedModel.provider)}/${removedModel.id}`;
      const currentDefault = (cfg.agents?.defaults as Record<string, unknown> | undefined)?.model;
      if (typeof currentDefault === "string" && currentDefault === removedKey) {
        defaultsPatch.model = null;
      }
    }

    await patchConfig({
      models: { providers: providersPatch },
      agents: { defaults: defaultsPatch },
    });
    await waitForReconnect();
    await get().loadConfig();
    await get().loadModels();
  },

  replaceProviderModels: async (providerName, oldModelIds, newModels) => {
    const config = await readConfigFile();
    const cfg = config as {
      models?: { providers?: Record<string, unknown> };
      agents?: { defaults?: Record<string, unknown> };
    };

    const currentCustomModels = parseCustomProvidersOnly(
      cfg.models?.providers as Record<string, ProviderConfig> | undefined,
    );
    // Remove all old models for this provider, then add the new set
    const oldIdSet = new Set(oldModelIds);
    const filtered = currentCustomModels.filter((m) => !(m.provider === providerName && oldIdSet.has(m.id)));
    const updated = [...filtered, ...newModels];
    const customProviders = buildProvidersPatch(updated, cfg.models?.providers as Record<string, unknown> | undefined);

    // Null-out old custom model entries, add updated ones
    const oldCustomDefaultKeys = Object.keys(buildAgentsDefaultsModels(currentCustomModels));
    const modelsPatch: Record<string, unknown> = {};
    for (const k of oldCustomDefaultKeys) {
      modelsPatch[k] = null;
    }
    const customDefaultModels = buildAgentsDefaultsModels(updated);
    Object.assign(modelsPatch, customDefaultModels);

    await patchConfig({
      models: { providers: customProviders },
      agents: { defaults: { models: modelsPatch } },
    });
    await waitForReconnect();
    await get().loadConfig();
    await get().loadModels();
  },

  setProviderAuth: async (key, apiKey, baseUrl) => {
    const defaults = PROVIDER_DEFAULTS[key];
    if (!defaults) {
      throw new Error(`Unknown provider "${key}". Use Custom Model to configure manually.`);
    }

    // Write full provider config (baseUrl, api, models) to openclaw.json.
    const providerEntry: Record<string, unknown> = {
      baseUrl: baseUrl?.trim() || defaults.baseUrl,
      api: defaults.api,
      apiKey,
      ...defaults.extraConfig,
    };

    // Collect model IDs for agents.defaults.models
    let modelIds: string[] = [];

    if (defaults.models.length > 0) {
      providerEntry.models = defaults.models;
      modelIds = defaults.models.map((m) => m.id);
    } else {
      // Fall back to models from gateway's models.list for this provider
      const { models: allModels } = get();
      const providerModels = allModels
        .filter((m) => m.provider === key)
        .map((m) => ({
          id: m.id,
          name: m.name,
          reasoning: m.reasoning ?? false,
          input: ["text"] as string[],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: m.contextWindow ?? 128000,
          maxTokens: 8192,
        }));
      if (providerModels.length > 0) {
        providerEntry.models = providerModels;
        modelIds = providerModels.map((m) => m.id);
      }
    }

    const modelEntries: Record<string, unknown> = {};
    for (const modelId of modelIds) {
      modelEntries[`${key}/${modelId}`] = {};
    }

    await patchConfig({
      models: { providers: { [key]: providerEntry } },
      agents: { defaults: { models: modelEntries } },
    });
    await waitForReconnect();
    await get().loadConfig();
    await get().loadModels();
  },

  removeProvider: async (key) => {
    // Read current config to find model keys that need removal
    const configResult = await gateway.request<{
      config: Record<string, unknown>;
      hash: string;
    }>("config.get", {});
    const cfg = configResult.config as {
      models?: { providers?: Record<string, unknown> };
      agents?: { defaults?: { model?: unknown; models?: Record<string, unknown> } };
    };

    // Null-out the provider key (merge-patch delete)
    const providersPatch: Record<string, unknown> = { [key]: null };

    // Null-out model entries belonging to this provider
    const existingDefaultModels = cfg.agents?.defaults?.models ?? {};
    const modelsPatch: Record<string, unknown> = {};
    for (const modelKey of Object.keys(existingDefaultModels)) {
      if (modelKey.startsWith(`${key}/`)) {
        modelsPatch[modelKey] = null;
      }
    }

    // Clear default model if it belongs to the removed provider
    const defaultsPatch: Record<string, unknown> = { models: modelsPatch };
    const currentDefault = cfg.agents?.defaults?.model;
    if (typeof currentDefault === "string" && currentDefault.startsWith(`${key}/`)) {
      defaultsPatch.model = null;
    }

    await patchConfig({
      models: { providers: providersPatch },
      agents: { defaults: defaultsPatch },
    });
    await waitForReconnect();
    await get().loadConfig();
    await get().loadModels();
  },

  addQuickProvider: async (apiKey, baseUrl) => {
    const providerEntry = {
      ...BAILIAN_CODING_PRESET,
      ...(baseUrl ? { baseUrl } : {}),
      apiKey,
    };

    await patchConfig({
      models: { providers: { [BAILIAN_CODING_PROVIDER_KEY]: providerEntry } },
      agents: {
        defaults: {
          model: BAILIAN_CODING_AGENTS_DEFAULTS.model,
          models: { ...BAILIAN_CODING_AGENTS_DEFAULTS.models },
        },
      },
    });
    await waitForReconnect();
    await get().loadConfig();
    await get().loadModels();
  },

  removeQuickProvider: async () => {
    // Read config to find which model keys to null-out
    const configResult = await gateway.request<{
      config: Record<string, unknown>;
      hash: string;
    }>("config.get", {});
    const cfg = configResult.config as {
      agents?: { defaults?: { model?: unknown; models?: Record<string, unknown> } };
    };

    // Null-out the provider key
    const prefix = `${BAILIAN_CODING_PROVIDER_KEY}/`;

    // Null-out model entries belonging to this provider
    const existingModelsMap = cfg.agents?.defaults?.models ?? {};
    const modelsPatch: Record<string, unknown> = {};
    for (const key of Object.keys(existingModelsMap)) {
      if (key.startsWith(prefix)) {
        modelsPatch[key] = null;
      }
    }

    // Clear default model if it belongs to this provider
    const defaultsPatch: Record<string, unknown> = { models: modelsPatch };
    const primaryModel = cfg.agents?.defaults?.model;
    if (typeof primaryModel === "object" && primaryModel !== null) {
      const pm = primaryModel as { primary?: string };
      if (pm.primary?.startsWith(prefix)) {
        defaultsPatch.model = null;
      }
    } else if (typeof primaryModel === "string" && primaryModel.startsWith(prefix)) {
      defaultsPatch.model = null;
    }

    await patchConfig({
      models: { providers: { [BAILIAN_CODING_PROVIDER_KEY]: null } },
      agents: { defaults: defaultsPatch },
    });
    await waitForReconnect();
    await get().loadConfig();
    await get().loadModels();
  },
}));
