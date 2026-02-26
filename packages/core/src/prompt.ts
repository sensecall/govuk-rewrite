import type { ContentMode } from "./types.js";

export const SYSTEM_PROMPT = `You are an expert GOV.UK content editor. Rewrite the user's text to meet GOV.UK content design standards.

Rules:
- Use active voice throughout.
- Write in plain English. Use short sentences (no more than 25 words where possible).
- State actions and deadlines clearly. Make it obvious who needs to do what, and by when.
- Remove "please", "kindly", "we would like to", and other filler phrases unless they are genuinely required.
- Avoid jargon. If a domain term is necessary, keep it consistent.
- Never invent facts or change the meaning of the source text.
- If part of the input is ambiguous, keep the wording cautious rather than guessing.
- Do not add headings, bullet points, or structure that was not present in the original, unless clearly implied.
- Remove unnecessary capital letters.
- Spell out abbreviations on first use if they may be unfamiliar.

Respond only with valid JSON matching the schema provided. No preamble, no markdown fences.`;

export const CHECK_SYSTEM_PROMPT = `You are an expert GOV.UK content auditor. Analyse the user's text and identify specific issues that do not meet GOV.UK content design standards. Do not rewrite the text.

Check for:
- Passive voice
- Sentences over 25 words
- Filler phrases ("please", "kindly", "we would like to", "please be advised", etc.)
- Jargon or unnecessarily complex words
- Unclear actions or missing deadlines
- Unnecessary capital letters
- Unexplained abbreviations

Return \`rewrittenText\` as an empty string. List each issue concisely in the \`issues\` array. If no issues are found, return an empty \`issues\` array.

Respond only with valid JSON matching the schema provided. No preamble, no markdown fences.`;

const MODE_PROMPTS: Record<ContentMode, string> = {
  "page-body": "",
  "error-message":
    "The text is a GOV.UK error message. Additional rules: start with 'Enter a…', 'Select a…', or 'Enter your…'. Use present tense. Maximum one sentence. Never start with 'Please'. Do not use 'must' or 'should'.",
  "hint-text":
    "The text is GOV.UK hint text displayed below a form label. Additional rules: keep it short (1–2 sentences). Do not repeat the label. Do not end with punctuation unless it is a full sentence.",
  notification:
    "The text is a GOV.UK Notify notification (email or SMS). Additional rules: plain text only — no markdown, no HTML. Preserve any ((variable)) placeholders exactly as written. For SMS, aim to keep the total under 160 characters.",
  button:
    "The text is a GOV.UK button label. Additional rules: short imperative verb phrase (2–4 words). No punctuation. Start with a capital letter. Examples: 'Continue', 'Save and continue', 'Submit application'.",
};

export interface ResponseSchema {
  rewrittenText: string;
  explanation?: string[];
  issues?: string[];
}

export const JSON_SCHEMA = {
  name: "rewrite_result",
  strict: true,
  schema: {
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
    additionalProperties: false,
  },
};

export function buildSystemPrompt(mode?: ContentMode): string {
  if (!mode || mode === "page-body") return SYSTEM_PROMPT;
  const modeAddendum = MODE_PROMPTS[mode];
  return modeAddendum ? `${SYSTEM_PROMPT}\n\n${modeAddendum}` : SYSTEM_PROMPT;
}

export function buildUserMessage(
  text: string,
  explain: boolean,
  context?: string,
  mode?: ContentMode
): string {
  const parts: string[] = [];

  if (context?.trim()) {
    parts.push(`Service context: ${context.trim()}`);
  }

  const explainInstruction = explain
    ? " Also provide a brief explanation (3–6 bullet points) of the key changes made and why they improve the content."
    : " Do not include an explanation; return an empty array for the explanation field.";

  const modeNote =
    mode && mode !== "page-body" ? ` Treat it as ${mode} content.` : "";

  parts.push(
    `Rewrite the following text into GOV.UK style.${modeNote}${explainInstruction} Return an empty array for the issues field.\n\n${text}`
  );

  return parts.join("\n\n");
}

export function buildCheckMessage(
  text: string,
  context?: string,
  mode?: ContentMode
): string {
  const parts: string[] = [];

  if (context?.trim()) {
    parts.push(`Service context: ${context.trim()}`);
  }

  const modeNote =
    mode && mode !== "page-body" ? ` Treat it as ${mode} content.` : "";

  parts.push(
    `Audit the following text for GOV.UK style issues.${modeNote} Return an empty array for the explanation field.\n\n${text}`
  );

  return parts.join("\n\n");
}
