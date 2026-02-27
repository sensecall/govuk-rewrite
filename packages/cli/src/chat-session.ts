import { rewrite } from "@sensecall/govuk-rewrite";
import type { ContentMode, Provider } from "@sensecall/govuk-rewrite";
import { applyChatCommand, isKnownChatCommand } from "./chat-commands.js";
import type { ChatState } from "./chat-commands.js";
import { firstSlashToken, isMultiline, normalizeLineEndings } from "./chat-input.js";
import { resolveApiKeyForProvider, resolveConfig } from "./config.js";
import type { CliOverrides, ResolvedConfig } from "./config.js";
import { VALID_MODES, VALID_PROVIDERS } from "./constants.js";
import {
  buildMissingApiKeyErrorLines,
  buildMissingApiKeyErrorMessage,
} from "./errors.js";
import { writeClipboard } from "./io.js";
import {
  detectNoImprovement,
  formatOutput,
  selectOutputMode,
} from "./output.js";
import { resolveConfigWithAutoSetup } from "./session-config.js";
import * as setup from "./setup.js";

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
  tokens?: boolean;
}

export interface ChatSessionEvent {
  kind: "assistant" | "system" | "error" | "success";
  text: string;
}

export interface ChatBootstrapResult {
  state: ChatState;
  config: ResolvedConfig;
  overrides: CliOverrides;
}

export interface ChatSubmitResult {
  state: ChatState;
  events: ChatSessionEvent[];
  shouldExit: boolean;
}

export class ChatUsageError extends Error {
  readonly exitCode = 2;
}

export class ChatRuntimeError extends Error {
  readonly exitCode = 1;
}

export interface ChatSessionDeps {
  setupRunner?: typeof setup.maybeRunInteractiveSetupOnMissingKey;
  configResolver?: typeof resolveConfig;
  resolveApiKey?: typeof resolveApiKeyForProvider;
  rewriteImpl?: typeof rewrite;
  outputFormatter?: typeof formatOutput;
  outputModeSelector?: typeof selectOutputMode;
  clipboardWriter?: typeof writeClipboard;
  prompt?: (question: string) => Promise<string>;
  writeLine?: (line: string) => void;
}

function createConfigOverrides(opts: ChatOptions): CliOverrides {
  return {
    provider: opts.provider,
    model: opts.model,
    timeout: opts.timeout,
    config: opts.config,
  };
}

export function supportsInteractiveSession(
  stdinIsTTY: boolean,
  stdoutIsTTY: boolean
): boolean {
  return stdinIsTTY && stdoutIsTTY;
}

export async function resolveConfigForChat(
  overrides: CliOverrides,
  setupRunner: typeof setup.maybeRunInteractiveSetupOnMissingKey = setup.maybeRunInteractiveSetupOnMissingKey,
  configResolver: typeof resolveConfig = resolveConfig,
  options?: {
    prompt?: (question: string) => Promise<string>;
    writeLine?: (line: string) => void;
  }
): Promise<ResolvedConfig> {
  return resolveConfigWithAutoSetup(overrides, setupRunner, configResolver, options);
}

function validateChatOptions(opts: ChatOptions): void {
  if (opts.mode && !VALID_MODES.includes(opts.mode as ContentMode)) {
    throw new ChatUsageError(
      `Error: invalid --mode \"${opts.mode}\". Valid values: ${VALID_MODES.join(", ")}`
    );
  }

  if (
    opts.provider &&
    !VALID_PROVIDERS.includes(opts.provider as (typeof VALID_PROVIDERS)[number])
  ) {
    throw new ChatUsageError(
      `Error: invalid --provider \"${opts.provider}\". Valid values: ${VALID_PROVIDERS.join(", ")}`
    );
  }
}

export async function bootstrapChatSession(
  opts: ChatOptions,
  deps: ChatSessionDeps = {}
): Promise<ChatBootstrapResult> {
  validateChatOptions(opts);

  const setupRunner = deps.setupRunner ?? setup.maybeRunInteractiveSetupOnMissingKey;
  const configResolver = deps.configResolver ?? resolveConfig;

  const overrides = createConfigOverrides(opts);
  const config = await resolveConfigForChat(overrides, setupRunner, configResolver, {
    prompt: deps.prompt,
    writeLine: deps.writeLine,
  });

  if (!config.apiKey) {
    throw new ChatRuntimeError(buildMissingApiKeyErrorMessage(config.provider));
  }

  const state: ChatState = {
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
    tokens: opts.tokens ?? false,
  };

  return {
    state,
    config,
    overrides,
  };
}

