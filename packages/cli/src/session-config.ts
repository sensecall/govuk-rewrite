import { resolveConfig } from "./config.js";
import type { CliOverrides, ResolvedConfig } from "./config.js";
import * as setup from "./setup.js";

export async function resolveConfigWithAutoSetup(
  overrides: CliOverrides,
  setupRunner: typeof setup.maybeRunInteractiveSetupOnMissingKey = setup.maybeRunInteractiveSetupOnMissingKey,
  configResolver: typeof resolveConfig = resolveConfig,
  options?: {
    prompt?: (question: string) => Promise<string>;
    writeLine?: (line: string) => void;
  }
): Promise<ResolvedConfig> {
  let config = configResolver(overrides);

  if (!config.apiKey) {
    const autoSetup = await setupRunner({
      provider: config.provider,
      configPath: overrides.config,
      prompt: options?.prompt,
      writeLine: options?.writeLine,
    });
    if (autoSetup.ran) {
      config = configResolver(overrides);
    }
  }

  return config;
}
