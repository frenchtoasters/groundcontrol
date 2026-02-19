# Tools Module
**Parent:** `../../AGENTS.md`

## Overview
Tool implementations exposed to OpenCode (AST-grep, background tasks, delegation).

## Structure
```
tools/
├── index.ts          # Tool registration
├── ast-grep/         # AST search/replace tools
│   ├── cli.ts        # Binary runner
│   ├── downloader.ts # Binary download
│   └── tools.ts      # ast_grep_search, ast_grep_replace
├── background-task/  # background_task tool
└── delegate-task/    # Subagent delegation
```

## Key Tools
| Tool | File | Purpose |
|------|------|---------|
| `ast_grep_search` | `ast-grep/tools.ts` | AST-aware code search |
| `ast_grep_replace` | `ast-grep/tools.ts` | AST-aware code rewrite |
| `background_task` | `background-task/` | Fire-and-forget tasks |
| `delegate_task` | `delegate-task/` | Subagent delegation |

## Conventions
- Tool names: snake_case (e.g., `background_task`)
- Guard tools with config toggles in `src/config.ts`
- Respect max_matches, output size, timeouts
- Prefer dry-run for replacements

## Anti-Patterns
- NO CommonJS in tool files
- NO heavy sync operations
- NO blocking calls in tool handlers