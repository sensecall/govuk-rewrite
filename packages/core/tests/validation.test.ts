import { describe, expect, it } from "vitest";
import { normaliseEngineOptions } from "../src/validation.js";

describe("normaliseEngineOptions", () => {
  it("applies default model and timeout when omitted", () => {
    const normalized = normaliseEngineOptions({
      provider: "openai",
      apiKey: "sk-test",
    });

    expect(normalized.model).toBe("gpt-4.1-mini");
    expect(normalized.timeoutMs).toBe(30000);
  });

  it("uses provider-specific default model", () => {
    const normalized = normaliseEngineOptions({
      provider: "anthropic",
      apiKey: "ant-test",
    });

    expect(normalized.model).toBe("claude-3-5-sonnet-latest");
  });

  it("throws on missing api key", () => {
    expect(() =>
      normaliseEngineOptions({
        provider: "openai",
        apiKey: "",
      })
    ).toThrow("Missing apiKey");
  });

  it("throws on invalid timeout", () => {
    expect(() =>
      normaliseEngineOptions({
        provider: "openai",
        apiKey: "sk-test",
        timeoutMs: 0,
      })
    ).toThrow("timeoutMs must be a positive number");
  });
});
