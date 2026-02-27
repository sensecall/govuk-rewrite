import { createInterface } from "node:readline/promises";
import { DEFAULT_MODELS, DEFAULT_TIMEOUT_MS, rewrite } from "@sensecall/govuk-rewrite";
import type { Provider } from "@sensecall/govuk-rewrite";
import {
  getApiKeyEnvVarForProvider,
  getDefaultConfigFilePath,
  readConfigFile,
  writeConfigFile,
} from "./config.js";
import type { ConfigFileData } from "./config.js";

const VALID_PROVIDERS: Provider[] = ["openai", "anthropic", "openrouter"];

export interface SetupOptions {
  configPath?: string;
  preferredProvider?: Provider;
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
  prompt?: (question: string) => Promise<string>;
  writeLine?: (line: string) => void;
  readConfig?: (customPath?: string) => ConfigFileData;
  writeConfig?: (config: ConfigFileData, customPath?: string) => void;
  rewriteImpl?: typeof rewrite;
}

export interface SetupResult {
  ran: boolean;
  apiKeySet: boolean;
  provider: Provider;
  envVarName: string;
  apiKey?: string;
  configPath: string;
}

export interface AutoSetupOptions {
  provider: Provider;
  configPath?: string;
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
  prompt?: (question: string) => Promise<string>;
  writeLine?: (line: string) => void;
  runSetupImpl?: (options?: SetupOptions) => Promise<SetupResult>;
}

export class SetupUsageError extends Error {
  readonly exitCode = 2;
}

export function supportsInteractiveSetup(
  stdinIsTTY = Boolean(process.stdin.isTTY),
  stdoutIsTTY = Boolean(process.stdout.isTTY)
): boolean {
  return stdinIsTTY && stdoutIsTTY;
}

export function buildSetupNonInteractiveMessage(customPath?: string): string {
  const configPath = customPath ?? getDefaultConfigFilePath();
  return [
    "Error: setup requires interactive stdin and stdout.",
    "",
    "Run this command directly in a terminal:",
    "  govuk-rewrite setup",
    "",
    `Config file path: ${configPath}`,
  ].join("\n");
}

function defaultWriteLine(line: string): void {
  process.stderr.write(`${line}\n`);
}

function parseYesNo(answer: string, defaultValue: boolean): boolean | null {
  const normalized = answer.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (normalized === "y" || normalized === "yes") return true;
  if (normalized === "n" || normalized === "no") return false;
  return null;
}

async function askYesNo(
  ask: (question: string) => Promise<string>,
  writeLine: (line: string) => void,
  question: string,
  defaultValue: boolean
): Promise<boolean> {
  while (true) {
    const answer = await ask(question);
    const parsed = parseYesNo(answer, defaultValue);
    if (parsed !== null) return parsed;
    writeLine("Please answer y or n.");
  }
}

async function askProvider(
  ask: (question: string) => Promise<string>,
  writeLine: (line: string) => void,
  current: Provider
): Promise<Provider> {
  while (true) {
    const answer = (await ask(`Provider [${current}] (openai|anthropic|openrouter): `))
      .trim()
      .toLowerCase();

    if (!answer) return current;
    if (answer === "openai" || answer === "anthropic" || answer === "openrouter") {
      return answer;
    }

    writeLine(`Invalid provider. Valid values: ${VALID_PROVIDERS.join(", ")}`);
  }
}

async function askOptionalTimeout(
  ask: (question: string) => Promise<string>,
  writeLine: (line: string) => void
): Promise<number | undefined> {
  while (true) {
    const answer = (await ask(
      `Timeout in ms (leave blank for default ${DEFAULT_TIMEOUT_MS}): `
    )).trim();

    if (!answer) return undefined;

    const parsed = parseInt(answer, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }

    writeLine("Timeout must be a positive integer.");
  }
}

function buildConfigToPersist(input: {
  provider: Provider;
  model?: string;
  timeoutMs?: number;
  baseUrl?: string;
}): ConfigFileData {
  const config: ConfigFileData = { provider: input.provider };

  if (input.model?.trim()) {
    config.model = input.model.trim();
  }

  if (typeof input.timeoutMs === "number") {
    config.timeoutMs = input.timeoutMs;
  }

  if (input.baseUrl?.trim()) {
    config.baseUrl = input.baseUrl.trim();
  }

  return config;
}

async function askWithTemporaryReadline(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: true,
  });

  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

