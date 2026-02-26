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

export interface Config {
  provider: Provider;
  model: string;
  timeoutMs: number;
  baseUrl?: string;
  apiKey?: string;
}

export interface ProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs: number;
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

export interface OutputOptions {
  result: RewriteResult;
  format: "plain" | "explain" | "json" | "diff" | "check";
  provider: Provider;
  model: string;
  originalText?: string;
}
