import { createInterface } from "node:readline";
import ora from "ora";
import { rewrite } from "govuk-rewrite-core";
import type { ContentMode } from "govuk-rewrite-core";
import { resolveApiKeyForProvider, resolveConfig } from "./config.js";
import { VALID_MODES, VALID_PROVIDERS } from "./constants.js";
import { writeMissingApiKeyError } from "./errors.js";
import { applyChatCommand } from "./chat-commands.js";
import type { ChatState } from "./chat-commands.js";
import { shouldUseSpinner, writeClipboard } from "./io.js";
import { formatOutput, selectOutputMode } from "./output.js";

export interface ChatOptions {
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
  copy?: boolean;
}

export function supportsInteractiveSession(
  stdinIsTTY: boolean,
  stdoutIsTTY: boolean
): boolean {
  return stdinIsTTY && stdoutIsTTY;
}

export async function processChatInput(
  line: string,
  state: ChatState,
  rewriteImpl: typeof rewrite = rewrite
): Promise<{
  state: ChatState;
  quit: boolean;
  output?: string;
  rewrittenText?: string;
  messages: string[];
}> {
  const trimmed = line.trim();

  if (!trimmed) {
    return { state, quit: false, messages: [] };
  }

  if (trimmed.startsWith("/")) {
    const command = applyChatCommand(trimmed, state);
    return {
      state: command.state,
      quit: command.quit,
      messages: command.messages,
    };
  }

  const result = await rewriteImpl(
    {
      text: trimmed,
      explain: state.explain,
      check: state.check,
      context: state.context,
      mode: state.mode,
    },
    {
      provider: state.provider,
      apiKey: resolveApiKeyForProvider(state.provider) ?? "",
      model: state.model,
      timeoutMs: state.timeoutMs,
      baseUrl: state.baseUrl,
    }
  );

  const mode = selectOutputMode(state);
  const output = formatOutput({
    result,
    mode,
    provider: state.provider,
    model: state.model,
    originalText: trimmed,
  });

  return {
    state,
    quit: false,
    output,
    rewrittenText: result.rewrittenText,
    messages: [],
  };
}

export async function runChat(opts: ChatOptions): Promise<void> {
  if (!supportsInteractiveSession(Boolean(process.stdin.isTTY), Boolean(process.stdout.isTTY))) {
    process.stderr.write("Error: interactive mode requires a TTY for stdin and stdout.\n");
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

  const config = resolveConfig({
    provider: opts.provider,
    model: opts.model,
    timeout: opts.timeout,
    config: opts.config,
  });

  if (!config.apiKey) {
    writeMissingApiKeyError(config.provider);
    process.exit(1);
  }

  let state: ChatState = {
    provider: config.provider,
    model: config.model,
    timeoutMs: config.timeoutMs,
    baseUrl: config.baseUrl,
    mode: (opts.mode as ContentMode | undefined) ?? "page-body",
    context: opts.context,
    explain: opts.explain ?? false,
    check: opts.check ?? false,
    diff: opts.diff ?? false,
    json: opts.json ?? false,
    spinner: opts.spinner,
    copy: opts.copy ?? false,
  };

  process.stderr.write("Interactive mode. Enter text to rewrite, or run /help for commands.\n");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  rl.setPrompt("govuk-rewrite> ");
  rl.prompt();

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      continue;
    }

    if (trimmed.startsWith("/")) {
      const command = applyChatCommand(trimmed, state);
      state = command.state;
      for (const message of command.messages) {
        process.stderr.write(message + "\n");
      }
      if (command.quit) {
        break;
      }
      rl.prompt();
      continue;
    }

    const spinner = shouldUseSpinner(state.spinner) ? ora("Rewriting…").start() : null;

    try {
      const apiKey = resolveApiKeyForProvider(state.provider);
      if (!apiKey) {
        spinner?.stop();
        writeMissingApiKeyError(state.provider);
        rl.prompt();
        continue;
      }

      const result = await rewrite(
        {
          text: trimmed,
          explain: state.explain,
          check: state.check,
          context: state.context,
          mode: state.mode,
        },
        {
          provider: state.provider,
          apiKey,
          model: state.model,
          timeoutMs: state.timeoutMs,
          baseUrl: state.baseUrl,
        }
      );

      spinner?.stop();

      const output = formatOutput({
        result,
        mode: selectOutputMode(state),
        provider: state.provider,
        model: state.model,
        originalText: trimmed,
      });
      process.stdout.write(output + "\n");

      if (state.copy && !state.check) {
        const copied = writeClipboard(result.rewrittenText);
        if (copied) {
          process.stderr.write("(copied to clipboard)\n");
        }
      }
    } catch (err) {
      spinner?.fail();
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
    }

    rl.prompt();
  }

  rl.close();
}
