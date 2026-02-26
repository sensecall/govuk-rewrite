import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Config, Provider } from "./types.js";

const DEFAULTS: Config = {
  provider: "openai",
  model: "gpt-4.1-mini",
  timeoutMs: 30000,
};

const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-3-5-sonnet-latest",
  openrouter: "openai/gpt-4.1-mini",
};

function configFilePath(): string {
  if (process.platform === "win32") {
    return join(process.env["APPDATA"] ?? homedir(), "govuk-rewrite", "config.json");
  }
  return join(homedir(), ".config", "govuk-rewrite", "config.json");
}

function loadConfigFile(customPath?: string): Partial<Config> {
  const filePath = customPath ?? configFilePath();
  try {
    const raw = readFileSync(filePath, "utf8");
    return JSON.parse(raw) as Partial<Config>;
  } catch {
    return {};
  }
}

function loadEnvVars(): Partial<Config> {
  const result: Partial<Config> = {};

  const provider = process.env["GOVUK_REWRITE_PROVIDER"];
  if (provider) result.provider = provider as Provider;

  const model = process.env["GOVUK_REWRITE_MODEL"];
  if (model) result.model = model;

  const timeoutMs = process.env["GOVUK_REWRITE_TIMEOUT_MS"];
  if (timeoutMs) {
    const parsed = parseInt(timeoutMs, 10);
    if (!isNaN(parsed)) result.timeoutMs = parsed;
  }

  const baseUrl = process.env["GOVUK_REWRITE_BASE_URL"];
  if (baseUrl) result.baseUrl = baseUrl;

  return result;
}

export interface CliOverrides {
  provider?: string;
  model?: string;
  timeout?: number;
  config?: string;
}

export function resolveConfig(cliOverrides: CliOverrides = {}): Config {
  const fileConfig = loadConfigFile(cliOverrides.config);
  const envConfig = loadEnvVars();

  const merged: Config = {
    ...DEFAULTS,
    ...fileConfig,
    ...envConfig,
  };

  if (cliOverrides.provider) merged.provider = cliOverrides.provider as Provider;
  if (cliOverrides.model) merged.model = cliOverrides.model;
  if (cliOverrides.timeout) merged.timeoutMs = cliOverrides.timeout;

  // If model was not explicitly set at any level, use provider-appropriate default
  const modelExplicitlySet =
    fileConfig.model ??
    envConfig.model ??
    cliOverrides.model;
  if (!modelExplicitlySet) {
    merged.model = DEFAULT_MODELS[merged.provider] ?? DEFAULTS.model;
  }

  merged.apiKey = resolveApiKey(merged.provider);

  return merged;
}

function resolveApiKey(provider: Provider): string | undefined {
  const keyMap: Record<Provider, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
  };
  return process.env[keyMap[provider]];
}
