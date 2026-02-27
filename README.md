# govuk-rewrite

A minimal toolchain for rewriting text into GOV.UK style.

This repository now contains two workspace packages:

- `@sensecall/govuk-rewrite`: composable rewrite engine and provider adapters
- `@sensecall/govuk-rewrite-cli`: CLI wrapper (one-shot mode and interactive `chat` mode)

## Packages

### `@sensecall/govuk-rewrite-cli` (CLI)

Install globally:

```bash
npm install -g @sensecall/govuk-rewrite-cli
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

First-time setup wizard:

```bash
govuk-rewrite setup
```

Interactive mode:

```bash
govuk-rewrite chat
```

Chat stays open until you run `/quit` or use `Ctrl+C` when the composer is empty.
The composer uses a Codex-style prompt with placeholder text (`Paste text to rewrite`) and a hint row (`? for shortcuts`).
Paste multiline content, then press `Enter` to send it.
The composer remains single-line and switches to a clear `PASTE READY` state with:
- explicit actions (`Enter` to send, `Ctrl+C` to clear)
- an unsent preview of the first 2 lines
- a `+N more lines` summary when applicable
When the rewritten text matches your input (after trim/newline normalization), chat adds a subtle system note indicating no improvement is needed.

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
/tokens on|off
/show
/quit
```

Chat shortcuts:

```text
Ctrl+C            Clear input (or exit if empty)
?                 Toggle shortcut help
```

### Setup flow

- `govuk-rewrite setup` runs an interactive wizard.
- The wizard writes provider/model/timeout/baseUrl to your config file.
- API keys are never written to config files.
- The wizard prints the exact `export ...` command for your selected provider key.
- Optional verification can run a small live request before finishing.

Auto-prompt behavior:

- In one-shot and `chat` modes, if the API key is missing and both stdin/stdout are TTY, the CLI asks:
  - `No API key found. Run setup now? [Y/n]`
- In Ink chat, setup prompts are shown inline in the composer.
- In non-interactive contexts (for example pipes), auto-prompting is disabled.

### `@sensecall/govuk-rewrite` (Composable API)

```ts
import { rewrite } from "@sensecall/govuk-rewrite";

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

Output details:

- Plain mode prints rewritten text only.
- `--explain` prepends a bullet when no change is needed:
  - `No improvement suggested. The text already aligns with GOV.UK style.`
- `--json` includes `noImprovement: boolean` metadata.

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
