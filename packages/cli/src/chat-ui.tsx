import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";
import { bootstrapChatSession, handleSubmittedInput } from "./chat-session.js";
import type {
  ChatBootstrapResult,
  ChatOptions,
  ChatSessionDeps,
  ChatSessionEvent,
} from "./chat-session.js";
import { ChatRuntimeError, ChatUsageError } from "./chat-session.js";

interface TranscriptTurn {
  kind: "user" | "assistant" | "system" | "error";
  text: string;
}

interface PromptRequest {
  question: string;
  resolve: (value: string) => void;
}

export interface ChatUIProps {
  opts: ChatOptions;
  transcriptLimit?: number;
}

const DEFAULT_TRANSCRIPT_LIMIT = 20;

function truncateForPreview(text: string, limit = 140): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 1)}…`;
}

function eventToTurns(event: ChatSessionEvent): TranscriptTurn[] {
  if (event.kind === "assistant") {
    return [{ kind: "assistant", text: event.text }];
  }
  if (event.kind === "error") {
    return [{ kind: "error", text: event.text }];
  }
  return [{ kind: "system", text: event.text }];
}

function helpFooterLines(): string[] {
  return [
    "Shortcuts: Ctrl+C/Ctrl+D exit · Ctrl+L clear transcript · ? toggle shortcuts",
    "Use /help for commands",
  ];
}

function splitMultiline(kind: TranscriptTurn["kind"], text: string): TranscriptTurn[] {
  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => ({ kind, text: line }));
}

export function ChatUI(props: ChatUIProps): React.JSX.Element {
  const { opts } = props;
  const transcriptLimit = props.transcriptLimit ?? DEFAULT_TRANSCRIPT_LIMIT;
  const { exit } = useApp();

  const [session, setSession] = useState<ChatBootstrapResult | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [promptRequest, setPromptRequest] = useState<PromptRequest | null>(null);

  const promptRequestRef = useRef<PromptRequest | null>(null);
  useEffect(() => {
    promptRequestRef.current = promptRequest;
  }, [promptRequest]);

  const appendTurns = useCallback((turns: TranscriptTurn[]) => {
    setTranscript((prev) => [...prev, ...turns].slice(-transcriptLimit));
  }, [transcriptLimit]);

  const appendSystemLine = useCallback((line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    appendTurns(splitMultiline("system", trimmed));
  }, [appendTurns]);

  const setExitCodeAndExit = useCallback((code: number) => {
    process.exitCode = code;
    exit();
  }, [exit]);

  const requestPromptAnswer = useCallback((question: string): Promise<string> => {
    return new Promise<string>((resolve) => {
      setPromptRequest({ question, resolve });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async (): Promise<void> => {
      try {
        const boot = await bootstrapChatSession(props.opts, {
          prompt: requestPromptAnswer,
          writeLine: appendSystemLine,
        });

        if (cancelled) return;
        setSession(boot);
        appendTurns([
          {
            kind: "system",
            text: "Interactive mode. Enter text to rewrite, or run /help for commands.",
          },
        ]);
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ChatUsageError || err instanceof ChatRuntimeError) {
          process.stderr.write(`${err.message}\n`);
          setExitCodeAndExit(err.exitCode);
          return;
        }

        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Error: ${message}\n`);
        setExitCodeAndExit(1);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      const pending = promptRequestRef.current;
      if (pending) {
        pending.resolve("");
      }
    };
  }, [appendSystemLine, appendTurns, props.opts, requestPromptAnswer, setExitCodeAndExit]);

  const headerText = useMemo(() => {
    if (!session) {
      return "govuk-rewrite chat | loading session…";
    }

    const state = session.state;
    return [
      "govuk-rewrite chat",
      `provider=${state.provider}`,
      `model=${state.model}`,
      `mode=${state.mode}`,
      `explain=${state.explain ? "on" : "off"}`,
      `check=${state.check ? "on" : "off"}`,
      `diff=${state.diff ? "on" : "off"}`,
      `json=${state.json ? "on" : "off"}`,
      `copy=${state.copy ? "on" : "off"}`,
    ].join(" | ");
  }, [session]);

  useInput((input, key) => {
    if (key.ctrl && (input === "c" || input === "d")) {
      setExitCodeAndExit(0);
      return;
    }

    if (key.ctrl && input === "l") {
      setTranscript([]);
      return;
    }

    if (input === "?" && inputValue.trim().length === 0 && !promptRequest && !busy) {
      setShowHelp((prev) => !prev);
      setInputValue("");
    }
  });

  const handleSubmit = useCallback(async (rawValue: string) => {
    const value = rawValue.trim();

    if (promptRequest) {
      const resolver = promptRequest.resolve;
      setPromptRequest(null);
      setInputValue("");
      resolver(rawValue);
      return;
    }

    if (!session || busy) {
      setInputValue("");
      return;
    }

    if (!value) {
      setInputValue("");
      return;
    }

    if (value === "?") {
      setShowHelp((prev) => !prev);
      setInputValue("");
      return;
    }

    appendTurns([{ kind: "user", text: value }]);
    setInputValue("");
    setBusy(true);

    const deps: ChatSessionDeps = {
      prompt: requestPromptAnswer,
      writeLine: appendSystemLine,
    };

    try {
      const result = await handleSubmittedInput(value, session.state, {
        overrides: session.overrides,
        deps,
      });

      setSession((current) => {
        if (!current) return current;
        return {
          ...current,
          state: result.state,
        };
      });

      const turns = result.events.flatMap(eventToTurns);
      if (turns.length > 0) {
        appendTurns(turns);
      }

      if (result.shouldExit) {
        setExitCodeAndExit(0);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendTurns([{ kind: "error", text: `Error: ${message}` }]);
    } finally {
      setBusy(false);
    }
  }, [appendSystemLine, appendTurns, busy, promptRequest, requestPromptAnswer, session, setExitCodeAndExit]);

  return (
    <Box flexDirection="column">
      <Text color="cyan">{headerText}</Text>

      <Box flexDirection="column" marginTop={1}>
        {transcript.map((turn, index) => {
          const key = `${index}-${turn.kind}`;
          if (turn.kind === "user") {
            return (
              <Text key={key} color="gray">
                {`> ${truncateForPreview(turn.text)}`}
              </Text>
            );
          }
          if (turn.kind === "assistant") {
            return <Text key={key}>{turn.text}</Text>;
          }
          if (turn.kind === "error") {
            return <Text key={key} color="red">{turn.text}</Text>;
          }
          return <Text key={key} color="yellow">{turn.text}</Text>;
        })}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {busy && !promptRequest && (
          <Text color="magenta">
            <Spinner type="dots" /> Rewriting…
          </Text>
        )}

        {promptRequest && (
          <Text color="yellow">{promptRequest.question}</Text>
        )}

        <Box>
          <Text color="gray">{"> "}</Text>
          <TextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={(value) => {
              void handleSubmit(value);
            }}
            placeholder={promptRequest ? "" : "Paste text to rewrite"}
          />
        </Box>

        <Text color="gray">? for shortcuts</Text>

        {showHelp && (
          <Box flexDirection="column">
            {helpFooterLines().map((line, index) => (
              <Text key={`help-${index}`} color="gray">
                {line}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
