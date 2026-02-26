import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_MODELS, DEFAULT_TIMEOUT_MS } from "govuk-rewrite-core";
import type { Provider } from "govuk-rewrite-core";

export interface ResolvedConfig {
  provider: Provider;
  model: string;
  timeoutMs: number;
  baseUrl?: string;
  apiKey?: string;
}

export interface ConfigFileData {
  provider?: Provider;
  model?: string;
  timeoutMs?: number;
  baseUrl?: string;
}

export interface CliOverrides {
  provider?: string;
  model?: string;
  timeout?: number;
  config?: string;
}

export const PROVIDER_API_KEY_ENV_VARS: Record<Provider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

export function getApiKeyEnvVarForProvider(provider: Provider): string {
  return PROVIDER_API_KEY_ENV_VARS[provider];
}

export function getDefaultConfigFilePath(): string {
  if (process.platform === "win32") {
    return join(process.env["APPDATA"] ?? homedir(), "govuk-rewrite", "config.json");
  }
  return join(homedir(), ".config", "govuk-rewrite", "config.json");
}

function toProvider(value?: string): Provider | undefined {
  if (value === "openai" || value === "anthropic" || value === "openrouter") {
    return value;
  }
  return undefined;
}

function sanitiseConfigFileData(input: ConfigFileData): ConfigFileData {
  const result: ConfigFileData = {};

  const provider = toProvider(input.provider);
  if (provider) result.provider = provider;

  if (typeof input.model === "string" && input.model.trim()) {
    result.model = input.model.trim();
  }

  if (typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs)) {
    result.timeoutMs = Math.trunc(input.timeoutMs);
  }

  if (typeof input.baseUrl === "string" && input.baseUrl.trim()) {
    result.baseUrl = input.baseUrl.trim();
  }

  return result;
}

export function readConfigFile(customPath?: string): ConfigFileData {
  const filePath = customPath ?? getDefaultConfigFilePath();
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as ConfigFileData;
    return sanitiseConfigFileData(parsed);
  } catch {
    return {};
  }
}

export function writeConfigFile(config: ConfigFileData, customPath?: string): void {
  const filePath = customPath ?? getDefaultConfigFilePath();
  const sanitized = sanitiseConfigFileData(config);

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
}

function loadEnvVars(): ConfigFileData {
  const result: ConfigFileData = {};

  const provider = toProvider(process.env["GOVUK_REWRITE_PROVIDER"]);
  if (provider) result.provider = provider;

  const model = process.env["GOVUK_REWRITE_MODEL"];
  if (model) result.model = model;

  const timeoutRaw = process.env["GOVUK_REWRITE_TIMEOUT_MS"];
  if (timeoutRaw) {
    const parsed = parseInt(timeoutRaw, 10);
    if (!isNaN(parsed)) result.timeoutMs = parsed;
  }

  const baseUrl = process.env["GOVUK_REWRITE_BASE_URL"];
  if (baseUrl) result.baseUrl = baseUrl;

  return result;
}

export function resolveConfig(cliOverrides: CliOverrides = {}): ResolvedConfig {
  const defaults: ResolvedConfig = {
    provider: "openai",
    model: DEFAULT_MODELS.openai,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  const fileConfig = readConfigFile(cliOverrides.config);
  const envConfig = loadEnvVars();

  const merged: ResolvedConfig = {
    ...defaults,
    ...fileConfig,
    ...envConfig,
  };

  const cliProvider = toProvider(cliOverrides.provider);
  if (cliProvider) merged.provider = cliProvider;
  if (cliOverrides.model) merged.model = cliOverrides.model;
  if (cliOverrides.timeout != null) merged.timeoutMs = cliOverrides.timeout;

  const modelExplicitlySet = fileConfig.model ?? envConfig.model ?? cliOverrides.model;
  if (!modelExplicitlySet) {
    merged.model = DEFAULT_MODELS[merged.provider];
  }

  merged.apiKey = resolveApiKeyForProvider(merged.provider);

  return merged;
}

export function resolveApiKeyForProvider(provider: Provider): string | undefined {
  return process.env[getApiKeyEnvVarForProvider(provider)];
}
