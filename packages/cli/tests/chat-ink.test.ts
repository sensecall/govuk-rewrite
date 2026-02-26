import { describe, expect, it, vi } from "vitest";
import { runChatInk } from "../src/chat-ink.js";
import { ChatUsageError } from "../src/chat-session.js";

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

    await runChatInk(
      {
        spinner: true,
      },
      {
        stdinIsTTY: true,
        stdoutIsTTY: true,
        renderApp: renderApp as unknown as typeof import("ink").render,
      }
    );

    expect(renderApp).toHaveBeenCalledOnce();
    expect(waitUntilExit).toHaveBeenCalledOnce();
  });
});
