import { describe, it, expect } from "vitest";
import { buildUserMessage, buildCheckMessage, buildSystemPrompt } from "../src/prompt.js";

describe("buildUserMessage", () => {
  it("includes context when provided", () => {
    const msg = buildUserMessage("Submit your form.", false, "pension credit service");
    expect(msg).toContain("Service context: pension credit service");
  });

  it("does not include context section when omitted", () => {
    const msg = buildUserMessage("Submit your form.", false);
    expect(msg).not.toContain("Service context");
  });

  it("includes mode note for non-default modes", () => {
    const msg = buildUserMessage("Enter something wrong.", false, undefined, "error-message");
    expect(msg).toContain("error-message");
  });

  it("instructs to include explanation when explain is true", () => {
    const msg = buildUserMessage("Some text.", true);
    expect(msg).toContain("explanation");
    expect(msg).toContain("3–6 bullet points");
  });
});

describe("buildCheckMessage", () => {
  it("includes the source text", () => {
    const msg = buildCheckMessage("We would like to advise you that...");
    expect(msg).toContain("We would like to advise you that...");
  });

  it("includes context when provided", () => {
    const msg = buildCheckMessage("Some text.", "DWP benefits service");
    expect(msg).toContain("Service context: DWP benefits service");
  });
});

describe("buildSystemPrompt", () => {
  it("returns base prompt for page-body mode", () => {
    const prompt = buildSystemPrompt("page-body");
    expect(prompt).toContain("GOV.UK content editor");
    expect(prompt).not.toContain("error message");
  });

  it("appends mode rules for error-message", () => {
    const prompt = buildSystemPrompt("error-message");
    expect(prompt).toContain("GOV.UK content editor");
    expect(prompt).toContain("error message");
    expect(prompt).toContain("Enter a");
  });

  it("appends mode rules for notification", () => {
    const prompt = buildSystemPrompt("notification");
    expect(prompt).toContain("((variable))");
  });
});
