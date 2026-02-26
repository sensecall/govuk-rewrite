# govuk-rewrite

A minimal CLI that rewrites text into GOV.UK-style content.

- Default output is rewritten text only (stdout)
- `--explain` adds short bullet points when requested
- Works with stdin, pipes, and positional text arguments
- Built for script-friendly terminal use

## Install

Global install:

```bash
npm install -g govuk-rewrite
```

Run without installing:

```bash
npx govuk-rewrite "Text to rewrite"
```

Requires Node.js 18+.

## Quick start

Basic rewrite:

```bash
govuk-rewrite "Please kindly complete the form below"
```

Rewrite with explanation:

```bash
govuk-rewrite --explain "Please kindly complete the form below"
```

Pipe input:

```bash
pbpaste | govuk-rewrite --explain
```

Check style issues without rewriting:

```bash
govuk-rewrite --check "Thank you for your kind submission"
```

Get machine-readable JSON:

```bash
govuk-rewrite --json --explain "Please fill in the form"
```

## CLI behavior

### Input resolution

The CLI resolves input in this order:

1. If stdin is piped (`process.stdin.isTTY === false`), read all stdin text.
2. Otherwise, join positional args (`govuk-rewrite [text...]`) into one input string.
3. If still empty, print help to stderr and exit code `2`.

When both stdin and args are present, stdin wins.

### Output modes

Output mode is chosen in this order of precedence:

1. `--json`
2. `--check`
3. `--diff`
4. `--explain`
5. plain output (default)

Mode details:

- plain: rewritten text only
- explain: rewritten text, blank line, `--- why this is better ---`, bullets
- diff: rewritten text, blank line, `--- diff ---`, line diff
- check: `Issues found:` bullet list, or `No issues found.`
- json: JSON only (no extra text)

`--json` always returns:

```json
{
  "rewrittenText": "...",
  "explanation": ["..."],
  "issues": ["..."],
  "provider": "openai",
  "model": "gpt-4.1-mini"
}
```

### Spinner and clipboard behavior

- Spinner shows only when stdout is a TTY and `--no-spinner` is not set.
- Spinner text is `Rewriting…`.
- Spinner is stopped on both success and failure.
- On successful interactive runs, rewritten text is copied to clipboard by default.
- Disable auto-copy with `--no-copy`.

### stdout and stderr contract

- Successful output is written to stdout.
- Errors are written to stderr.
- Help for empty input is written to stderr and exits with code `2`.
- Clipboard status messages (when interactive and copied) are written to stderr.

## Options

```text
govuk-rewrite [text...]

Options:
  --explain              Include a short explanation of changes
  --diff                 Show a line diff between original and rewritten text
  --check                Audit text for GOV.UK style issues without rewriting
  --json                 Output JSON
  --context <text>       Service or audience context to inform the rewrite
  --mode <type>          page-body | error-message | hint-text | notification | button
  --provider <name>      openai | anthropic | openrouter
  --model <name>         Model name for the chosen provider
  --config <path>        Path to a config file
  --timeout <ms>         Request timeout in milliseconds
  --no-spinner           Disable spinner
  --no-copy              Do not auto-copy result to clipboard
  -v, --version          Show version
  -h, --help             Show help
```

## Providers and configuration

### API keys

Set the provider key using environment variables:

- OpenAI: `OPENAI_API_KEY`
- Anthropic: `ANTHROPIC_API_KEY`
- OpenRouter: `OPENROUTER_API_KEY`

### Provider/model selection

Use any combination of:

- CLI flags: `--provider`, `--model`, `--timeout`, `--config`
- Env vars: `GOVUK_REWRITE_PROVIDER`, `GOVUK_REWRITE_MODEL`, `GOVUK_REWRITE_TIMEOUT_MS`, `GOVUK_REWRITE_BASE_URL`
- Config file

Config file locations:

- macOS/Linux: `~/.config/govuk-rewrite/config.json`
- Windows: `%APPDATA%\govuk-rewrite\config.json`

You can override the file location with `--config <path>`.

### Configuration precedence

Highest to lowest:

1. CLI flags
2. Environment variables
3. Config file
4. Built-in defaults

Defaults:

- provider: `openai`
- model: `gpt-4.1-mini`
- timeoutMs: `30000`

Provider-specific default model (when provider changes and no model is explicitly set):

- `openai` -> `gpt-4.1-mini`
- `anthropic` -> `claude-3-5-sonnet-latest`
- `openrouter` -> `openai/gpt-4.1-mini`

### Custom base URLs

For compatible gateways or proxies, set:

- env var: `GOVUK_REWRITE_BASE_URL`
- or config file: `baseUrl`

Examples:

- OpenAI default: `https://api.openai.com`
- Anthropic default: `https://api.anthropic.com`
- OpenRouter default: `https://openrouter.ai/api`

## Structured provider response

All providers are normalized to a shared structure before CLI formatting:

```ts
type RewriteResult = {
  rewrittenText: string;
  explanation?: string[];
  issues?: string[];
};
```

This is true even when plain text output is requested.

## Exit codes

- `0`: success
- `1`: runtime/provider/config error
- `2`: usage error (for example: empty input or invalid CLI usage)

## Development

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Local CLI run during development:

```bash
npm run dev -- "Text to rewrite"
```

## Licence

MIT
