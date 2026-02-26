import { describe, it, expect } from "vitest";
import { formatOutput } from "../src/io.js";
import { buildUserMessage, buildCheckMessage, buildSystemPrompt } from "../src/prompt.js";

const baseResult = {
  rewrittenText: "Apply online before the deadline.",
  explanation: ["Uses active voice.", "Removes filler phrase."],
};

describe("formatOutput", () => {
  it("plain format returns only the rewritten text", () => {
    const output = formatOutput({
      result: baseResult,
      format: "plain",
      provider: "openai",
      model: "gpt-4.1-mini",
    });
    expect(output).toBe("Apply online before the deadline.");
  });

  it("explain format includes separator and bullets", () => {
    const output = formatOutput({
      result: baseResult,
      format: "explain",
      provider: "openai",
      model: "gpt-4.1-mini",
    });
    expect(output).toContain("Apply online before the deadline.");
    expect(output).toContain("--- why this is better ---");
    expect(output).toContain("- Uses active voice.");
    expect(output).toContain("- Removes filler phrase.");
  });

  it("explain format has correct structure order", () => {
    const output = formatOutput({
      result: baseResult,
      format: "explain",
      provider: "openai",
      model: "gpt-4.1-mini",
    });
    const separatorIndex = output.indexOf("--- why this is better ---");
    const textIndex = output.indexOf("Apply online before the deadline.");
    expect(textIndex).toBeLessThan(separatorIndex);
  });

  it("json format returns valid JSON", () => {
    const output = formatOutput({
      result: baseResult,
      format: "json",
      provider: "openai",
      model: "gpt-4.1-mini",
    });
    const parsed = JSON.parse(output) as {
      rewrittenText: string;
      explanation: string[];
      provider: string;
      model: string;
    };
    expect(parsed.rewrittenText).toBe("Apply online before the deadline.");
    expect(parsed.explanation).toEqual(["Uses active voice.", "Removes filler phrase."]);
    expect(parsed.provider).toBe("openai");
    expect(parsed.model).toBe("gpt-4.1-mini");
  });

  it("json format includes provider and model fields", () => {
    const output = formatOutput({
      result: baseResult,
      format: "json",
      provider: "anthropic",
      model: "claude-3-5-sonnet-latest",
    });
    const parsed = JSON.parse(output) as { provider: string; model: string };
    expect(parsed.provider).toBe("anthropic");
    expect(parsed.model).toBe("claude-3-5-sonnet-latest");
  });

  it("plain format with no explanation returns only text", () => {
    const output = formatOutput({
      result: { rewrittenText: "Short text." },
      format: "plain",
      provider: "openai",
      model: "gpt-4.1-mini",
    });
    expect(output).toBe("Short text.");
  });

  it("explain format with no explanation shows empty section", () => {
    const output = formatOutput({
      result: { rewrittenText: "Short text." },
      format: "explain",
      provider: "openai",
      model: "gpt-4.1-mini",
    });
    expect(output).toContain("--- why this is better ---");
    // Empty explanation → no bullet points (lines starting with "- ")
    const lines = output.split("\n");
    const bulletLines = lines.filter((l) => l.startsWith("- "));
    expect(bulletLines).toHaveLength(0);
  });

  it("json format with missing explanation defaults to empty array", () => {
    const output = formatOutput({
      result: { rewrittenText: "Short text." },
      format: "json",
      provider: "openai",
      model: "gpt-4.1-mini",
    });
    const parsed = JSON.parse(output) as { explanation: string[] };
    expect(parsed.explanation).toEqual([]);
  });

  it("check format lists issues as bullets", () => {
    const output = formatOutput({
      result: {
        rewrittenText: "",
        issues: ["Passive voice: 'has been submitted'", "Filler phrase: 'please be advised'"],
      },
      format: "check",
      provider: "openai",
      model: "gpt-4.1-mini",
    });
    expect(output).toContain("Issues found:");
    expect(output).toContain("- Passive voice:");
    expect(output).toContain("- Filler phrase:");
  });

  it("check format with no issues returns friendly message", () => {
    const output = formatOutput({
      result: { rewrittenText: "", issues: [] },
      format: "check",
      provider: "openai",
      model: "gpt-4.1-mini",
    });
    expect(output).toBe("No issues found.");
  });

  it("diff format includes rewritten text and diff section", () => {
    const output = formatOutput({
      result: { rewrittenText: "Submit your application." },
      format: "diff",
      provider: "openai",
      model: "gpt-4.1-mini",
      originalText: "Please kindly submit your application.",
    });
    expect(output).toContain("Submit your application.");
    expect(output).toContain("--- diff ---");
    expect(output).toContain("- Please kindly submit your application.");
    expect(output).toContain("+ Submit your application.");
  });

  it("diff format with identical text shows no changes", () => {
    const text = "Apply online.";
    const output = formatOutput({
      result: { rewrittenText: text },
      format: "diff",
      provider: "openai",
      model: "gpt-4.1-mini",
      originalText: text,
    });
    expect(output).toContain("--- diff ---");
    expect(output).not.toContain("- Apply");
    expect(output).not.toContain("+ Apply");
  });
});

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
