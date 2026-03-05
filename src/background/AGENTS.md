# Background Module
**Parent:** `../../AGENTS.md`

## Overview
Task polling + session management. Handles fire-and-forget background tasks, resume state.

## Files
| File | Purpose |
|------|---------|
| `manager.ts` | Task polling, session lifecycle (5921 lines) |
| `types.ts` | Task/session type definitions |

## Key Concepts
- **Poll loop**: Checks for idle status or max polls reached
- **Session state**: Preserved in `~/.groundcontrol/sessions/`
- **Background tasks**: Fire-and-return, notify on completion

## Integration Points
- `session-saver.ts` (hooks/) - saves session state
- `task-resume-info.ts` (hooks/) - tracks resume info
- `background_task` tool - fires background tasks

## Conventions
- Manager is complex - avoid adding features without tests
- Session files: JSON in `~/.groundcontrol/sessions/`
- Polling interval: configurable via `src/config.ts`

## Anti-Patterns
- NO direct file I/O in manager (use utils/)
- NO global state beyond session cache
- NO blocking in poll loop