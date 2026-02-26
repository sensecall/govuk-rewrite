import { beforeEach, describe, expect, it, vi } from "vitest";
import { processChatInput, resolveConfigForChat, supportsInteractiveSession } from "../src/chat.js";
import type { ChatState } from "../src/chat-commands.js";

function makeState(): ChatState {
  return {
    provider: "openai",
    model: "gpt-4.1-mini",
    timeoutMs: 30000,
    mode: "page-body",
    explain: false,
    check: false,
    diff: false,
    json: false,
    spinner: true,
    copy: false,
  };
}

describe("supportsInteractiveSession", () => {
  it("requires both stdin and stdout to be TTY", () => {
    expect(supportsInteractiveSession(true, true)).toBe(true);
    expect(supportsInteractiveSession(false, true)).toBe(false);
    expect(supportsInteractiveSession(true, false)).toBe(false);
  });
});

describe("processChatInput", () => {
  beforeEach(() => {
    process.env["OPENAI_API_KEY"] = "sk-test";
  });

  it("processes /quit command", async () => {
    const result = await processChatInput("/quit", makeState());
    expect(result.quit).toBe(true);
  });

  it("runs rewrite for plain text input", async () => {
    const rewriteImpl = vi.fn().mockResolvedValue({
      rewrittenText: "Submit your form.",
      explanation: [],
      issues: [],
    });

    const result = await processChatInput("Please kindly submit your form", makeState(), rewriteImpl);

    expect(rewriteImpl).toHaveBeenCalledOnce();
    expect(result.output).toContain("Submit your form.");
    expect(result.quit).toBe(false);
  });
});

describe("resolveConfigForChat", () => {
  it("attempts auto-setup when API key is missing", async () => {
    const setupRunner = vi.fn().mockResolvedValue({ ran: false, apiKeySet: false });
    const configResolver = vi.fn().mockReturnValue({
      provider: "anthropic",
      model: "claude-3-5-sonnet-latest",
      timeoutMs: 30000,
      apiKey: undefined,
    });

    const result = await resolveConfigForChat(
      { provider: "anthropic" },
      setupRunner,
      configResolver
    );

    expect(setupRunner).toHaveBeenCalledOnce();
    expect(result.apiKey).toBeUndefined();
  });

  it("re-resolves config after setup runs", async () => {
    const setupRunner = vi.fn().mockResolvedValue({ ran: true, apiKeySet: true });
    const configResolver = vi
      .fn()
      .mockReturnValueOnce({
        provider: "openrouter",
        model: "openai/gpt-4.1-mini",
        timeoutMs: 30000,
        apiKey: undefined,
      })
      .mockReturnValueOnce({
        provider: "openrouter",
        model: "openai/gpt-4.1-mini",
        timeoutMs: 30000,
        apiKey: "or-after-setup",
      });

    const result = await resolveConfigForChat(
      { provider: "openrouter" },
      setupRunner,
      configResolver
    );

    expect(configResolver).toHaveBeenCalledTimes(2);
    expect(result.apiKey).toBe("or-after-setup");
  });
});
