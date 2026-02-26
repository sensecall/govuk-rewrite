import { DEFAULT_MODELS } from "govuk-rewrite-core";
import type { ContentMode, Provider } from "govuk-rewrite-core";
import { VALID_MODES, VALID_PROVIDERS } from "./constants.js";

export interface ChatState {
  provider: Provider;
  model: string;
  timeoutMs: number;
  baseUrl?: string;
  mode: ContentMode;
  context?: string;
  explain: boolean;
  check: boolean;
  diff: boolean;
  json: boolean;
  spinner: boolean;
  copy: boolean;
  tokens: boolean;
}

export interface ChatCommandResult {
  state: ChatState;
  messages: string[];
  quit: boolean;
}

interface ChatCommandDefinition {
  name: string;
  usage?: string;
  description: string;
}

export interface ChatCommandSuggestion {
  command: string;
  description: string;
  expectsArgument: boolean;
}

const CHAT_COMMAND_DEFINITIONS: ChatCommandDefinition[] = [
  { name: "help", description: "Show available commands" },
  {
    name: "provider",
    usage: `<${VALID_PROVIDERS.join("|")}>`,
    description: "Set provider and reset model",
  },
  { name: "model", usage: "<name>", description: "Set model" },
  {
    name: "mode",
    usage: `<${VALID_MODES.join("|")}>`,
    description: "Set rewrite mode",
  },
  {
    name: "context",
    usage: "<text|clear>",
    description: "Set context text or clear it",
  },
  {
    name: "explain",
    usage: "on|off",
    description: "Toggle explanation output",
  },
  {
    name: "check",
    usage: "on|off",
    description: "Toggle check mode",
  },
  {
    name: "diff",
    usage: "on|off",
    description: "Toggle diff output",
  },
  {
    name: "json",
    usage: "on|off",
    description: "Toggle JSON output",
  },
  { name: "tokens", usage: "on|off", description: "Show input/output token counts" },
  { name: "show", description: "Show active settings" },
  { name: "quit", description: "Exit interactive mode" },
];

const KNOWN_CHAT_COMMANDS = new Set(
  CHAT_COMMAND_DEFINITIONS.map((definition) => definition.name)
);

function parseToggle(value: string): boolean | null {
  if (value === "on") return true;
  if (value === "off") return false;
  return null;
}

function formatCommandLabel(definition: ChatCommandDefinition): string {
  return `/${definition.name}${definition.usage ? ` ${definition.usage}` : ""}`;
}

export function listChatCommandSuggestions(query = ""): ChatCommandSuggestion[] {
  const normalizedQuery = query.trim().toLowerCase();

  return CHAT_COMMAND_DEFINITIONS
    .filter((definition) => definition.name.startsWith(normalizedQuery))
    .map((definition) => ({
      command: `/${definition.name}`,
      description: definition.description,
      expectsArgument: Boolean(definition.usage),
    }));
}

export function isKnownChatCommand(token: string): boolean {
  const normalizedToken = token.trim().toLowerCase();
  return KNOWN_CHAT_COMMANDS.has(normalizedToken);
}

export function helpText(): string {
  const commandColumnWidth = CHAT_COMMAND_DEFINITIONS.reduce((maxWidth, definition) => {
    return Math.max(maxWidth, formatCommandLabel(definition).length);
  }, 0);

  return [
    "Commands:",
    ...CHAT_COMMAND_DEFINITIONS.map((definition) => {
      const label = formatCommandLabel(definition).padEnd(commandColumnWidth + 2);
      return `  ${label}${definition.description}`;
    }),
  ].join("\n");
}

function stateSummary(state: ChatState): string[] {
  return [
    `provider: ${state.provider}`,
    `model: ${state.model}`,
    `mode: ${state.mode}`,
    `context: ${state.context ?? "(none)"}`,
    `explain: ${state.explain ? "on" : "off"}`,
    `check: ${state.check ? "on" : "off"}`,
    `diff: ${state.diff ? "on" : "off"}`,
    `json: ${state.json ? "on" : "off"}`,
    `copy: ${state.copy ? "on" : "off"}`,
    `tokens: ${state.tokens ? "on" : "off"}`,
    `spinner: ${state.spinner ? "on" : "off"}`,
  ];
}

