import { execSync } from "node:child_process";

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

export function shouldUseSpinner(spinnerEnabled: boolean): boolean {
  return spinnerEnabled && process.stdout.isTTY === true;
}

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
