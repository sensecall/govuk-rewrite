import type { Provider, RewriteResult } from "govuk-rewrite-core";

export type OutputMode = "plain" | "explain" | "json" | "diff" | "check";

export interface OutputFlags {
  explain?: boolean;
  diff?: boolean;
  check?: boolean;
  json?: boolean;
}

export interface FormatOutputOptions {
  result: RewriteResult;
  mode: OutputMode;
  provider: Provider;
  model: string;
  originalText?: string;
}

export function selectOutputMode(flags: OutputFlags): OutputMode {
  if (flags.json) return "json";
  if (flags.check) return "check";
  if (flags.diff) return "diff";
  if (flags.explain) return "explain";
  return "plain";
}

function diffLines(original: string, rewritten: string): string {
  const a = original.split("\n");
  const b = rewritten.split("\n");
  const m = a.length;
  const n = b.length;

  const lcs: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      lcs[i][j] =
        a[i - 1] === b[j - 1]
          ? lcs[i - 1][j - 1] + 1
          : Math.max(lcs[i - 1][j], lcs[i][j - 1]);
    }
  }

  const lines: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      lines.unshift(`  ${a[i - 1]}`);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      lines.unshift(`+ ${b[j - 1]}`);
      j--;
    } else {
      lines.unshift(`- ${a[i - 1]}`);
      i--;
    }
  }

  return lines.join("\n");
}

export function formatOutput(options: FormatOutputOptions): string {
  const { result, mode, provider, model, originalText } = options;

  if (mode === "json") {
    return JSON.stringify(
      {
        rewrittenText: result.rewrittenText,
        explanation: result.explanation ?? [],
        issues: result.issues ?? [],
        provider,
        model,
      },
      null,
      2
    );
  }

  if (mode === "check") {
    const issues = result.issues ?? [];
    if (issues.length === 0) {
      return "No issues found.";
    }
    return `Issues found:\n${issues.map((issue) => `- ${issue}`).join("\n")}`;
  }

  if (mode === "diff") {
    const original = originalText ?? "";
    const diff = diffLines(original, result.rewrittenText);
    return `${result.rewrittenText}\n\n--- diff ---\n${diff}`;
  }

  if (mode === "explain") {
    const bullets = (result.explanation ?? [])
      .map((point) => `- ${point}`)
      .join("\n");
    return `${result.rewrittenText}\n\n--- why this is better ---\n${bullets}`;
  }

  return result.rewrittenText;
}
