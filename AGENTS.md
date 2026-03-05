# Groundcontrol Agent Guide
**Generated:** 2026-03-04
**Commit:** d4901e7
**Branch:** main

## Overview
OpenCode plugin: AST-grep tools, background tasking, comment/notification hooks. TypeScript ESM.

## Structure
```
src/
├── index.ts          # Entry: registers tools/hooks
├── config.ts         # Config schema + defaults
├── tools/            # Tool implementations (4 subdirs)
├── hooks/            # Hook logic (6 subdirs)
├── background/       # Task polling + session mgmt
├── utils/            # Shared utilities (5 files)
└── commands/         # Slash command handlers
```

## Where To Look
| Task | Location |
|------|----------|
| Add tool | `src/tools/` + `src/index.ts` |
| Add hook | `src/hooks/` + `src/index.ts` |
| Config | `src/config.ts` |
| Background tasks | `src/background/manager.ts` |
| Utils | `src/utils/` |

## Conventions (Deviations Only)
- **No semicolons** in source
- **Two-space** indentation
- **`.js` extensions** in ESM imports
- **`node:` prefix** for built-ins
- **snake_case** for tool names exposed to OpenCode

## Anti-Patterns (This Project)
- NO CommonJS patterns (ESM only)
- NO `any` unless required by external API
- NO lint/test configs (not configured)
- NO secrets in logs or disk

## Commands
```bash
bun run build    # tsc -p tsconfig.json
bun run clean    # rm -rf dist
```

## Notes
- `dist/` is auto-generated; edit only `src/`
- Hooks run on every request; keep lightweight
- Background tasks poll until idle or max polls reached