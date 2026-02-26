import { beforeEach, describe, expect, it, vi } from "vitest";
import { processChatInput, supportsInteractiveSession } from "../src/chat.js";
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
