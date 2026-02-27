import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSetupNonInteractiveMessage,
  maybeRunInteractiveSetupOnMissingKey,
  runSetup,
  SetupUsageError,
  supportsInteractiveSetup,
} from "../src/setup.js";

function promptFromAnswers(answers: string[]): (question: string) => Promise<string> {
  let index = 0;
  return async () => {
    const value = answers[index] ?? "";
    index += 1;
    return value;
  };
}

describe("supportsInteractiveSetup", () => {
  it("returns true only when stdin and stdout are TTY", () => {
    expect(supportsInteractiveSetup(true, true)).toBe(true);
    expect(supportsInteractiveSetup(false, true)).toBe(false);
    expect(supportsInteractiveSetup(true, false)).toBe(false);
  });
});

describe("runSetup", () => {
  it("throws usage error when not interactive", async () => {
    await expect(
      runSetup({
        stdinIsTTY: false,
        stdoutIsTTY: true,
      })
    ).rejects.toBeInstanceOf(SetupUsageError);
  });

  it("writes config without persisting API key and can verify", async () => {
    let writtenConfig: Record<string, unknown> | undefined;
    const rewriteImpl = vi.fn().mockResolvedValue({
      rewrittenText: "Submit your form by Friday.",
      explanation: [],
      issues: [],
    });

    const result = await runSetup({
      configPath: "/tmp/govuk-rewrite-test-config.json",
      stdinIsTTY: true,
      stdoutIsTTY: true,
      prompt: promptFromAnswers([
        "openrouter",
        "openai/gpt-4.1-mini",
        "25000",
        "https://proxy.example",
        "or-test-key",
        "y",
      ]),
      readConfig: () => ({}),
      writeConfig: (config) => {
        writtenConfig = config as Record<string, unknown>;
      },
      rewriteImpl,
      writeLine: () => {},
    });

    expect(result.ran).toBe(true);
    expect(result.apiKeySet).toBe(true);
    expect(result.provider).toBe("openrouter");
    expect(rewriteImpl).toHaveBeenCalledOnce();

    expect(writtenConfig).toEqual({
      provider: "openrouter",
      model: "openai/gpt-4.1-mini",
      timeoutMs: 25000,
      baseUrl: "https://proxy.example",
    });
    expect(writtenConfig).not.toHaveProperty("apiKey");
  });

  it("sanitizes bracketed-paste markers in setup answers", async () => {
    let writtenConfig: Record<string, unknown> | undefined;

    const result = await runSetup({
      configPath: "/tmp/govuk-rewrite-test-config.json",
      stdinIsTTY: true,
      stdoutIsTTY: true,
      prompt: promptFromAnswers([
        "openai",
        "",
        "",
        "",
        "\u001b[200~sk-proj-test\u001b[201~",
        "n",
      ]),
      readConfig: () => ({}),
      writeConfig: (config) => {
        writtenConfig = config as Record<string, unknown>;
      },
      writeLine: () => {},
    });

    expect(result.apiKeySet).toBe(true);
    expect(result.apiKey).toBe("sk-proj-test");
    expect(writtenConfig).toEqual({ provider: "openai" });
  });
});

describe("maybeRunInteractiveSetupOnMissingKey", () => {
  const originalOpenAiKey = process.env["OPENAI_API_KEY"];

  afterEach(() => {
    if (originalOpenAiKey === undefined) {
      delete process.env["OPENAI_API_KEY"];
    } else {
      process.env["OPENAI_API_KEY"] = originalOpenAiKey;
    }
  });

  it("does nothing when not interactive", async () => {
    const runSetupImpl = vi.fn();

    const result = await maybeRunInteractiveSetupOnMissingKey({
      provider: "openai",
      stdinIsTTY: false,
      stdoutIsTTY: true,
      runSetupImpl,
    });

    expect(result).toEqual({ ran: false, apiKeySet: false });
    expect(runSetupImpl).not.toHaveBeenCalled();
  });

  it("returns without running setup when user declines", async () => {
    const runSetupImpl = vi.fn();

    const result = await maybeRunInteractiveSetupOnMissingKey({
      provider: "openai",
      stdinIsTTY: true,
      stdoutIsTTY: true,
      prompt: async () => "n",
      runSetupImpl,
      writeLine: () => {},
    });

    expect(result).toEqual({ ran: false, apiKeySet: false });
    expect(runSetupImpl).not.toHaveBeenCalled();
  });

  it("runs setup and applies key to current process env", async () => {
    const runSetupImpl = vi.fn().mockResolvedValue({
      ran: true,
      apiKeySet: true,
      provider: "openai",
      envVarName: "OPENAI_API_KEY",
      apiKey: "sk-from-setup",
      configPath: "/tmp/config.json",
    });

    const result = await maybeRunInteractiveSetupOnMissingKey({
      provider: "openai",
      stdinIsTTY: true,
      stdoutIsTTY: true,
      prompt: async () => "y",
      runSetupImpl,
      writeLine: () => {},
    });

    expect(result).toEqual({ ran: true, apiKeySet: true });
    expect(process.env["OPENAI_API_KEY"]).toBe("sk-from-setup");
  });

  it("accepts bracketed-paste markers in yes/no setup prompt", async () => {
    const runSetupImpl = vi.fn().mockResolvedValue({
      ran: true,
      apiKeySet: false,
      provider: "openai",
      envVarName: "OPENAI_API_KEY",
      configPath: "/tmp/config.json",
    });

    const result = await maybeRunInteractiveSetupOnMissingKey({
      provider: "openai",
      stdinIsTTY: true,
      stdoutIsTTY: true,
      prompt: async () => "\u001b[200~y\u001b[201~",
      runSetupImpl,
      writeLine: () => {},
    });

    expect(result).toEqual({ ran: true, apiKeySet: false });
    expect(runSetupImpl).toHaveBeenCalledOnce();
  });
});

describe("buildSetupNonInteractiveMessage", () => {
  it("includes command and target config path", () => {
    const message = buildSetupNonInteractiveMessage("/tmp/custom-config.json");
    expect(message).toContain("govuk-rewrite setup");
    expect(message).toContain("/tmp/custom-config.json");
  });
});
