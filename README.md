# Groundcontrol

OpenCode plugin that enforces a provider allowlist, auto-exports sessions to Markdown, and adds
delegation/background tooling, AST-grep tools, slash commands, and workflow hooks.

## Install

Use bun to install this package where you manage your opencode config (or globally if you prefer):

```bash
bun add @frenchtoastman/groundcontrol@latest
```

Then update your opencode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@frenchtoastman/groundcontrol@latest"]
}
```

## LLM-friendly install steps

1. Run `bun add @frenchtoastman/groundcontrol@latest`.
2. Open your `opencode.json` file.
3. Add `"@frenchtoastman/groundcontrol@latest"` to the `plugin` array.
4. Save the file and restart opencode.

## Features

- Background agents: delegate tasks async and poll with `background_output`.
- Delegation tools: `delegate_task`, `background_task`, `background_cancel`.
- AST-grep tools: `ast_grep_search`, `ast_grep_replace`.
- Hooks: keyword detector, comment checker, session notifications, task resume hints, delegate retry, directory agents injector.
- Slash commands: `/init-deep` and `/refactor` (via the `slashcommand` tool).
- Directory agents injector: auto-injects AGENTS.md context when reading files.
- Session markdown export and provider allowlist enforcement.

## Configuration

On first run, the plugin creates `~/.config/opencode/groundcontrol.json` with defaults:

```json
{
  "sessionLogPath": "~/.opencode/groundcontrol-sessions/",
  "allowedProviders": ["amazon-bedrock", "openai"],
  "features": {
    "backgroundAgents": { "enabled": true, "pollIntervalMs": 2000, "maxPolls": 300 }
  },
  "tools": {
    "astGrep": { "enabled": true, "maxMatches": 500, "maxOutputBytes": 1048576, "timeoutMs": 300000 },
    "delegation": { "enabled": true }
  },
  "hooks": {
    "keywordDetector": { "enabled": true },
    "commentChecker": { "enabled": true, "customPrompt": "" },
    "sessionNotification": { "enabled": true, "idleDelayMs": 10000, "sound": false },
    "taskResumeInfo": { "enabled": true },
    "delegateTaskRetry": { "enabled": true },
    "directoryAgentsInjector": { "enabled": true, "maxLines": 200 }
  },
  "commands": {
    "initDeep": { "enabled": true },
    "refactor": { "enabled": true }
  }
}
```

### sessionLogPath

Folder where Markdown exports are stored. Each session saves as `<sessionId>.md`.

### allowedProviders

Allowlist used to validate the `allowed-providers` list in your `opencode.json`. If any provider
in `allowed-providers` is not included here, OpenCode startup is blocked with a clear error.

## Slash commands in opencode.json

Add slash commands to your `opencode.json` so they are available globally:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@frenchtoastman/groundcontrol@latest"],
  "commands": {
    "init-deep": {
      "description": "Generate hierarchical AGENTS.md files",
      "tool": "slashcommand",
      "args": { "command": "/init-deep" }
    },
    "refactor": {
      "description": "Run structured refactor workflow",
      "tool": "slashcommand",
      "args": { "command": "/refactor $ARGUMENTS" }
    }
  }
}
```

## Example agents

Create `~/.config/opencode/groundcontrol-agents.json` (or merge into your main agent config):

```json
{
  "agents": {
    "background-runner": {
      "description": "Launches background tasks and polls for results.",
      "prompt": "Use delegate_task with run_in_background and poll with background_output.",
      "tools": { "delegate_task": true, "background_output": true }
    },
    "ast-grepper": {
      "description": "Uses AST-grep tools for large refactors.",
      "prompt": "Use ast_grep_search and ast_grep_replace (dryRun first).",
      "tools": { "ast_grep_search": true, "ast_grep_replace": true }
    },
    "init-deep": {
      "description": "Generates hierarchical AGENTS.md instructions.",
      "prompt": "Use slashcommand with /init-deep and follow the returned prompt.",
      "tools": { "slashcommand": true }
    },
    "refactor": {
      "description": "Runs the structured /refactor workflow.",
      "prompt": "Use slashcommand with /refactor and follow the returned prompt.",
      "tools": { "slashcommand": true }
    }
  }
}
```
