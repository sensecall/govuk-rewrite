import { describe, expect, it, vi } from "vitest";
import { resolveConfigForChat, supportsInteractiveSession } from "../src/chat.js";

describe("supportsInteractiveSession", () => {
  it("requires both stdin and stdout to be TTY", () => {
    expect(supportsInteractiveSession(true, true)).toBe(true);
    expect(supportsInteractiveSession(false, true)).toBe(false);
    expect(supportsInteractiveSession(true, false)).toBe(false);
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
