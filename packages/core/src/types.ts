export type Provider = "openai" | "anthropic" | "openrouter";

export type ContentMode =
  | "page-body"
  | "error-message"
  | "hint-text"
  | "notification"
  | "button";

export interface RewriteResult {
  rewrittenText: string;
  explanation?: string[];
  issues?: string[];
}

export interface EngineOptions {
  provider: Provider;
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  baseUrl?: string;
}

export interface ProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  baseUrl?: string;
}

export interface RewriteRequest {
  text: string;
  explain: boolean;
  check?: boolean;
  context?: string;
  mode?: ContentMode;
}

export type ProviderAdapter = (
  options: ProviderOptions,
  request: RewriteRequest
) => Promise<RewriteResult>;

export interface NormalizedEngineOptions extends ProviderOptions {
  provider: Provider;
}
