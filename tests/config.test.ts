import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveConfig } from "../src/config.js";

describe("resolveConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear any govuk-rewrite env vars before each test
    delete process.env["GOVUK_REWRITE_PROVIDER"];
    delete process.env["GOVUK_REWRITE_MODEL"];
    delete process.env["GOVUK_REWRITE_TIMEOUT_MS"];
    delete process.env["GOVUK_REWRITE_BASE_URL"];
    delete process.env["OPENAI_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["OPENROUTER_API_KEY"];
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
  });

  it("returns defaults when nothing is set", () => {
    const config = resolveConfig();
    expect(config.provider).toBe("openai");
    expect(config.model).toBe("gpt-4.1-mini");
    expect(config.timeoutMs).toBe(30000);
  });

  it("env var overrides default provider", () => {
    process.env["GOVUK_REWRITE_PROVIDER"] = "anthropic";
    const config = resolveConfig();
    expect(config.provider).toBe("anthropic");
  });

  it("env var overrides default model", () => {
    process.env["GOVUK_REWRITE_MODEL"] = "gpt-4o";
    const config = resolveConfig();
    expect(config.model).toBe("gpt-4o");
  });

  it("env var overrides default timeout", () => {
    process.env["GOVUK_REWRITE_TIMEOUT_MS"] = "60000";
    const config = resolveConfig();
    expect(config.timeoutMs).toBe(60000);
  });

  it("CLI flag overrides env var provider", () => {
    process.env["GOVUK_REWRITE_PROVIDER"] = "anthropic";
    const config = resolveConfig({ provider: "openrouter" });
    expect(config.provider).toBe("openrouter");
  });

  it("CLI flag overrides env var model", () => {
    process.env["GOVUK_REWRITE_MODEL"] = "gpt-4o";
    const config = resolveConfig({ model: "gpt-4.1" });
    expect(config.model).toBe("gpt-4.1");
  });

  it("CLI flag overrides env var timeout", () => {
    process.env["GOVUK_REWRITE_TIMEOUT_MS"] = "60000";
    const config = resolveConfig({ timeout: 10000 });
    expect(config.timeoutMs).toBe(10000);
  });

  it("uses provider-appropriate default model when switching provider via env var", () => {
    process.env["GOVUK_REWRITE_PROVIDER"] = "anthropic";
    const config = resolveConfig();
    expect(config.model).toBe("claude-3-5-sonnet-latest");
  });

  it("uses provider-appropriate default model when switching provider via CLI", () => {
    const config = resolveConfig({ provider: "openrouter" });
    expect(config.model).toBe("openai/gpt-4.1-mini");
  });

  it("reads OPENAI_API_KEY for openai provider", () => {
    process.env["OPENAI_API_KEY"] = "sk-test";
    const config = resolveConfig({ provider: "openai" });
    expect(config.apiKey).toBe("sk-test");
  });

  it("reads ANTHROPIC_API_KEY for anthropic provider", () => {
    process.env["ANTHROPIC_API_KEY"] = "ant-test";
    const config = resolveConfig({ provider: "anthropic" });
    expect(config.apiKey).toBe("ant-test");
  });

  it("reads OPENROUTER_API_KEY for openrouter provider", () => {
    process.env["OPENROUTER_API_KEY"] = "or-test";
    const config = resolveConfig({ provider: "openrouter" });
    expect(config.apiKey).toBe("or-test");
  });

  it("returns undefined apiKey when none set", () => {
    const config = resolveConfig();
    expect(config.apiKey).toBeUndefined();
  });

  it("ignores invalid non-numeric timeout env var", () => {
    process.env["GOVUK_REWRITE_TIMEOUT_MS"] = "not-a-number";
    const config = resolveConfig();
    expect(config.timeoutMs).toBe(30000);
  });
});
