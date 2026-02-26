import { describe, expect, it, vi } from "vitest";
import { handleSubmittedInput } from "../src/chat-session.js";
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

describe("handleSubmittedInput", () => {
  it("exits only on /quit", async () => {
    const result = await handleSubmittedInput("/quit", makeState(), {
      overrides: {},
    });

    expect(result.shouldExit).toBe(true);
    expect(result.events[0]?.text).toContain("Exiting interactive mode");
  });

  it("does not exit on unknown commands", async () => {
    const result = await handleSubmittedInput("/unknown", makeState(), {
      overrides: {},
    });

    expect(result.shouldExit).toBe(false);
    expect(result.events[0]?.text).toContain("Unknown command");
  });

  it("keeps session alive after successful rewrite", async () => {
    const rewriteImpl = vi.fn().mockResolvedValue({
      rewrittenText: "Submit your form.",
      explanation: [],
      issues: [],
    });

    const result = await handleSubmittedInput("Please kindly submit your form", makeState(), {
      overrides: {},
      deps: {
        rewriteImpl,
        resolveApiKey: () => "sk-test",
      },
    });

    expect(rewriteImpl).toHaveBeenCalledOnce();
    expect(result.shouldExit).toBe(false);
    expect(result.events.find((event) => event.kind === "assistant")?.text).toContain(
      "Submit your form."
    );
  });

  it("adds a no-improvement system note when rewritten text is unchanged", async () => {
    const rewriteImpl = vi.fn().mockResolvedValue({
      rewrittenText: "Apply now.",
      explanation: [],
      issues: [],
    });

    const result = await handleSubmittedInput("Apply now.", makeState(), {
      overrides: {},
      deps: {
        rewriteImpl,
        resolveApiKey: () => "sk-test",
      },
    });

    expect(result.shouldExit).toBe(false);
    expect(result.events.find((event) => event.kind === "assistant")?.text).toContain("Apply now.");
    expect(
      result.events.find(
        (event) =>
          event.kind === "system" &&
          event.text.includes("No improvement suggested. The text is already close to GOV.UK style.")
      )
    ).toBeDefined();
  });

  it("does not add no-improvement note when rewritten text changes", async () => {
    const rewriteImpl = vi.fn().mockResolvedValue({
      rewrittenText: "Submit your form.",
      explanation: [],
      issues: [],
    });

    const result = await handleSubmittedInput("Please kindly submit your form", makeState(), {
      overrides: {},
      deps: {
        rewriteImpl,
        resolveApiKey: () => "sk-test",
      },
    });

    expect(
      result.events.find(
        (event) =>
          event.kind === "system" &&
          event.text.includes("No improvement suggested. The text is already close to GOV.UK style.")
      )
    ).toBeUndefined();
  });

  it("does not add no-improvement note in check mode", async () => {
    const rewriteImpl = vi.fn().mockResolvedValue({
      rewrittenText: "Apply now.",
      explanation: [],
      issues: [],
    });

    const checkState = { ...makeState(), check: true };

    const result = await handleSubmittedInput("Apply now.", checkState, {
      overrides: {},
      deps: {
        rewriteImpl,
        resolveApiKey: () => "sk-test",
      },
    });

    expect(result.shouldExit).toBe(false);
    expect(
      result.events.find(
        (event) =>
          event.kind === "system" &&
          event.text.includes("No improvement suggested. The text is already close to GOV.UK style.")
      )
    ).toBeUndefined();
  });

  it("keeps session alive after rewrite errors", async () => {
    const rewriteImpl = vi.fn().mockRejectedValue(new Error("fetch failed"));

    const result = await handleSubmittedInput("Some input", makeState(), {
      overrides: {},
      deps: {
        rewriteImpl,
        resolveApiKey: () => "sk-test",
      },
    });

    expect(result.shouldExit).toBe(false);
    expect(result.events.some((event) => event.kind === "error")).toBe(true);
  });

  it("runs auto-setup when provider key is missing", async () => {
    const resolveApiKey = vi
      .fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce("sk-after-setup");

    const setupRunner = vi.fn().mockResolvedValue({ ran: true, apiKeySet: true });
    const configResolver = vi.fn().mockReturnValue({
      provider: "openai",
      model: "gpt-4.1-mini",
      timeoutMs: 30000,
      baseUrl: undefined,
      apiKey: "sk-after-setup",
    });

    const rewriteImpl = vi.fn().mockResolvedValue({
      rewrittenText: "Apply now.",
      explanation: [],
      issues: [],
    });

    const result = await handleSubmittedInput("Please apply now", makeState(), {
      overrides: {},
      deps: {
        resolveApiKey,
        setupRunner,
        configResolver,
        rewriteImpl,
      },
    });

    expect(setupRunner).toHaveBeenCalledOnce();
    expect(result.shouldExit).toBe(false);
    expect(result.events.find((event) => event.kind === "assistant")?.text).toContain("Apply now.");
  });
});
