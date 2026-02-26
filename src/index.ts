#!/usr/bin/env node
import { program, CommanderError } from "commander";
import ora from "ora";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveConfig } from "./config.js";
import { readStdin, isStdinPiped, formatOutput, writeClipboard } from "./io.js";
import type { ContentMode, ProviderOptions } from "./types.js";
import * as openai from "./providers/openai.js";
import * as anthropic from "./providers/anthropic.js";
import * as openrouter from "./providers/openrouter.js";

const VALID_MODES: ContentMode[] = [
  "page-body",
  "error-message",
  "hint-text",
  "notification",
  "button",
];

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

program.configureOutput({ outputError: () => {} });

program.exitOverride((err: CommanderError) => {
  if (err.code === "commander.helpDisplayed" || err.code === "commander.version") {
    process.exit(0);
  }
  // Strip the leading "error: " that commander adds so we can normalise capitalisation
  const msg = err.message.replace(/^error:\s*/i, "");
  if (err.code === "commander.unknownOption") {
    process.stderr.write(
      `Error: ${msg}\n\nRun 'govuk-rewrite --help' for a list of valid options.\n`
    );
  } else {
    process.stderr.write(
      `Error: ${msg}\n\nRun 'govuk-rewrite --help' for usage information.\n`
    );
  }
  process.exit(2);
});

program
  .name("govuk-rewrite")
  .description("Rewrite text into GOV.UK-style content")
  .version(getVersion(), "-v, --version")
  .argument("[text...]", "Text to rewrite (or pipe via stdin)")
  .option("--explain", "Include a short explanation of changes")
  .option("--diff", "Show a line diff between original and rewritten text")
  .option("--check", "Audit text for GOV.UK style issues without rewriting")
  .option("--json", "Output JSON")
  .option("--context <text>", "Service or audience context to inform the rewrite")
  .option(
    "--mode <type>",
    `Content type: ${VALID_MODES.join(" | ")} (default: page-body)`
  )
  .option("--provider <name>", "Provider: openai | anthropic | openrouter")
  .option("--model <name>", "Model name for the chosen provider")
  .option("--config <path>", "Path to a config.json file")
  .option("--timeout <ms>", "Request timeout in milliseconds", parseInt)
  .option("--no-spinner", "Disable spinner")
  .option("--no-copy", "Do not auto-copy result to clipboard")
  .addHelpText(
    "after",
    `
Examples:
  $ govuk-rewrite "Please be advised that the service will be unavailable"
  $ echo "Click here to find out more" | govuk-rewrite
  $ govuk-rewrite --explain "Please note that you must submit your form by Friday"
  $ govuk-rewrite --mode error-message "Sorry, something went wrong. Please try again."
  $ govuk-rewrite --check "Thank you for your kind submission"
  $ govuk-rewrite --diff --context "HMRC self-assessment" "Please ensure you complete the form"
  $ govuk-rewrite --provider anthropic "Your application has been received"

Environment variables:
  OPENAI_API_KEY           API key for OpenAI (default provider)
  ANTHROPIC_API_KEY        API key for Anthropic
  OPENROUTER_API_KEY       API key for OpenRouter
  GOVUK_REWRITE_PROVIDER   Default provider (openai | anthropic | openrouter)
  GOVUK_REWRITE_MODEL      Default model name
  GOVUK_REWRITE_TIMEOUT_MS Request timeout override in milliseconds`
  )
  .action(
    async (
      textArgs: string[],
      opts: {
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
    ) => {
      let inputText = "";

      if (isStdinPiped()) {
        inputText = await readStdin();
      } else if (textArgs.length > 0) {
        inputText = textArgs.join(" ");
      }

      if (!inputText) {
        process.stderr.write(program.helpInformation());
        process.exit(2);
      }

      if (opts.mode && !VALID_MODES.includes(opts.mode as ContentMode)) {
        process.stderr.write(
          `Error: invalid --mode "${opts.mode}". Valid values: ${VALID_MODES.join(", ")}\n`
        );
        process.exit(2);
      }

      const config = resolveConfig({
        provider: opts.provider,
        model: opts.model,
        timeout: opts.timeout,
        config: opts.config,
      });

      if (!config.apiKey) {
        const KEY_INFO: Record<string, { envVar: string; link: string }> = {
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
        const info = KEY_INFO[config.provider];
        const envVar = info?.envVar ?? "YOUR_API_KEY";
        const lines: string[] = [
          `Error: no API key found for provider "${config.provider}".`,
          "",
          `Set the ${envVar} environment variable:`,
          `  export ${envVar}=your-key-here`,
          "",
        ];
        if (info?.link) {
          lines.push(`Get a key at: ${info.link}`, "");
        }
        lines.push(
          `Using a different provider? Pass --provider openai | anthropic | openrouter`,
          ""
        );
        process.stderr.write(lines.join("\n"));
        process.exit(1);
      }

      const providerOptions: ProviderOptions = {
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
      };

      const useSpinner = opts.spinner && process.stdout.isTTY === true;
      const spinner = useSpinner ? ora("Rewriting…").start() : null;

      try {
        let result;
        const request = {
          text: inputText,
          explain: opts.explain ?? false,
          check: opts.check ?? false,
          context: opts.context,
          mode: (opts.mode as ContentMode | undefined) ?? "page-body",
        };

        switch (config.provider) {
          case "openai":
            result = await openai.rewrite(providerOptions, request);
            break;
          case "anthropic":
            result = await anthropic.rewrite(providerOptions, request);
            break;
          case "openrouter":
            result = await openrouter.rewrite(providerOptions, request);
            break;
          default:
            throw new Error(`Unknown provider: ${config.provider as string}`);
        }

        spinner?.stop();

        let format: "plain" | "explain" | "json" | "diff" | "check";
        if (opts.json) {
          format = "json";
        } else if (opts.check) {
          format = "check";
        } else if (opts.diff) {
          format = "diff";
        } else if (opts.explain) {
          format = "explain";
        } else {
          format = "plain";
        }

        const output = formatOutput({
          result,
          format,
          provider: config.provider,
          model: config.model,
          originalText: inputText,
        });

        process.stdout.write(output + "\n");

        // Auto-copy rewritten text to clipboard when running interactively
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
  );

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