export function applyChatCommand(input: string, state: ChatState): ChatCommandResult {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return { state, messages: [], quit: false };
  }

  const withoutSlash = trimmed.slice(1);
  const firstSpace = withoutSlash.indexOf(" ");
  const command = (firstSpace === -1 ? withoutSlash : withoutSlash.slice(0, firstSpace)).toLowerCase();
  const arg = firstSpace === -1 ? "" : withoutSlash.slice(firstSpace + 1).trim();

  switch (command) {
    case "help":
      return { state, messages: [helpText()], quit: false };

    case "quit":
      return { state, messages: ["Exiting interactive mode."], quit: true };

    case "show":
      return { state, messages: stateSummary(state), quit: false };

    case "provider": {
      const provider = arg as Provider;
      if (!VALID_PROVIDERS.includes(provider)) {
        return {
          state,
          messages: [
            `Invalid provider. Valid values: ${VALID_PROVIDERS.join(", ")}`,
          ],
          quit: false,
        };
      }
      const nextState: ChatState = {
        ...state,
        provider,
        model: DEFAULT_MODELS[provider],
      };
      return {
        state: nextState,
        messages: [`Provider set to ${provider}. Model reset to ${nextState.model}.`],
        quit: false,
      };
    }

    case "model": {
      if (!arg) {
        return { state, messages: ["Usage: /model <name>"], quit: false };
      }
      return {
        state: { ...state, model: arg },
        messages: [`Model set to ${arg}.`],
        quit: false,
      };
    }

    case "mode": {
      const mode = arg as ContentMode;
      if (!VALID_MODES.includes(mode)) {
        return {
          state,
          messages: [`Invalid mode. Valid values: ${VALID_MODES.join(", ")}`],
          quit: false,
        };
      }
      return {
        state: { ...state, mode },
        messages: [`Mode set to ${mode}.`],
        quit: false,
      };
    }

    case "context": {
      if (!arg) {
        return { state, messages: ["Usage: /context <text> or /context clear"], quit: false };
      }
      if (arg.toLowerCase() === "clear") {
        return {
          state: { ...state, context: undefined },
          messages: ["Context cleared."],
          quit: false,
        };
      }
      return {
        state: { ...state, context: arg },
        messages: ["Context updated."],
        quit: false,
      };
    }

    case "explain": {
      const toggle = parseToggle(arg);
      if (toggle === null) {
        return { state, messages: ["Usage: /explain on|off"], quit: false };
      }
      return {
        state: { ...state, explain: toggle },
        messages: [`Explain ${toggle ? "enabled" : "disabled"}.`],
        quit: false,
      };
    }

    case "check": {
      const toggle = parseToggle(arg);
      if (toggle === null) {
        return { state, messages: ["Usage: /check on|off"], quit: false };
      }
      return {
        state: { ...state, check: toggle },
        messages: [`Check mode ${toggle ? "enabled" : "disabled"}.`],
        quit: false,
      };
    }

    case "diff": {
      const toggle = parseToggle(arg);
      if (toggle === null) {
        return { state, messages: ["Usage: /diff on|off"], quit: false };
      }
      return {
        state: { ...state, diff: toggle },
        messages: [`Diff output ${toggle ? "enabled" : "disabled"}.`],
        quit: false,
      };
    }

    case "json": {
      const toggle = parseToggle(arg);
      if (toggle === null) {
        return { state, messages: ["Usage: /json on|off"], quit: false };
      }
      return {
        state: { ...state, json: toggle },
        messages: [`JSON output ${toggle ? "enabled" : "disabled"}.`],
        quit: false,
      };
    }

    case "tokens": {
      const toggle = parseToggle(arg);
      if (toggle === null) {
        return { state, messages: ["Usage: /tokens on|off"], quit: false };
      }
      return {
        state: { ...state, tokens: toggle },
        messages: [`Token counts ${toggle ? "enabled" : "disabled"}.`],
        quit: false,
      };
    }

    default:
      return {
        state,
        messages: ["Unknown command. Run /help to see supported commands."],
        quit: false,
      };
  }
}
