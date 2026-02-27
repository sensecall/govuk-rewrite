import { describe, expect, it } from "vitest";
import {
  buildPendingPreviewLines,
  firstSlashToken,
  isMultiline,
  normalizeLineEndings,
  sanitizeChatInput,
  stripBracketedPasteMarkers,
} from "../src/chat-input.js";

describe("chat-input helpers", () => {
  it("strips bracketed paste markers", () => {
    const value = "\u001b[200~line one\nline two\u001b[201~";
    expect(stripBracketedPasteMarkers(value)).toBe("line one\nline two");
  });

  it("strips literal bracketed paste markers without escape prefix", () => {
    const value = "[200~line one\nline two[201~";
    expect(stripBracketedPasteMarkers(value)).toBe("line one\nline two");
  });

  it("strips only boundary markers and keeps marker-like text in body", () => {
    const value = "\u001b[200~keep [200~ this in body\nand [201~ this too\u001b[201~";
    expect(stripBracketedPasteMarkers(value)).toBe("keep [200~ this in body\nand [201~ this too");
  });

  it("normalizes CRLF and CR to LF", () => {
    expect(normalizeLineEndings("a\r\nb\rc")).toBe("a\nb\nc");
  });

  it("sanitizes chat input by removing markers and normalizing line endings", () => {
    const value = "\u001b[200~a\r\nb\u001b[201~";
    expect(sanitizeChatInput(value)).toBe("a\nb");
  });

  it("detects multiline content", () => {
    expect(isMultiline("line one")).toBe(false);
    expect(isMultiline("line one\nline two")).toBe(true);
  });

  it("builds pending preview metadata with first two lines and remainder", () => {
    expect(buildPendingPreviewLines("line one\nline two")).toEqual({
      lineCount: 2,
      previewLines: ["line one", "line two"],
      remainingLineCount: 0,
    });

    expect(buildPendingPreviewLines("l1\nl2\nl3", 2)).toEqual({
      lineCount: 3,
      previewLines: ["l1", "l2"],
      remainingLineCount: 1,
    });
  });

  it("truncates preview lines by max line length", () => {
    expect(buildPendingPreviewLines("a".repeat(150), 2, 20)).toEqual({
      lineCount: 1,
      previewLines: [`${"a".repeat(19)}…`],
      remainingLineCount: 0,
    });
  });

  it("extracts slash token from the first line only", () => {
    expect(firstSlashToken("/help")).toBe("help");
    expect(firstSlashToken("   /context this is context")).toBe("context");
    expect(firstSlashToken("/help\nextra line")).toBe("help");
    expect(firstSlashToken("plain text\n/help")).toBeNull();
    expect(firstSlashToken("/")).toBeNull();
  });
});
