#!/usr/bin/env node
import { program, CommanderError } from "commander";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runOneShot } from "./oneshot.js";
import { runChat } from "./chat.js";
import { VALID_MODES } from "./constants.js";
import { ChatRuntimeError, ChatUsageError } from "./chat-session.js";
import { buildSetupNonInteractiveMessage, runSetup, SetupUsageError, supportsInteractiveSetup } from "./setup.js";

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
  .option("--tokens", "Show input/output token counts")
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
  $ govuk-rewrite chat --provider openai
  $ govuk-rewrite setup

Environment variables:
  OPENAI_API_KEY           API key for OpenAI (default provider)
  ANTHROPIC_API_KEY        API key for Anthropic
  OPENROUTER_API_KEY       API key for OpenRouter
  GOVUK_REWRITE_PROVIDER   Default provider (openai | anthropic | openrouter)
  GOVUK_REWRITE_MODEL      Default model name
  GOVUK_REWRITE_TIMEOUT_MS Request timeout override in milliseconds`
  )
  .action(async (textArgs: string[], opts) => {
    await runOneShot(textArgs, opts, () => program.helpInformation());
  });

program
  .command("chat")
  .description("Start interactive rewrite mode")
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
  .option("--copy", "Auto-copy result to clipboard")
  .option("--tokens", "Show input/output token counts")
  .action(async (opts) => {
    try {
      await runChat(opts);
    } catch (err) {
      if (err instanceof ChatUsageError || err instanceof ChatRuntimeError) {
        process.stderr.write(`${err.message}\n`);
        process.exit(err.exitCode);
      }
      throw err;
    }
  });

program
  .command("setup")
  .description("Run first-time setup wizard")
  .option("--config <path>", "Path to config.json to write")
  .action(async (opts: { config?: string }) => {
    if (!supportsInteractiveSetup(Boolean(process.stdin.isTTY), Boolean(process.stdout.isTTY))) {
      process.stderr.write(buildSetupNonInteractiveMessage(opts.config) + "\n");
      process.exit(2);
    }

    try {
      await runSetup({ configPath: opts.config });
    } catch (err) {
      if (err instanceof SetupUsageError) {
        process.stderr.write(`${err.message}\n`);
        process.exit(err.exitCode);
      }
      throw err;
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
