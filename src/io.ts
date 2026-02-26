import { execSync } from "node:child_process";
import type { OutputOptions } from "./types.js";

export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data.trim()));
    process.stdin.on("error", reject);
  });
}

export function isStdinPiped(): boolean {
  return !process.stdin.isTTY;
}

/**
 * Write text to the system clipboard. Returns true on success, false if
 * no clipboard command is available (e.g. Linux without xclip).
 */
export function writeClipboard(text: string): boolean {
  try {
    if (process.platform === "darwin") {
      execSync("pbcopy", { input: text, stdio: ["pipe", "ignore", "ignore"] });
      return true;
    }
    if (process.platform === "win32") {
      execSync("powershell -command Set-Clipboard -Value $input", {
        input: text,
        stdio: ["pipe", "ignore", "ignore"],
      });
      return true;
    }
    // Linux — try xclip, fall back to xsel
    try {
      execSync("xclip -selection clipboard", {
        input: text,
        stdio: ["pipe", "ignore", "ignore"],
      });
      return true;
    } catch {
      execSync("xsel --clipboard --input", {
        input: text,
        stdio: ["pipe", "ignore", "ignore"],
      });
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * Compute a simple LCS-based line diff between two strings.
 * Returns a string with lines prefixed by ' ' (same), '-' (removed), '+' (added).
 */
function diffLines(original: string, rewritten: string): string {
  const a = original.split("\n");
  const b = rewritten.split("\n");
  const m = a.length;
  const n = b.length;

  // Build LCS table
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

  // Backtrack
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

export function formatOutput(options: OutputOptions): string {
  const { result, format, provider, model, originalText } = options;

  if (format === "json") {
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

  if (format === "check") {
    const issues = result.issues ?? [];
    if (issues.length === 0) {
      return "No issues found.";
    }
    return `Issues found:\n${issues.map((i) => `- ${i}`).join("\n")}`;
  }

  if (format === "diff") {
    const original = originalText ?? "";
    const diff = diffLines(original, result.rewrittenText);
    return `${result.rewrittenText}\n\n--- diff ---\n${diff}`;
  }

  if (format === "explain") {
    const bullets = (result.explanation ?? [])
      .map((point) => `- ${point}`)
      .join("\n");
    return `${result.rewrittenText}\n\n--- why this is better ---\n${bullets}`;
  }

  return result.rewrittenText;
}