export async function handleSubmittedInput(
  inputText: string,
  state: ChatState,
  options: {
    overrides: CliOverrides;
    deps?: ChatSessionDeps;
  }
): Promise<ChatSubmitResult> {
  const deps = options.deps ?? {};
  const events: ChatSessionEvent[] = [];

  const rewriteImpl = deps.rewriteImpl ?? rewrite;
  const configResolver = deps.configResolver ?? resolveConfig;
  const setupRunner = deps.setupRunner ?? setup.maybeRunInteractiveSetupOnMissingKey;
  const resolveApiKey = deps.resolveApiKey ?? resolveApiKeyForProvider;
  const outputFormatter = deps.outputFormatter ?? formatOutput;
  const outputModeSelector = deps.outputModeSelector ?? selectOutputMode;
  const clipboardWriter = deps.clipboardWriter ?? writeClipboard;

  const trimmed = inputText.trim();
  if (!trimmed) {
    return { state, events, shouldExit: false };
  }

  const normalizedInput = normalizeLineEndings(inputText);
  const hasNewline = isMultiline(normalizedInput);
  const slashToken = firstSlashToken(normalizedInput);

  if (slashToken && (!hasNewline || isKnownChatCommand(slashToken))) {
    const commandInput = hasNewline
      ? (normalizedInput.split("\n", 1)[0]?.trim() ?? "")
      : trimmed;
    const command = applyChatCommand(commandInput, state);
    for (const message of command.messages) {
      events.push({ kind: "system", text: message });
    }
    return {
      state: command.state,
      events,
      shouldExit: command.quit,
    };
  }

  if (!hasNewline && trimmed.startsWith("/")) {
    const command = applyChatCommand(trimmed, state);
    for (const message of command.messages) {
      events.push({ kind: "system", text: message });
    }
    return {
      state: command.state,
      events,
      shouldExit: command.quit,
    };
  }

  let nextState = state;
  let apiKey = resolveApiKey(nextState.provider);

  if (!apiKey) {
    const autoSetupLines: string[] = [];
    const writeLine = (line: string): void => {
      autoSetupLines.push(line);
    };

    const autoSetup = await setupRunner({
      provider: nextState.provider,
      configPath: options.overrides.config,
      prompt: deps.prompt,
      writeLine,
    });

    for (const line of autoSetupLines) {
      if (line.trim()) {
        events.push({ kind: "system", text: line });
      }
    }

    if (autoSetup.ran) {
      const refreshed = configResolver(options.overrides);
      if (refreshed.provider === nextState.provider) {
        nextState = {
          ...nextState,
          model: refreshed.model,
          timeoutMs: refreshed.timeoutMs,
          baseUrl: refreshed.baseUrl,
        };
      }
    }

    apiKey = resolveApiKey(nextState.provider);
  }

  if (!apiKey) {
    for (const line of buildMissingApiKeyErrorLines(nextState.provider)) {
      if (line.trim()) {
        events.push({ kind: "error", text: line });
      }
    }
    return {
      state: nextState,
      events,
      shouldExit: false,
    };
  }

  try {
    const result = await rewriteImpl(
      {
        text: trimmed,
        explain: nextState.explain,
        check: nextState.check,
        context: nextState.context,
        mode: nextState.mode,
      },
      {
        provider: nextState.provider,
        apiKey,
        model: nextState.model,
        timeoutMs: nextState.timeoutMs,
        baseUrl: nextState.baseUrl,
      }
    );

    const noImprovement = detectNoImprovement(trimmed, result.rewrittenText, nextState.check);

    if (noImprovement) {
      events.push({
        kind: "success",
        text: "No improvement suggested. The text is already close to GOV.UK style.",
      });
    } else {
      const outputText = outputFormatter({
        result,
        mode: outputModeSelector(nextState),
        provider: nextState.provider,
        model: nextState.model,
        originalText: trimmed,
        checkMode: nextState.check,
      });
      events.push({ kind: "assistant", text: outputText });
    }

    if (nextState.tokens && result.usage) {
      events.push({
        kind: "system",
        text: `tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`,
      });
    }

    if (nextState.copy && !nextState.check) {
      const copied = clipboardWriter(result.rewrittenText);
      if (copied) {
        events.push({ kind: "system", text: "(copied to clipboard)" });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    events.push({ kind: "error", text: `Error: ${message}` });
  }

  return {
    state: nextState,
    events,
    shouldExit: false,
  };
}
