# Utils Module
**Parent:** `../../AGENTS.md`

## Overview
Shared utilities: binary download, file ops, logging, session handling, subprocess.

## Files
| File | Purpose |
|------|---------|
| `binary-downloader.ts` | Download ast-grep binary, verify checksum |
| `fs.ts` | File system operations |
| `logger.ts` | Simple logging interface |
| `session.ts` | Session message formatting |
| `spawn.ts` | Subprocess execution with timeout |

## Usage
```typescript
import { ensureDownloadedBinary } from "./utils/binary-downloader.js"
import { spawnWithTimeout } from "./utils/spawn.js"
import { formatMessageLines } from "./utils/session.js"
```

## Conventions
- All utils are synchronous (except spawn/binary download)
- Binary downloader handles cache in `~/.cache/groundcontrol/`
- Logger uses `console` with prefix

## Anti-Patterns
- NO async/await in lightweight utilities
- NO file writes to project directory (use ~/.cache/)