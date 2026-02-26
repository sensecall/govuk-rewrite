import { describe, expect, it, vi } from "vitest";
import { resolveConfigForOneShot, resolveInputText } from "../src/oneshot.js";

describe("resolveInputText", () => {
  it("prefers stdin when piped", () => {
    const resolved = resolveInputText(["arg", "text"], "stdin text", true);
    expect(resolved).toBe("stdin text");
  });

  it("uses positional args when stdin is not piped", () => {
    const resolved = resolveInputText(["arg", "text"], "", false);
    expect(resolved).toBe("arg text");
  });

  it("returns empty string when no stdin and no args", () => {
    const resolved = resolveInputText([], "", false);
    expect(resolved).toBe("");
  });
});

describe("resolveConfigForOneShot", () => {
  it("attempts auto-setup when API key is missing", async () => {
    const setupRunner = vi.fn().mockResolvedValue({ ran: false, apiKeySet: false });
    const configResolver = vi.fn().mockReturnValue({
      provider: "openai",
      model: "gpt-4.1-mini",
      timeoutMs: 30000,
      apiKey: undefined,
    });

    const result = await resolveConfigForOneShot(
      { provider: "openai" },
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
        provider: "openai",
        model: "gpt-4.1-mini",
        timeoutMs: 30000,
        apiKey: undefined,
      })
      .mockReturnValueOnce({
        provider: "openai",
        model: "gpt-4.1-mini",
        timeoutMs: 30000,
        apiKey: "sk-after-setup",
      });

    const result = await resolveConfigForOneShot(
      { provider: "openai" },
      setupRunner,
      configResolver
    );

    expect(configResolver).toHaveBeenCalledTimes(2);
    expect(result.apiKey).toBe("sk-after-setup");
  });
});
