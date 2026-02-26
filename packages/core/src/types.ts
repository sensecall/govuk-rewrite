export type Provider = "openai" | "anthropic" | "openrouter";

export type ContentMode =
  | "page-body"
  | "error-message"
  | "hint-text"
  | "notification"
  | "button"
  | "heading"
  | "form-label";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface RewriteResult {
  rewrittenText: string;
  explanation?: string[];
  issues?: string[];
  usage?: TokenUsage;
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
