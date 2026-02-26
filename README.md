# govuk-rewrite

A minimal toolchain for rewriting text into GOV.UK style.

This repository now contains two workspace packages:

- `govuk-rewrite-core`: composable rewrite engine and provider adapters
- `govuk-rewrite`: CLI wrapper (one-shot mode and interactive `chat` mode)

## Packages

### `govuk-rewrite` (CLI)

Install globally:

```bash
npm install -g govuk-rewrite
```

One-shot rewrite:

```bash
govuk-rewrite "Please kindly complete the form below"
```

Explain mode:

```bash
govuk-rewrite --explain "Please kindly complete the form below"
```

Pipe input:

```bash
echo "Click here to find out more" | govuk-rewrite
```

Interactive mode:

```bash
govuk-rewrite chat
```

Interactive commands:

```text
/help
/provider <openai|anthropic|openrouter>
/model <name>
/mode <page-body|error-message|hint-text|notification|button>
/context <text>
/context clear
/explain on|off
/check on|off
/diff on|off
/json on|off
/show
/quit
```

### `govuk-rewrite-core` (Composable API)

```ts
import { rewrite } from "govuk-rewrite-core";

const result = await rewrite(
  {
    text: "Please kindly submit your application by Friday.",
    explain: true,
    mode: "page-body",
  },
  {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4.1-mini",
    timeoutMs: 30000,
  }
);

console.log(result.rewrittenText);
```

## CLI behavior

### Input resolution

1. If stdin is piped, read stdin.
2. Otherwise, use positional args.
3. If empty, print help to stderr and exit code `2`.

### Output precedence

`--json` > `--check` > `--diff` > `--explain` > plain

### Spinner

Spinner displays only when:

- stdout is a TTY
- spinner is enabled (`--no-spinner` not set)

Spinner text: `Rewriting…`

### Exit codes

- `0`: success
- `1`: runtime/provider/config error
- `2`: usage error

## Configuration

Precedence:

1. CLI flags
2. Environment variables
3. Config file
4. Defaults

Config file path:

- macOS/Linux: `~/.config/govuk-rewrite/config.json`
- Windows: `%APPDATA%\\govuk-rewrite\\config.json`

Environment variables:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENROUTER_API_KEY`
- `GOVUK_REWRITE_PROVIDER`
- `GOVUK_REWRITE_MODEL`
- `GOVUK_REWRITE_TIMEOUT_MS`
- `GOVUK_REWRITE_BASE_URL`

## Development

Install dependencies:

```bash
npm install
```

Build everything:

```bash
npm run build
```

Run all tests:

```bash
npm test
```

Run CLI in dev mode:

```bash
npm run dev -- "Text to rewrite"
```
