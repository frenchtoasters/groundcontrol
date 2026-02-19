# Hooks Module
**Parent:** `../../AGENTS.md`

## Overview
Request hooks: comment checking, keyword detection, notifications, agent injection.

## Structure
```
hooks/
├── index.ts           # Hook registration
├── comment-checker/   # Validates comments
├── keyword-detector/  # Detects special keywords
├── directory-agents-injector/  # Injects agent context
├── delegate-task-retry/        # Retry logic
├── task-resume-info/           # Resume state
└── session-notification.ts     # Session notifications
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