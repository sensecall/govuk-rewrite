import type { ChatState } from "./chat-commands.js";
import { runChatInk } from "./chat-ink.js";
import {
  bootstrapChatSession,
  handleSubmittedInput,
  resolveConfigForChat,
  supportsInteractiveSession,
} from "./chat-session.js";
import type { ChatOptions, ChatSessionDeps } from "./chat-session.js";

export type { ChatOptions };
export {
  resolveConfigForChat,
  supportsInteractiveSession,
  bootstrapChatSession,
  handleSubmittedInput,
};

export async function processChatInput(
  line: string,
  state: ChatState,
  deps?: ChatSessionDeps
): Promise<{
  state: ChatState;
  quit: boolean;
  output?: string;
  rewrittenText?: string;
  messages: string[];
}> {
  const result = await handleSubmittedInput(line, state, {
    overrides: {},
    deps,
  });

  const assistantOutput = result.events.find((event) => event.kind === "assistant")?.text;
  const messages = result.events
    .filter((event) => event.kind !== "assistant")
    .map((event) => event.text);

  return {
    state: result.state,
    quit: result.shouldExit,
    output: assistantOutput,
    rewrittenText: undefined,
    messages,
  };
}

export async function runChat(opts: ChatOptions): Promise<void> {
  await runChatInk(opts);
}
