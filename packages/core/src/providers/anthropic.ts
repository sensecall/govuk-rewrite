import {
  buildSystemPrompt,
  buildUserMessage,
  buildCheckMessage,
  CHECK_SYSTEM_PROMPT,
} from "../prompt.js";
import type { ProviderOptions, RewriteRequest, RewriteResult } from "../types.js";

const TOOL_DEFINITION = {
  name: "rewrite_result",
  description: "Return the rewritten text, optional explanation, and optional issues.",
  input_schema: {
    type: "object",
    properties: {
      rewrittenText: {
        type: "string",
        description:
          "The rewritten text in GOV.UK style. Empty string when in check mode.",
      },
      explanation: {
        type: "array",
        items: { type: "string" },
        description:
          "Short bullet points explaining what was changed and why. Only include when requested.",
      },
      issues: {
        type: "array",
        items: { type: "string" },
        description:
          "GOV.UK style issues found in the original text. Only populate in check mode.",
      },
    },
    required: ["rewrittenText", "explanation", "issues"],
  },
};

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: "user"; content: string }>;
  tools: typeof TOOL_DEFINITION[];
  tool_choice: { type: "tool"; name: string };
}

interface AnthropicResponse {
  content: Array<{
    type: string;
    name?: string;
    input?: RewriteResult;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: {
    message: string;
    type: string;
  };
}

export async function rewrite(
  options: ProviderOptions,
  request: RewriteRequest
): Promise<RewriteResult> {
  const baseUrl = options.baseUrl ?? "https://api.anthropic.com";
  const url = `${baseUrl}/v1/messages`;

  const systemPrompt = request.check
    ? CHECK_SYSTEM_PROMPT
    : buildSystemPrompt(request.mode);

  const userMessage = request.check
    ? buildCheckMessage(request.text, request.context, request.mode)
    : buildUserMessage(request.text, request.explain, request.context, request.mode);

  const body: AnthropicRequest = {
    model: options.model,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    tools: [TOOL_DEFINITION],
    tool_choice: { type: "tool", name: "rewrite_result" },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": options.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timed out after ${options.timeoutMs}ms`);
    }
    throw new Error(`Network error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
  }

  const data = (await response.json()) as AnthropicResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Anthropic API error: ${response.status}`);
  }

  const toolUse = data.content.find((block) => block.type === "tool_use");
  if (!toolUse?.input) {
    throw new Error("Anthropic returned no tool use result");
  }

  const result = toolUse.input;
  if (data.usage) {
    result.usage = {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    };
  }

  return result;
}
