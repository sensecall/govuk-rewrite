import { describe, expect, it, vi } from "vitest";
import { runChatInk } from "../src/chat-ink.js";
import { ChatUsageError } from "../src/chat-session.js";

const BRACKETED_PASTE_ENABLE = "\u001b[?2004h";
const BRACKETED_PASTE_DISABLE = "\u001b[?2004l";

describe("runChatInk", () => {
  it("throws usage error when stdin/stdout are not TTY", async () => {
    await expect(
      runChatInk(
        {
          spinner: true,
        },
        {
          stdinIsTTY: false,
          stdoutIsTTY: true,
        }
      )
    ).rejects.toBeInstanceOf(ChatUsageError);
  });

  it("renders Ink app in TTY mode", async () => {
    const waitUntilExit = vi.fn().mockResolvedValue(undefined);
    const renderApp = vi.fn().mockReturnValue({
      waitUntilExit,
    });
    const writeStdout = vi.fn();

    await runChatInk(
      {
        spinner: true,
      },
      {
        stdinIsTTY: true,
        stdoutIsTTY: true,
        renderApp: renderApp as unknown as typeof import("ink").render,
        writeStdout,
      }
    );

    expect(writeStdout).toHaveBeenNthCalledWith(1, BRACKETED_PASTE_ENABLE);
    expect(writeStdout).toHaveBeenLastCalledWith(BRACKETED_PASTE_DISABLE);
    expect(renderApp).toHaveBeenCalledOnce();
    expect(waitUntilExit).toHaveBeenCalledOnce();
  });

  it("disables bracketed paste even when chat exits with error", async () => {
    const waitUntilExit = vi.fn().mockRejectedValue(new Error("boom"));
    const renderApp = vi.fn().mockReturnValue({
      waitUntilExit,
    });
    const writeStdout = vi.fn();

    await expect(
      runChatInk(
        {
          spinner: true,
        },
        {
          stdinIsTTY: true,
          stdoutIsTTY: true,
          renderApp: renderApp as unknown as typeof import("ink").render,
          writeStdout,
        }
      )
    ).rejects.toThrow("boom");

    expect(writeStdout).toHaveBeenNthCalledWith(1, BRACKETED_PASTE_ENABLE);
    expect(writeStdout).toHaveBeenLastCalledWith(BRACKETED_PASTE_DISABLE);
  });
});
