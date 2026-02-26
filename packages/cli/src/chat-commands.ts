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
}

export interface ChatCommandResult {
  state: ChatState;
  messages: string[];
  quit: boolean;
}

function parseToggle(value: string): boolean | null {
  if (value === "on") return true;
  if (value === "off") return false;
  return null;
}

export function helpText(): string {
  return [
    "Commands:",
    "  /help                                Show available commands",
    "  /provider <openai|anthropic|openrouter>",
    "  /model <name>                        Set model",
    "  /mode <page-body|error-message|hint-text|notification|button>",
    "  /context <text>                      Set context",
    "  /context clear                       Clear context",
    "  /explain on|off                      Toggle explanation output",
    "  /check on|off                        Toggle check mode",
    "  /diff on|off                         Toggle diff output",
    "  /json on|off                         Toggle JSON output",
    "  /show                                Show active settings",
    "  /quit                                Exit interactive mode",
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

    default:
      return {
        state,
        messages: ["Unknown command. Run /help to see supported commands."],
        quit: false,
      };
  }
}
