import * as openai from "./providers/openai.js";
import * as anthropic from "./providers/anthropic.js";
import * as openrouter from "./providers/openrouter.js";
import type {
  EngineOptions,
  Provider,
  ProviderAdapter,
  RewriteRequest,
  RewriteResult,
} from "./types.js";
import { normaliseEngineOptions } from "./validation.js";

function selectAdapter(provider: Provider): ProviderAdapter {
  switch (provider) {
    case "openai":
      return openai.rewrite;
    case "anthropic":
      return anthropic.rewrite;
    case "openrouter":
      return openrouter.rewrite;
  }
}

export async function rewrite(
  request: RewriteRequest,
  options: EngineOptions
): Promise<RewriteResult> {
  const normalized = normaliseEngineOptions(options);
  const adapter = selectAdapter(normalized.provider);

  return adapter(
    {
      apiKey: normalized.apiKey,
      model: normalized.model,
      timeoutMs: normalized.timeoutMs,
      baseUrl: normalized.baseUrl,
    },
    request
  );
}

export function createClient(options: EngineOptions): {
  rewrite: (request: RewriteRequest) => Promise<RewriteResult>;
} {
  return {
    rewrite: async (request: RewriteRequest) => rewrite(request, options),
  };
}
