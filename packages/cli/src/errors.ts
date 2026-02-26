import type { Provider } from "govuk-rewrite-core";

const KEY_INFO: Record<Provider, { envVar: string; link: string }> = {
  openai: {
    envVar: "OPENAI_API_KEY",
    link: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    envVar: "ANTHROPIC_API_KEY",
    link: "https://console.anthropic.com/settings/keys",
  },
  openrouter: {
    envVar: "OPENROUTER_API_KEY",
    link: "https://openrouter.ai/keys",
  },
};

export function writeMissingApiKeyError(provider: Provider): void {
  const info = KEY_INFO[provider];
  const lines: string[] = [
    `Error: no API key found for provider \"${provider}\".`,
    "",
    `Set the ${info.envVar} environment variable:`,
    `  export ${info.envVar}=your-key-here`,
    "",
    `Get a key at: ${info.link}`,
    "",
    "Using a different provider? Pass --provider openai | anthropic | openrouter",
    "",
  ];
  process.stderr.write(lines.join("\n"));
}
