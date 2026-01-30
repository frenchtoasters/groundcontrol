# Groundcontrol

OpenCode plugin that enforces a provider allowlist and auto-exports sessions to Markdown.

## Install

Use bun to install this package where you manage your opencode config (or globally if you prefer):

```bash
bun add @frenchtoasters/groundcontrol@latest
```

Then update your opencode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@frenchtoasters/groundcontrol@latest"]
}
```

## LLM-friendly install steps

1. Run `bun add @frenchtoasters/groundcontrol@latest`.
2. Open your `opencode.json` file.
3. Add `"@frenchtoasters/groundcontrol@latest"` to the `plugin` array.
4. Save the file and restart opencode.

## Configuration

On first run, the plugin creates `~/.config/opencode/groundcontrol.json` with defaults:

```json
{
  "sessionLogPath": "~/.opencode/groundcontrol-sessions/",
  "allowedProviders": ["amazon-bedrock", "openai"]
}
```

### sessionLogPath

Folder where Markdown exports are stored. Each session saves as `<sessionId>.md`.

### allowedProviders

Allowlist used to validate the `allowed-providers` list in your `opencode.json`. If any provider
in `allowed-providers` is not included here, OpenCode startup is blocked with a clear error.
