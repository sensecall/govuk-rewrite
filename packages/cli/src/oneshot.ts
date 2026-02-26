import ora from "ora";
import { rewrite } from "govuk-rewrite-core";
import type { ContentMode } from "govuk-rewrite-core";
import { resolveConfig } from "./config.js";
import type { CliOverrides, ResolvedConfig } from "./config.js";
import { writeMissingApiKeyError } from "./errors.js";
import { isStdinPiped, readStdin, shouldUseSpinner, writeClipboard } from "./io.js";
import { formatOutput, selectOutputMode } from "./output.js";
import { VALID_MODES, VALID_PROVIDERS } from "./constants.js";
import * as setup from "./setup.js";
import { resolveConfigWithAutoSetup } from "./session-config.js";

export interface OneShotOptions {
  explain?: boolean;
  diff?: boolean;
  check?: boolean;
  json?: boolean;
  context?: string;
  mode?: string;
  provider?: string;
  model?: string;
  config?: string;
  timeout?: number;
  spinner: boolean;
  copy: boolean;
}

export function resolveInputText(
  textArgs: string[],
  stdinText: string,
  stdinPiped: boolean
): string {
  if (stdinPiped) return stdinText;
  if (textArgs.length > 0) return textArgs.join(" ");
  return "";
}

export async function resolveConfigForOneShot(
  overrides: CliOverrides,
  setupRunner: typeof setup.maybeRunInteractiveSetupOnMissingKey = setup.maybeRunInteractiveSetupOnMissingKey,
  configResolver: typeof resolveConfig = resolveConfig
): Promise<ResolvedConfig> {
  return resolveConfigWithAutoSetup(overrides, setupRunner, configResolver);
}

export async function runOneShot(
  textArgs: string[],
  opts: OneShotOptions,
  helpInformation: () => string
): Promise<void> {
  const stdinPiped = isStdinPiped();
  const stdinText = stdinPiped ? await readStdin() : "";
  const inputText = resolveInputText(textArgs, stdinText, stdinPiped);

  if (!inputText) {
    process.stderr.write(helpInformation());
    process.exit(2);
  }

  if (opts.mode && !VALID_MODES.includes(opts.mode as ContentMode)) {
    process.stderr.write(
      `Error: invalid --mode \"${opts.mode}\". Valid values: ${VALID_MODES.join(", ")}\n`
    );
    process.exit(2);
  }

  if (opts.provider && !VALID_PROVIDERS.includes(opts.provider as (typeof VALID_PROVIDERS)[number])) {
    process.stderr.write(
      `Error: invalid --provider \"${opts.provider}\". Valid values: ${VALID_PROVIDERS.join(", ")}\n`
    );
    process.exit(2);
  }

  const config = await resolveConfigForOneShot({
    provider: opts.provider,
    model: opts.model,
    timeout: opts.timeout,
    config: opts.config,
  });

  if (!config.apiKey) {
    writeMissingApiKeyError(config.provider);
    process.exit(1);
  }

  const spinner = shouldUseSpinner(opts.spinner) ? ora("Rewriting…").start() : null;

  try {
    const result = await rewrite(
      {
        text: inputText,
        explain: opts.explain ?? false,
        check: opts.check ?? false,
        context: opts.context,
        mode: (opts.mode as ContentMode | undefined) ?? "page-body",
      },
      {
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
      }
    );

    spinner?.stop();

    const mode = selectOutputMode(opts);
    const output = formatOutput({
      result,
      mode,
      provider: config.provider,
      model: config.model,
      originalText: inputText,
      checkMode: opts.check ?? false,
    });

    process.stdout.write(output + "\n");

    if (process.stdout.isTTY && opts.copy && !opts.check) {
      const copied = writeClipboard(result.rewrittenText);
      if (copied) {
        process.stderr.write("(copied to clipboard)\n");
      }
    }
  } catch (err) {
    spinner?.fail();
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }
}
