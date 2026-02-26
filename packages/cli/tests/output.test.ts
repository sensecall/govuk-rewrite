import { describe, it, expect } from "vitest";
import {
  detectNoImprovement,
  formatOutput,
  selectOutputMode,
} from "../src/output.js";

const baseResult = {
  rewrittenText: "Apply online before the deadline.",
  explanation: ["Uses active voice.", "Removes filler phrase."],
};

describe("selectOutputMode", () => {
  it("applies precedence json > check > diff > explain > plain", () => {
    expect(selectOutputMode({ explain: true })).toBe("explain");
    expect(selectOutputMode({ diff: true, explain: true })).toBe("diff");
    expect(selectOutputMode({ check: true, diff: true, explain: true })).toBe("check");
    expect(selectOutputMode({ json: true, check: true, diff: true, explain: true })).toBe(
      "json"
    );
    expect(selectOutputMode({})).toBe("plain");
  });
});

describe("formatOutput", () => {
  it("detectNoImprovement returns true for normalized-equal text", () => {
    const noImprovement = detectNoImprovement(
      "Apply now.\r\nSubmit by Friday.  ",
      "  Apply now.\nSubmit by Friday."
    );
    expect(noImprovement).toBe(true);
  });

  it("detectNoImprovement returns false for materially changed text", () => {
    const noImprovement = detectNoImprovement("Apply by Friday.", "Apply by Monday.");
    expect(noImprovement).toBe(false);
  });

  it("plain format returns only rewritten text", () => {
    const output = formatOutput({
      result: baseResult,
      mode: "plain",
      provider: "openai",
      model: "gpt-4.1-mini",
    });
    expect(output).toBe("Apply online before the deadline.");
  });

  it("explain format includes separator and bullets", () => {
    const output = formatOutput({
      result: baseResult,
      mode: "explain",
      provider: "openai",
      model: "gpt-4.1-mini",
    });
    expect(output).toContain("Apply online before the deadline.");
    expect(output).toContain("--- why this is better ---");
    expect(output).toContain("- Uses active voice.");
  });

  it("explain format includes no-improvement bullet when unchanged", () => {
    const output = formatOutput({
      result: {
        rewrittenText: "Apply online before the deadline.",
        explanation: ["Keeps wording concise."],
      },
      mode: "explain",
      provider: "openai",
      model: "gpt-4.1-mini",
      originalText: "Apply online before the deadline.\r\n",
      checkMode: false,
    });
    expect(output).toContain(
      "- No improvement suggested. The text already aligns with GOV.UK style."
    );
    expect(output).toContain("- Keeps wording concise.");
  });

  it("json format returns valid JSON", () => {
    const output = formatOutput({
      result: baseResult,
      mode: "json",
      provider: "openai",
      model: "gpt-4.1-mini",
      originalText: "Apply online before the deadline.",
    });
    const parsed = JSON.parse(output) as {
      rewrittenText: string;
      explanation: string[];
      provider: string;
      model: string;
      noImprovement: boolean;
    };
    expect(parsed.rewrittenText).toBe("Apply online before the deadline.");
    expect(parsed.explanation).toEqual(["Uses active voice.", "Removes filler phrase."]);
    expect(parsed.provider).toBe("openai");
    expect(parsed.model).toBe("gpt-4.1-mini");
    expect(parsed.noImprovement).toBe(true);
  });

  it("json format marks noImprovement false when text changed", () => {
    const output = formatOutput({
      result: { rewrittenText: "Submit your application." },
      mode: "json",
      provider: "openai",
      model: "gpt-4.1-mini",
      originalText: "Please kindly submit your application.",
      checkMode: false,
    });
    const parsed = JSON.parse(output) as { noImprovement: boolean };
    expect(parsed.noImprovement).toBe(false);
  });

  it("check format lists issues", () => {
    const output = formatOutput({
      result: {
        rewrittenText: "",
        issues: ["Passive voice used", "Sentence too long"],
      },
      mode: "check",
      provider: "openai",
      model: "gpt-4.1-mini",
    });
    expect(output).toContain("Issues found:");
    expect(output).toContain("- Passive voice used");
  });

  it("diff format shows line-level changes", () => {
    const output = formatOutput({
      result: { rewrittenText: "Submit your application." },
      mode: "diff",
      provider: "openai",
      model: "gpt-4.1-mini",
      originalText: "Please kindly submit your application.",
    });
    expect(output).toContain("--- diff ---");
    expect(output).toContain("- Please kindly submit your application.");
    expect(output).toContain("+ Submit your application.");
  });
});
