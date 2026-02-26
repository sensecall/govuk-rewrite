# govuk-rewrite

Composable rewrite engine for GOV.UK-style content. Provider-agnostic — works with OpenAI, Anthropic, and OpenRouter.

## Install

```bash
npm install govuk-rewrite
```

## Usage

```ts
import { rewrite } from "govuk-rewrite";

const result = await rewrite(
  {
    text: "Please kindly submit your application by Friday.",
    explain: true,
    mode: "page-body",
  },
  {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4.1-mini",
    timeoutMs: 30000,
  }
);

console.log(result.rewrittenText);
// "Submit your application by Friday."

console.log(result.explanation);
// ["Removed 'please kindly' — unnecessary filler", ...]
```

## API

### `rewrite(input, config)`

```ts
rewrite(input: RewriteInput, config: ProviderConfig): Promise<RewriteResult>
```

**`RewriteInput`**

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | `string` | yes | Text to rewrite |
| `mode` | `ContentMode` | no | Content type hint (default: `"page-body"`) |
| `explain` | `boolean` | no | Include explanation bullets |
| `check` | `boolean` | no | Check mode — returns issues rather than rewriting |
| `context` | `string` | no | Additional context for the rewrite |

**`ProviderConfig`**

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | `"openai" \| "anthropic" \| "openrouter"` | yes | Provider to use |
| `apiKey` | `string` | yes | API key |
| `model` | `string` | yes | Model name |
| `timeoutMs` | `number` | no | Request timeout (default: 30000) |
| `baseUrl` | `string` | no | Override base URL (compatible gateways) |

**`RewriteResult`**

| Field | Type | Description |
|---|---|---|
| `rewrittenText` | `string` | Rewritten text |
| `explanation` | `string[]` | Explanation bullets (when `explain: true`) |
| `issues` | `string[]` | Issues found (when `check: true`) |
| `usage` | `{ inputTokens: number, outputTokens: number }` | Token usage |

### Content modes

| Value | Use for |
|---|---|
| `page-body` | Body copy, paragraphs |
| `error-message` | Form validation errors |
| `hint-text` | Field hints |
| `notification` | Banner and alert text |
| `button` | Button labels |

## Providers

Set the relevant environment variable before calling `rewrite`:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export OPENROUTER_API_KEY=sk-or-...
```

## CLI

If you want a command-line interface rather than the library, install [`govuk-rewrite-cli`](https://www.npmjs.com/package/govuk-rewrite-cli) instead.

## Repository

[github.com/sensecall/govuk-rewrite](https://github.com/sensecall/govuk-rewrite)
