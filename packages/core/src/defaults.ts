import type { Provider } from "./types.js";

export const DEFAULT_TIMEOUT_MS = 30000;

export const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-3-5-sonnet-latest",
  openrouter: "openai/gpt-4.1-mini",
};
