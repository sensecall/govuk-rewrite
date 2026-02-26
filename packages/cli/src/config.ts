import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_MODELS, DEFAULT_TIMEOUT_MS } from "govuk-rewrite-core";
import type { Provider } from "govuk-rewrite-core";

export interface ResolvedConfig {
  provider: Provider;
  model: string;
  timeoutMs: number;
  baseUrl?: string;
  apiKey?: string;
}

interface PartialConfig {
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

function configFilePath(): string {
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

function loadConfigFile(customPath?: string): PartialConfig {
  const filePath = customPath ?? configFilePath();
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as PartialConfig;
    const result: PartialConfig = {};
    const provider = toProvider(parsed.provider);
    if (provider) result.provider = provider;
    if (parsed.model) result.model = parsed.model;
    if (typeof parsed.timeoutMs === "number") result.timeoutMs = parsed.timeoutMs;
    if (parsed.baseUrl) result.baseUrl = parsed.baseUrl;
    return result;
  } catch {
    return {};
  }
}

function loadEnvVars(): PartialConfig {
  const result: PartialConfig = {};
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

  const fileConfig = loadConfigFile(cliOverrides.config);
  const envConfig = loadEnvVars();

  const merged: ResolvedConfig = {
    ...defaults,
    ...fileConfig,
    ...envConfig,
  };

  const cliProvider = toProvider(cliOverrides.provider);
  if (cliProvider) merged.provider = cliProvider;
  if (cliOverrides.model) merged.model = cliOverrides.model;
  if (cliOverrides.timeout) merged.timeoutMs = cliOverrides.timeout;

  const modelExplicitlySet =
    fileConfig.model ?? envConfig.model ?? cliOverrides.model;
  if (!modelExplicitlySet) {
    merged.model = DEFAULT_MODELS[merged.provider];
  }

  merged.apiKey = resolveApiKeyForProvider(merged.provider);

  return merged;
}

export function resolveApiKeyForProvider(provider: Provider): string | undefined {
  const keyMap: Record<Provider, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
  };
  return process.env[keyMap[provider]];
}