export async function runSetup(options: SetupOptions = {}): Promise<SetupResult> {
  const stdinIsTTY = options.stdinIsTTY ?? Boolean(process.stdin.isTTY);
  const stdoutIsTTY = options.stdoutIsTTY ?? Boolean(process.stdout.isTTY);

  if (!supportsInteractiveSetup(stdinIsTTY, stdoutIsTTY)) {
    throw new SetupUsageError(buildSetupNonInteractiveMessage(options.configPath));
  }

  const writeLine = options.writeLine ?? defaultWriteLine;
  const readConfig = options.readConfig ?? readConfigFile;
  const writeConfig = options.writeConfig ?? writeConfigFile;
  const rewriteImpl = options.rewriteImpl ?? rewrite;

  const configPath = options.configPath ?? getDefaultConfigFilePath();
  const existing = readConfig(configPath);

  const defaultProvider = options.preferredProvider ?? existing.provider ?? "openai";

  let rl:
    | ReturnType<typeof createInterface>
    | undefined;

  const ask =
    options.prompt ??
    (async (question: string): Promise<string> => {
      if (!rl) {
        rl = createInterface({
          input: process.stdin,
          output: process.stderr,
          terminal: true,
        });
      }
      return rl.question(question);
    });

  try {
    writeLine("govuk-rewrite setup");
    writeLine("This will save provider defaults to your local config file.");

    const provider = await askProvider(ask, writeLine, defaultProvider);
    const defaultModel = DEFAULT_MODELS[provider];

    const modelInput = (await ask(
      `Model override (leave blank for provider default: ${defaultModel}): `
    )).trim();
    const model = modelInput || undefined;

    const timeoutMs = await askOptionalTimeout(ask, writeLine);

    const baseUrlInput = (await ask(
      "Base URL override (leave blank to clear): "
    )).trim();
    const baseUrl = baseUrlInput || undefined;

    const envVarName = getApiKeyEnvVarForProvider(provider);
    const apiKeyInput = (await ask(
      `API key for ${envVarName} (optional, leave blank to skip): `
    )).trim();
    const apiKey = apiKeyInput || undefined;

    const shouldVerify = await askYesNo(
      ask,
      writeLine,
      "Run a verification request now? [y/N]: ",
      false
    );

    if (shouldVerify) {
      if (!apiKey) {
        writeLine("Skipping verification because no API key was provided.");
      } else {
        try {
          await rewriteImpl(
            {
              text: "Please kindly complete the form before Friday.",
              explain: false,
              mode: "page-body",
            },
            {
              provider,
              apiKey,
              model: model ?? DEFAULT_MODELS[provider],
              timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
              baseUrl,
            }
          );
          writeLine("Verification successful.");
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          writeLine(`Verification failed: ${message}`);
        }
      }
    }

    const configToPersist = buildConfigToPersist({
      provider,
      model,
      timeoutMs,
      baseUrl,
    });

    writeConfig(configToPersist, configPath);

    writeLine(`Saved config to ${configPath}`);
    writeLine("");
    writeLine("Set your API key in your shell profile:");
    writeLine(`  export ${envVarName}=your-key-here`);
    writeLine("");
    writeLine("Then run:");
    writeLine('  govuk-rewrite "Please kindly complete the form"');
    writeLine("  govuk-rewrite chat");

    return {
      ran: true,
      apiKeySet: Boolean(apiKey),
      provider,
      envVarName,
      apiKey,
      configPath,
    };
  } finally {
    rl?.close();
  }
}

export async function maybeRunInteractiveSetupOnMissingKey(
  options: AutoSetupOptions
): Promise<{ ran: boolean; apiKeySet: boolean }> {
  const stdinIsTTY = options.stdinIsTTY ?? Boolean(process.stdin.isTTY);
  const stdoutIsTTY = options.stdoutIsTTY ?? Boolean(process.stdout.isTTY);

  if (!supportsInteractiveSetup(stdinIsTTY, stdoutIsTTY)) {
    return { ran: false, apiKeySet: false };
  }

  const writeLine = options.writeLine ?? defaultWriteLine;
  const ask = options.prompt ?? askWithTemporaryReadline;

  const shouldRunSetup = await askYesNo(
    ask,
    writeLine,
    "No API key found. Run setup now? [Y/n]: ",
    true
  );

  if (!shouldRunSetup) {
    return { ran: false, apiKeySet: false };
  }

  const setupImpl = options.runSetupImpl ?? runSetup;
  const setupResult = await setupImpl({
    configPath: options.configPath,
    preferredProvider: options.provider,
    prompt: options.prompt,
    writeLine,
    stdinIsTTY,
    stdoutIsTTY,
  });

  if (setupResult.apiKey) {
    process.env[setupResult.envVarName] = setupResult.apiKey;
    return { ran: true, apiKeySet: true };
  }

  return { ran: true, apiKeySet: false };
}
