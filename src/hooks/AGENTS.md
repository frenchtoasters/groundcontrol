# Hooks Module
**Parent:** `../../AGENTS.md`

## Overview
Request hooks: comment checking, keyword detection, notifications, agent injection.

## Structure
```
hooks/
├── index.ts           # Hook registration
├── comment-checker/   # Validates comments (4 files)
├── keyword-detector/  # Detects special keywords (4 files)
├── directory-agents-injector/  # Injects agent context (2 files)
├── delegate-task-retry/        # Retry logic (1 file)
├── task-resume-info/           # Resume state (1 file)
├── session-notification.ts     # Session notifications
├── session-notification-utils.ts
├── session-saver.ts
└── config-handler.ts
```

## Hooks
| Hook | Purpose |
|------|---------|
| `comment-checker` | Validates request comments |
| `keyword-detector` | Finds special markers in code |
| `directory-agents-injector` | Injects AGENTS.md context |
| `delegate-task-retry` | Handles retry logic |
| `task-resume-info` | Tracks resume state |

## Conventions
- Keep hooks lightweight (run on every request)
- Use `session-notification.ts` for user feedback
- Hooks registered in `src/index.ts`

## Anti-Patterns
- NO heavy network calls in hooks
- NO blocking operations
- NO stateful caching across requests