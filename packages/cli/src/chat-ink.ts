import React from "react";
import { render } from "ink";
import { ChatUI } from "./chat-ui.js";
import type { ChatOptions } from "./chat-session.js";
import { ChatUsageError, supportsInteractiveSession } from "./chat-session.js";

const BRACKETED_PASTE_ENABLE = "\u001b[?2004h";
const BRACKETED_PASTE_DISABLE = "\u001b[?2004l";

export interface ChatInkDeps {
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
  renderApp?: typeof render;
  writeStdout?: (data: string) => void;
}

export async function runChatInk(
  opts: ChatOptions,
  deps: ChatInkDeps = {}
): Promise<void> {
  const stdinIsTTY = deps.stdinIsTTY ?? Boolean(process.stdin.isTTY);
  const stdoutIsTTY = deps.stdoutIsTTY ?? Boolean(process.stdout.isTTY);

  if (!supportsInteractiveSession(stdinIsTTY, stdoutIsTTY)) {
    throw new ChatUsageError("Error: interactive mode requires a TTY for stdin and stdout.");
  }

  const writeStdout = deps.writeStdout ?? ((data: string) => {
    process.stdout.write(data);
  });

  const renderApp = deps.renderApp ?? render;
  writeStdout(BRACKETED_PASTE_ENABLE);
  try {
    const app = renderApp(React.createElement(ChatUI, { opts }), {
      exitOnCtrlC: false,
    });

    await app.waitUntilExit();
  } finally {
    writeStdout(BRACKETED_PASTE_DISABLE);
  }
}
