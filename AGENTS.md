# Groundcontrol Agent Guide

## Purpose
This repo ships an OpenCode plugin implemented in TypeScript (ESM).
Use this file as the single source of truth for build commands and code style.

## Repository Rules
- Cursor rules: none found in `.cursor/rules/` or `.cursorrules`.
- Copilot rules: none found in `.github/copilot-instructions.md`.

## Quick Commands
Run commands from the repo root unless noted otherwise.

### Build
- `bun run build` (tsc -p tsconfig.json)
- `tsc -p tsconfig.json` (direct TypeScript build)

### Clean
- `bun run clean` (rm -rf dist)

### Lint
- No lint script or config in this repo.
- If you add linting, document the command here.

### Tests
- No test runner configured; no test scripts present.
- There is no single-test command defined.
- If you add tests, include a single-test example like:
  `bun test path/to/test.ts -t "case name"`

## Runtime / Packaging Notes
- Package name: `@frenchtoastman/groundcontrol`.
- Builds emit to `dist/` and export `./dist/index.js`.
- ESM only (`"type": "module"`).

## Source Layout
- `src/index.ts` registers tools and hooks.
- `src/config.ts` defines config schema and defaults.
- `src/background/` manages background tasks and polling.
- `src/tools/` defines tool implementations (AST-grep, delegation).
- `src/hooks/` registers hook logic (comment checker, notifications, etc.).

## Configuration Files
- `opencode.json` enables the plugin via the `plugin` array.
- `~/.config/opencode/groundcontrol.json` stores plugin defaults.
- `enabled_providers` in opencode config is validated against
  `allowedProviders` in groundcontrol config.

## TypeScript / Build Conventions
- TypeScript target: ES2022.
- Module system: NodeNext (ESM).
- Strict mode enabled; avoid `any` unless required by external APIs.
- Use `node:` prefix for built-in modules (e.g., `node:path`).
- Prefer `type` aliases for object shapes and discriminated unions.

## Formatting Conventions
- Two-space indentation.
- Double quotes for strings.
- No semicolons.
- Trailing commas on multiline literals.
- Keep lines reasonably short; wrap long objects vertically.

## Imports
- Group imports by source: built-ins, external deps, internal modules.
- Built-ins should use `node:` specifiers.
- Prefer named imports over default where possible.
- Use explicit `.js` extensions in internal imports (ESM output).

## Naming Conventions
- Files: lowercase with hyphens for folders (e.g., `background/manager.ts`).
- Types: PascalCase (`BackgroundTaskManager`).
- Functions/vars: camelCase (`loadGroundcontrolConfig`).
- Constants: UPPER_SNAKE for module-level constants (`DEFAULT_CONFIG`).
- Tools: snake_case names exposed to OpenCode (`background_task`).

## Error Handling
- Use `try/catch` around IO and network boundaries.
- Surface errors via plugin logs when available.
- Prefer returning safe fallbacks over throwing in non-critical paths.
- Throw for configuration violations that must halt startup.

## Async Patterns
- Prefer `async/await` over raw Promises.
- Avoid unhandled promise rejections; use `void` only when safe.
- Polling logic should respect configured intervals and max limits.

## Configuration Handling
- Default config is created if missing.
- Merging should be type-safe and normalization-based.
- Preserve user overrides; never delete unknown keys in config files.

## Plugin Behavior Guidelines
- Keep hooks lightweight; avoid blocking the main thread.
- Avoid heavy network calls during startup unless required.
- Ensure tool names are stable for downstream clients.
- Do not introduce new tools without updating README and this file.

## Logging
- Use `client.app.log` with service name `groundcontrol`.
- Log warnings for recoverable failures (e.g., session export).
- Avoid noisy debug logs in normal operation.

## File IO
- Use `fs/promises` for async filesystem access.
- Expand `~` in paths via helper utilities.
- Ensure directories exist before writing files.

## AST-grep Tooling
- AST-grep tools are guarded by config toggles.
- Respect max matches, output size, and timeouts.
- Prefer dry-run mode in replacements when exposing examples.

## Background Tasking
- Background tasks are tied to sessions.
- Polling ends when sessions are idle or max polls reached.
- Track subagent session IDs for resume/status tools.

## Security / Safety
- Never write secrets to disk or logs.
- Do not commit tokens or credentials.
- Validate provider allowlists before starting.

## Documentation Updates
- If behavior changes, update `README.md` and this file.
- Keep examples consistent with defaults in `src/config.ts`.

## When Adding Tests (future guidance)
- Add a test script to `package.json`.
- Document how to run the full suite and a single test here.
- Prefer a fast unit test runner compatible with Bun.

## Release Checklist (for maintainers)
- `bun run clean`
- `bun run build`
- Verify `dist/` exports align with `package.json`.
- Update version and changelog if present.

## Agent Behavior Notes
- This repo is ESM and TypeScript strict; avoid CommonJS patterns.
- Do not add lint/test configs without updating this file.
- Favor small, composable utilities; avoid deep inheritance.
- Keep public tool and hook names stable.
