import { describe, expect, it } from "vitest";
import { applyChatCommand } from "../src/chat-commands.js";
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

describe("applyChatCommand", () => {
  it("handles /quit", () => {
    const result = applyChatCommand("/quit", makeState());
    expect(result.quit).toBe(true);
  });

  it("updates provider and resets model", () => {
    const result = applyChatCommand("/provider anthropic", makeState());
    expect(result.state.provider).toBe("anthropic");
    expect(result.state.model).toBe("claude-3-5-sonnet-latest");
  });

  it("updates toggle state", () => {
    const result = applyChatCommand("/explain on", makeState());
    expect(result.state.explain).toBe(true);
  });

  it("sets and clears context", () => {
    const withContext = applyChatCommand("/context HMRC self-assessment", makeState());
    expect(withContext.state.context).toBe("HMRC self-assessment");

    const cleared = applyChatCommand("/context clear", withContext.state);
    expect(cleared.state.context).toBeUndefined();
  });

  it("returns message for unknown command", () => {
    const result = applyChatCommand("/unknown", makeState());
    expect(result.quit).toBe(false);
    expect(result.messages[0]).toContain("Unknown command");
  });
});
