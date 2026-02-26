import {
  buildSystemPrompt,
  buildUserMessage,
  buildCheckMessage,
  CHECK_SYSTEM_PROMPT,
  JSON_SCHEMA,
} from "../prompt.js";
import type { ProviderOptions, RewriteRequest, RewriteResult } from "../types.js";

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  response_format: {
    type: "json_schema";
    json_schema: typeof JSON_SCHEMA;
  };
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
  error?: {
    message: string;
    type: string;
  };
}

export async function rewrite(
  options: ProviderOptions,
  request: RewriteRequest
): Promise<RewriteResult> {
  const baseUrl = options.baseUrl ?? "https://api.openai.com";
  const url = `${baseUrl}/v1/chat/completions`;

  const systemPrompt = request.check
    ? CHECK_SYSTEM_PROMPT
    : buildSystemPrompt(request.mode);

  const userMessage = request.check
    ? buildCheckMessage(request.text, request.context, request.mode)
    : buildUserMessage(request.text, request.explain, request.context, request.mode);

  const body: OpenAIRequest = {
    model: options.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: {
      type: "json_schema",
      json_schema: JSON_SCHEMA,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
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

  const data = (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? `OpenAI API error: ${response.status}`);
  }

  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  let parsed: RewriteResult;
  try {
    parsed = JSON.parse(content) as RewriteResult;
  } catch {
    throw new Error("OpenAI returned malformed JSON");
  }

  return parsed;
}
