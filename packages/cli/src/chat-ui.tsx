import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";
import {
  isKnownChatCommand,
  listChatCommandSuggestions,
} from "./chat-commands.js";
import { bootstrapChatSession, handleSubmittedInput } from "./chat-session.js";
import type {
  ChatBootstrapResult,
  ChatOptions,
  ChatSessionDeps,
  ChatSessionEvent,
} from "./chat-session.js";
import { ChatRuntimeError, ChatUsageError } from "./chat-session.js";
import type { ChatCommandSuggestion } from "./chat-commands.js";

interface TranscriptTurn {
  kind: "user" | "assistant" | "system" | "error" | "success";
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

function getSlashCommandQuery(value: string): string | null {
  const match = value.match(/^\/([^\s]*)$/);
  if (!match) return null;
  return match[1].toLowerCase();
}

function eventToTurns(event: ChatSessionEvent): TranscriptTurn[] {
  if (event.kind === "assistant") {
    return [{ kind: "assistant", text: event.text }];
  }
  if (event.kind === "error") {
    return [{ kind: "error", text: event.text }];
  }
  if (event.kind === "success") {
    return [{ kind: "success", text: event.text }];
  }
  return [{ kind: "system", text: event.text }];
}

function helpFooterLines(): string[] {
  return [
    "Shortcuts: Ctrl+C clear input (or exit if empty) · ? toggle shortcuts",
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
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const savedInputRef = useRef<string>("");

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
      `tokens=${state.tokens ? "on" : "off"}`,
    ].join(" | ");
  }, [session]);

  const slashCommandQuery = useMemo(() => {
    if (promptRequest) return null;
    return getSlashCommandQuery(inputValue);
  }, [inputValue, promptRequest]);

  const slashCommandItems = useMemo(() => {
    if (slashCommandQuery === null) return [];
    return listChatCommandSuggestions(slashCommandQuery);
  }, [slashCommandQuery]);

  const showSlashCommandMenu = slashCommandQuery !== null && slashCommandItems.length > 0;

  const selectedCommand: ChatCommandSuggestion | null = showSlashCommandMenu
    ? (slashCommandItems[selectedCommandIndex] ?? slashCommandItems[0])
    : null;

  const slashCommandLabelWidth = useMemo(() => {
    if (slashCommandItems.length === 0) return 0;
    return slashCommandItems.reduce((maxWidth, item) => {
      return Math.max(maxWidth, item.command.length);
    }, 0);
  }, [slashCommandItems]);

  useEffect(() => {
    setSelectedCommandIndex(0);
  }, [slashCommandQuery]);

  useEffect(() => {
    setSelectedCommandIndex((index) => {
      if (slashCommandItems.length === 0) return 0;
      return Math.min(index, slashCommandItems.length - 1);
    });
  }, [slashCommandItems.length]);

  useEffect(() => {
    if (historyIndex === null) {
      setInputValue(savedInputRef.current);
    } else {
      setInputValue(inputHistory[historyIndex] ?? "");
    }
  }, [historyIndex, inputHistory]);

  const applySelectedSlashCommand = useCallback((): boolean => {
    if (slashCommandItems.length === 0) return false;
    const command = slashCommandItems[selectedCommandIndex] ?? slashCommandItems[0];
    const nextValue = `${command.command}${command.expectsArgument ? " " : ""}`;
    setInputValue(nextValue);
    return true;
  }, [selectedCommandIndex, slashCommandItems]);

  useInput((input, key) => {
    if (!showSlashCommandMenu && key.upArrow) {
      setHistoryIndex((prev) => {
        if (inputHistory.length === 0) return null;
        if (prev === null) {
          savedInputRef.current = inputValue;
          return inputHistory.length - 1;
        }
        return Math.max(0, prev - 1);
      });
      return;
    }

    if (!showSlashCommandMenu && key.downArrow) {
      setHistoryIndex((prev) => {
        if (prev === null) return null;
        if (prev === inputHistory.length - 1) return null;
        return prev + 1;
      });
      return;
    }

    if (showSlashCommandMenu && key.upArrow) {
      setSelectedCommandIndex((index) => {
        if (slashCommandItems.length === 0) return 0;
        return (index - 1 + slashCommandItems.length) % slashCommandItems.length;
      });
      return;
    }

    if (showSlashCommandMenu && key.downArrow) {
      setSelectedCommandIndex((index) => {
        if (slashCommandItems.length === 0) return 0;
        return (index + 1) % slashCommandItems.length;
      });
      return;
    }

    if (showSlashCommandMenu && key.tab) {
      applySelectedSlashCommand();
      return;
    }

    if (key.ctrl && input === "c") {
      if (inputValue.length > 0) {
        setInputValue("");
        setHistoryIndex(null);
        savedInputRef.current = "";
      } else {
        setExitCodeAndExit(0);
      }
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
    setInputHistory((prev) => [...prev, value]);
    setHistoryIndex(null);
    savedInputRef.current = "";
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

  const handleInputSubmit = useCallback((rawValue: string): void => {
    const trimmed = rawValue.trim();
    const query = getSlashCommandQuery(trimmed);

    if (
      query !== null &&
      slashCommandItems.length > 0 &&
      !isKnownChatCommand(query)
    ) {
      applySelectedSlashCommand();
      return;
    }

    void handleSubmit(rawValue);
  }, [applySelectedSlashCommand, handleSubmit, slashCommandItems.length]);

  return (
    <Box flexDirection="column">
      <Box paddingX={1}>
        <Text color="cyan">{headerText}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={1}>
        {transcript.map((turn, index) => {
          const key = `${index}-${turn.kind}`;
          if (turn.kind === "user") {
            return (
              <Text key={key} dimColor>
                {`> ${truncateForPreview(turn.text)}`}
              </Text>
            );
          }
          if (turn.kind === "assistant") {
            return (
              <Box key={key} flexDirection="column">
                <Text bold>Rewritten:</Text>
                <Text>{turn.text}</Text>
              </Box>
            );
          }
          if (turn.kind === "error") {
            return <Text key={key} color="red">{turn.text}</Text>;
          }
          if (turn.kind === "success") {
            return <Text key={key} color="green">{turn.text}</Text>;
          }
          // system
          return <Text key={key} dimColor>{turn.text}</Text>;
        })}
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={1}>
        {busy && !promptRequest && (
          <Text color="cyan"><Spinner type="dots" /> Rewriting…</Text>
        )}

        {promptRequest && (
          <Text color="yellow">{promptRequest.question}</Text>
        )}

        {!busy && !promptRequest && (
          <Text dimColor>
            {selectedCommand
              ? `${selectedCommand.command} ${selectedCommand.description}`
              : "Run /help for commands"}
          </Text>
        )}

        <Box>
          <Text color="gray">{"> "}</Text>
          <TextInput
            value={inputValue}
            onChange={(val) => setInputValue(val.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " "))}
            onSubmit={handleInputSubmit}
            placeholder={promptRequest ? "" : "Paste text to rewrite"}
          />
        </Box>

        {showSlashCommandMenu && (
          <Box flexDirection="column">
            {slashCommandItems.map((item, index) => {
              const isSelected = index === selectedCommandIndex;
              const commandLabel = item.command.padEnd(slashCommandLabelWidth + 2);
              return (
                <Box key={item.command}>
                  <Text color={isSelected ? "cyanBright" : "white"}>{commandLabel}</Text>
                  <Text dimColor={!isSelected} color={isSelected ? "cyan" : undefined}>
                    {item.description}
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}

        <Text dimColor>? for shortcuts</Text>

        {showHelp && (
          <Box flexDirection="column">
            {helpFooterLines().map((line, index) => (
              <Text key={`help-${index}`} dimColor>{line}</Text>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
