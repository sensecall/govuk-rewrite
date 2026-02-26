import { describe, expect, it } from "vitest";
import {
  applyChatCommand,
  isKnownChatCommand,
  listChatCommandSuggestions,
} from "../src/chat-commands.js";
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

describe("listChatCommandSuggestions", () => {
  it("returns all commands for an empty query", () => {
    const results = listChatCommandSuggestions("");
    expect(results.length).toBeGreaterThan(5);
    expect(results[0]?.command).toBe("/help");
  });

  it("filters commands by prefix", () => {
    const results = listChatCommandSuggestions("mo");
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.command)).toEqual(["/model", "/mode"]);
  });
});

describe("isKnownChatCommand", () => {
  it("returns true for known commands", () => {
    expect(isKnownChatCommand("help")).toBe(true);
    expect(isKnownChatCommand("MODEL")).toBe(true);
  });

  it("returns false for unknown commands", () => {
    expect(isKnownChatCommand("unknown")).toBe(false);
  });
});
