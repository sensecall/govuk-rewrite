import { afterEach, describe, expect, it, vi } from "vitest";
import * as openai from "../src/providers/openai.js";
import * as anthropic from "../src/providers/anthropic.js";
import * as openrouter from "../src/providers/openrouter.js";
import { createClient, rewrite } from "../src/engine.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("engine dispatch", () => {
  it("dispatches to openai adapter", async () => {
    const spy = vi.spyOn(openai, "rewrite").mockResolvedValue({
      rewrittenText: "Use clear words.",
      explanation: [],
      issues: [],
    });

    const result = await rewrite(
      { text: "Please kindly submit.", explain: false },
      { provider: "openai", apiKey: "sk-test" }
    );

    expect(spy).toHaveBeenCalledOnce();
    expect(result.rewrittenText).toBe("Use clear words.");
  });

  it("dispatches to anthropic adapter", async () => {
    const spy = vi.spyOn(anthropic, "rewrite").mockResolvedValue({
      rewrittenText: "Apply by 5pm Friday.",
      explanation: [],
      issues: [],
    });

    await rewrite(
      { text: "You should apply soon.", explain: false },
      { provider: "anthropic", apiKey: "ant-test" }
    );

    expect(spy).toHaveBeenCalledOnce();
  });

  it("dispatches to openrouter adapter", async () => {
    const spy = vi.spyOn(openrouter, "rewrite").mockResolvedValue({
      rewrittenText: "Sign in to continue.",
      explanation: [],
      issues: [],
    });

    await rewrite(
      { text: "Please sign in.", explain: false },
      { provider: "openrouter", apiKey: "or-test" }
    );

    expect(spy).toHaveBeenCalledOnce();
  });

  it("createClient uses configured engine options", async () => {
    const spy = vi.spyOn(openai, "rewrite").mockResolvedValue({
      rewrittenText: "Do this now.",
      explanation: [],
      issues: [],
    });

    const client = createClient({
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4.1-mini",
      timeoutMs: 1000,
    });

    await client.rewrite({ text: "Please do this.", explain: true });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "sk-test",
        model: "gpt-4.1-mini",
        timeoutMs: 1000,
      }),
      expect.objectContaining({ text: "Please do this." })
    );
  });
});
