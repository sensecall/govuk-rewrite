const BRACKETED_PASTE_START = "\u001b[200~";
const BRACKETED_PASTE_END = "\u001b[201~";
const BRACKETED_PASTE_START_LITERAL = "[200~";
const BRACKETED_PASTE_END_LITERAL = "[201~";
const START_MARKERS = [BRACKETED_PASTE_START, BRACKETED_PASTE_START_LITERAL];
const END_MARKERS = [BRACKETED_PASTE_END, BRACKETED_PASTE_END_LITERAL];

export interface PendingPreviewLines {
  lineCount: number;
  previewLines: string[];
  remainingLineCount: number;
}

function truncateLine(line: string, maxLineLength: number): string {
  if (line.length <= maxLineLength) return line;
  return `${line.slice(0, maxLineLength - 1)}…`;
}

function stripBoundaryMarker(
  text: string,
  markers: string[],
  boundary: "start" | "end"
): { value: string; stripped: boolean } {
  for (const marker of markers) {
    if (boundary === "start" && text.startsWith(marker)) {
      return {
        value: text.slice(marker.length),
        stripped: true,
      };
    }

    if (boundary === "end" && text.endsWith(marker)) {
      return {
        value: text.slice(0, text.length - marker.length),
        stripped: true,
      };
    }
  }

  return {
    value: text,
    stripped: false,
  };
}

export function stripBracketedPasteMarkers(text: string): string {
  let value = text;

  // Strip wrappers only at the boundaries to avoid removing marker-like
  // content that a user intentionally pasted inside the text.
  while (true) {
    const start = stripBoundaryMarker(value, START_MARKERS, "start");
    if (!start.stripped) break;
    value = start.value;
  }

  while (true) {
    const end = stripBoundaryMarker(value, END_MARKERS, "end");
    if (!end.stripped) break;
    value = end.value;
  }

  return value;
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function sanitizeChatInput(text: string): string {
  return normalizeLineEndings(stripBracketedPasteMarkers(text));
}

export function isMultiline(text: string): boolean {
  return text.includes("\n");
}

export function buildPendingPreviewLines(
  text: string,
  maxLines = 2,
  maxLineLength = 120
): PendingPreviewLines {
  const normalized = normalizeLineEndings(text);
  const lines = normalized.split("\n");
  const lineCount = lines.length;
  const safeMaxLines = Math.max(0, maxLines);
  const safeMaxLineLength = Math.max(1, maxLineLength);
  const previewLines = lines
    .slice(0, safeMaxLines)
    .map((line) => truncateLine(line, safeMaxLineLength));

  return {
    lineCount,
    previewLines,
    remainingLineCount: Math.max(0, lineCount - previewLines.length),
  };
}

export function firstSlashToken(text: string): string | null {
  const firstLine = normalizeLineEndings(text).split("\n", 1)[0]?.trimStart() ?? "";
  if (!firstLine.startsWith("/")) return null;
  const token = firstLine.slice(1).split(/\s+/, 1)[0]?.toLowerCase() ?? "";
  return token.length > 0 ? token : null;
}
