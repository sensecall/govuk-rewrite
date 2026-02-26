# govuk-rewrite-cli

A minimal CLI that rewrites text into GOV.UK-style content. Supports one-shot rewrites, piped input, and an interactive chat mode.

## Install

```bash
npm install -g govuk-rewrite-cli
```

## Quick start

```bash
govuk-rewrite setup
govuk-rewrite "Please kindly complete the form below"
# Complete the form below.
```

## Commands

### One-shot rewrite

```bash
govuk-rewrite "Please kindly complete the form below"
```

### Piped input

```bash
echo "Click here to find out more" | govuk-rewrite
cat content.txt | govuk-rewrite
```

### Flags

| Flag | Description |
|---|---|
| `--explain` | Print short explanation bullets after the rewrite |
| `--check` | Check for style issues without rewriting |
| `--diff` | Show a line diff of changes |
| `--json` | Output structured JSON |
| `--provider` | Override provider (`openai`, `anthropic`, `openrouter`) |
| `--model` | Override model name |
| `--mode` | Content type hint (see below) |
| `--context` | Additional context for the rewrite |
| `--no-spinner` | Suppress the spinner |
| `--copy` | Copy rewritten text to clipboard |

### Content modes

```bash
govuk-rewrite --mode error-message "Please enter a valid date"
```

Available modes: `page-body`, `error-message`, `hint-text`, `notification`, `button`

### Interactive chat

```bash
govuk-rewrite chat
```

Stays open until `/quit` or `Ctrl+C`. Paste text to rewrite, use `/help` for shortcuts.

Chat commands:

```
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

Chat shortcuts:

```
Ctrl+C / Ctrl+D   Exit
Ctrl+L            Clear transcript
?                 Toggle shortcut help
```

### Setup wizard

```bash
govuk-rewrite setup
```

Writes provider, model, and timeout settings to your config file. API keys are never stored — the wizard prints the exact `export` command to add to your shell profile.

## Configuration

Precedence: CLI flags > environment variables > config file > defaults.

**Config file location**

- macOS/Linux: `~/.config/govuk-rewrite/config.json`
- Windows: `%APPDATA%\govuk-rewrite\config.json`

**Environment variables**

```bash
OPENAI_API_KEY
ANTHROPIC_API_KEY
OPENROUTER_API_KEY
GOVUK_REWRITE_PROVIDER
GOVUK_REWRITE_MODEL
GOVUK_REWRITE_TIMEOUT_MS
GOVUK_REWRITE_BASE_URL
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Runtime / provider / config error |
| `2` | Usage error |

## Library

If you want to use the rewrite engine directly in your own code, install [`govuk-rewrite`](https://www.npmjs.com/package/govuk-rewrite) instead.

## Repository

[github.com/sensecall/govuk-rewrite](https://github.com/sensecall/govuk-rewrite)
