import { DEFAULT_MODELS, DEFAULT_TIMEOUT_MS } from "./defaults.js";
import type { EngineOptions, NormalizedEngineOptions } from "./types.js";

export function normaliseEngineOptions(options: EngineOptions): NormalizedEngineOptions {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    throw new Error(`Missing apiKey for provider \"${options.provider}\"`);
  }

  const model = options.model?.trim() || DEFAULT_MODELS[options.provider];
  if (!model) {
    throw new Error(`Missing model for provider \"${options.provider}\"`);
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive number");
  }

  const baseUrl = options.baseUrl?.trim();

  return {
    provider: options.provider,
    apiKey,
    model,
    timeoutMs: Math.trunc(timeoutMs),
    baseUrl: baseUrl || undefined,
  };
}
