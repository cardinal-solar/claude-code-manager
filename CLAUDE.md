# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A TypeScript library for programmatically managing Claude Code processes. Provides two execution modes: **single-shot** (one task with validated structured output) and **loop** (iterating through a PRD of user stories, Ralph-style). Spawns `claude` CLI as a child process, passes prompts with JSON Schema constraints, and validates output via Zod.

## Commands

| Command | Purpose |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` via `tsc` |
| `npm test` | Run Vitest in watch mode |
| `npx vitest run` | Run all tests once (CI-friendly) |
| `npx vitest run tests/ralph/prd.test.ts` | Run a single test file |
| `npx vitest run -t "test name"` | Run a single test by name |
| `npm run lint` | ESLint on `src/` |

## Architecture

```
ClaudeCodeManager (src/manager.ts) — Public facade
├── SingleShotExecutor (src/executors/single-shot.ts)
│   ├── FileManager (src/files/file-manager.ts) — temp dirs, instructions/schema JSON
│   ├── SchemaValidator (src/validation/schema.ts) — Zod ↔ JSON Schema conversion
│   └── ProcessRunner (src/process/runner.ts) — child_process.spawn wrapper
└── LoopExecutor (src/executors/loop.ts)
    ├── SingleShotExecutor (reused per iteration)
    ├── PRD (src/ralph/prd.ts) — load/save PRD JSON, track user stories
    └── ProgressTracker (src/ralph/progress.ts) — markdown progress log
```

**Layering:** Types/Errors → Utilities (FileManager, SchemaValidator, ProcessRunner, PRD, ProgressTracker) → Executors → Manager facade → `index.ts` re-exports.

**Single-shot flow:** `manager.execute()` → creates temp dir with `instructions.json` + `schema.json` → spawns `claude --print --output-format json --json-schema <schema>` → parses stdout JSON → validates `structured_output` against Zod schema → returns typed `ExecuteResult<T>`.

**Loop flow:** `manager.executeLoop()` → loads PRD → iterates incomplete stories by priority → delegates each to SingleShotExecutor with inline schema → marks story complete on success → appends to progress file.

## Key Conventions

- **Facade pattern**: Users interact only with `ClaudeCodeManager`; never instantiate executors directly
- **File naming**: kebab-case for files, PascalCase for classes, camelCase for methods/variables
- **Error hierarchy**: All errors extend `ClaudeCodeError` (in `src/errors/index.ts`) with a `code` string and optional `details`
- **Test structure**: Tests mirror source layout under `tests/`. Tests use real filesystem operations (temp dirs via `os.tmpdir()`). No mocking framework — tests rely on real I/O or simple substitution
- **Lifecycle hooks**: `beforeExecute`, `afterExecute`, `beforeIteration`, `afterIteration` on the manager config
- **CommonJS output**: TypeScript compiles to CommonJS targeting ES2020 with declaration files

## Incomplete Features

These are defined in types but not yet implemented:
- `retry`, `graceful`, and `custom` error strategies (only `fail-fast` works)
- `onOutput` streaming callback (declared but never wired)
- `RRD` class for research mode (types exist, no implementation)
- Git auto-commit in loop executor (`commits` field is always empty)
