import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";

describe("resolveConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env["GOVUK_REWRITE_PROVIDER"];
    delete process.env["GOVUK_REWRITE_MODEL"];
    delete process.env["GOVUK_REWRITE_TIMEOUT_MS"];
    delete process.env["GOVUK_REWRITE_BASE_URL"];
    delete process.env["OPENAI_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["OPENROUTER_API_KEY"];
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
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

  it("CLI flag overrides env var provider", () => {
    process.env["GOVUK_REWRITE_PROVIDER"] = "anthropic";
    const config = resolveConfig({ provider: "openrouter" });
    expect(config.provider).toBe("openrouter");
  });

  it("uses provider-appropriate default model when switching provider", () => {
    const config = resolveConfig({ provider: "openrouter" });
    expect(config.model).toBe("openai/gpt-4.1-mini");
  });

  it("resolves provider-specific API key", () => {
    process.env["ANTHROPIC_API_KEY"] = "ant-test";
    const config = resolveConfig({ provider: "anthropic" });
    expect(config.apiKey).toBe("ant-test");
  });

  it("ignores invalid timeout env var", () => {
    process.env["GOVUK_REWRITE_TIMEOUT_MS"] = "invalid";
    const config = resolveConfig();
    expect(config.timeoutMs).toBe(30000);
  });
});
