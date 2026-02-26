import { afterEach, describe, expect, it, vi } from "vitest";
import { rewrite } from "../src/providers/openai.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("openai provider error handling", () => {
  it("normalizes timeout errors", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    await expect(
      rewrite(
        { apiKey: "sk-test", model: "gpt-4.1-mini", timeoutMs: 50 },
        { text: "Some text", explain: false }
      )
    ).rejects.toThrow("Request timed out after 50ms");
  });

  it("normalizes network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket closed")));

    await expect(
      rewrite(
        { apiKey: "sk-test", model: "gpt-4.1-mini", timeoutMs: 50 },
        { text: "Some text", explain: false }
      )
    ).rejects.toThrow("Network error: socket closed");
  });

  it("throws malformed JSON error when provider content cannot be parsed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "not-json" } }],
        }),
      } as Response)
    );

    await expect(
      rewrite(
        { apiKey: "sk-test", model: "gpt-4.1-mini", timeoutMs: 50 },
        { text: "Some text", explain: false }
      )
    ).rejects.toThrow("OpenAI returned malformed JSON");
  });
});
