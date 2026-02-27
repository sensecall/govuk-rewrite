import type { ContentMode, Provider } from "@sensecall/govuk-rewrite";

export const VALID_MODES: ContentMode[] = [
  "page-body",
  "error-message",
  "hint-text",
  "notification",
  "button",
  "heading",
  "form-label",
];

export const VALID_PROVIDERS: Provider[] = ["openai", "anthropic", "openrouter"];
