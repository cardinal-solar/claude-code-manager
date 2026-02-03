# Claude Code Manager - Design Document

**Date:** 2026-02-03
**Status:** Ready for Implementation

## Overview

A Node.js library for programmatically managing Claude Code processes, supporting both single-shot execution and Ralph-compatible loop-based task completion.

## Core Requirements

- **Dual execution modes**: Single-shot and loop-based (Ralph-compatible)
- **Schema validation**: Zod integration for type-safe output validation
- **Structured output**: Organized temp directories with result.json, logs, artifacts
- **Skill-based bridge**: Claude Code skill to handle structured I/O
- **Error handling**: Configurable strategies (fail-fast, retry, graceful, custom)
- **Process control**: Adaptive - simple for single-shot, full control for loops
- **Ralph compatibility**: Full support for prd.json/rrd.json workflows
- **Streaming**: Real-time output and cancellation support
- **Cleanup**: Flexible temp file management strategies

---

## Architecture

### 1. High-Level Components

```
┌─────────────────────────────────────┐
│   ClaudeCodeManager (Main API)     │
├─────────────────────────────────────┤
│ - execute(options)                  │
│ - executeLoop(options)              │
│ - createPRD() / createRRD()         │
│ - installSkills()                   │
└─────────────────────────────────────┘
           │
           ├──────────┬──────────┬──────────┬──────────┐
           │          │          │          │          │
      ┌────▼───┐ ┌───▼────┐ ┌──▼──────┐ ┌─▼────┐ ┌──▼──────┐
      │Single  │ │Loop    │ │Process  │ │File  │ │Ralph    │
      │Shot    │ │Executor│ │Runner   │ │Mgr   │ │Utils    │
      │Executor│ │        │ │         │ │      │ │         │
      └────────┘ └────────┘ └─────────┘ └──────┘ └─────────┘
```

### 2. Package Structure

```
claude-code-manager/
├── src/
│   ├── index.ts                    # Main exports
│   ├── manager.ts                  # ClaudeCodeManager class
│   ├── executors/
│   │   ├── single-shot.ts          # Single-shot executor
│   │   └── loop.ts                 # Loop executor (Ralph-compatible)
│   ├── process/
│   │   ├── runner.ts               # Process spawning & control
│   │   └── cancel-token.ts         # Cancellation support
│   ├── files/
│   │   ├── file-manager.ts         # File operations
│   │   └── cleanup.ts              # Cleanup strategies
│   ├── ralph/
│   │   ├── prd.ts                  # PRD utilities
│   │   ├── rrd.ts                  # RRD utilities
│   │   └── progress.ts             # Progress tracking
│   ├── validation/
│   │   ├── schema.ts               # Zod integration
│   │   └── validator.ts            # Result validation
│   ├── errors/
│   │   └── index.ts                # Custom error classes
│   └── skills/
│       ├── installer.ts            # Skill installation
│       └── templates/
│           ├── execute-task.md     # Main skill
│           └── validate-output.md  # Validation helper
├── examples/
│   ├── single-shot.ts
│   ├── loop-basic.ts
│   └── loop-advanced.ts
└── tests/
    ├── unit/
    └── integration/
```

---

## API Design

### Main Manager

```typescript
interface ClaudeCodeManagerConfig {
  claudeCodePath?: string;           // Default: 'claude'
  workingDir?: string;                // Default: process.cwd()
  tempDir?: string;                   // Default: os.tmpdir()
  skillsDir?: string;                 // Where to install skills
  cleanupOnExit?: boolean;            // Default: true
  globalTimeout?: number;             // Overall timeout in ms
  hooks?: LifecycleHooks;             // Lifecycle event handlers
}

class ClaudeCodeManager {
  constructor(config?: ClaudeCodeManagerConfig);

  // Single-shot execution
  execute<T extends z.ZodType>(options: ExecuteOptions<T>): Promise<ExecuteResult<T>>;

  // Loop execution (Ralph-compatible)
  executeLoop(options: ExecuteLoopOptions): Promise<LoopResult>;

  // Task file utilities
  createPRD(spec: PRDSpec): PRD;
  createRRD(spec: RRDSpec): RRD;
  readPRD(path: string): Promise<PRD>;
  readRRD(path: string): Promise<RRD>;

  // Progress utilities
  readProgress(path: string): Promise<ProgressLog>;
  appendProgress(path: string, entry: ProgressEntry): Promise<void>;

  // Skill management
  static installSkills(): Promise<void>;

  // Cleanup
  cleanup(taskDir: string): Promise<void>;
  cleanupOldTasks(options: { olderThanDays: number }): Promise<void>;
}
```

### Single-Shot Execution

```typescript
interface ExecuteOptions<T extends z.ZodType> {
  prompt: string;                     // The task prompt
  variables?: Record<string, any>;    // Template variables
  schema: T;                          // Zod schema for validation
  mode?: 'single';                    // Execution mode
  timeout?: number;                   // Task timeout in ms
  errorStrategy?: ErrorStrategy;      // Error handling config
  onOutput?: (chunk: string) => void; // Optional output streaming
  permissions?: string[];             // Claude Code permissions to grant
}

interface ExecuteResult<T> {
  success: boolean;
  data?: z.infer<T>;                 // Validated result
  outputDir: string;                  // Temp directory path
  logs: string;                       // Full log output
  artifacts?: string[];               // Paths to generated files
  duration: number;                   // Execution time in ms
  error?: Error;                      // If failed
}
```

### Loop Execution (Ralph-Compatible)

```typescript
interface ExecuteLoopOptions {
  taskFile: string;                   // prd.json or rrd.json path
  maxIterations?: number;             // Default: 10
  mode?: 'code' | 'research' | 'auto'; // Auto-detects from file
  progressFile?: string;              // Default: progress.txt
  onIteration?: (iteration: IterationResult) => void;
  errorStrategy?: ErrorStrategy;
  streamOutput?: boolean;             // Default: true for loop
  permissions?: string[];             // Auto-granted permissions
  ralphOptions?: RalphOptions;        // Ralph-specific config
  cancelToken?: CancellationToken;    // Cancellation support
  processOptions?: ProcessOptions;    // Resource limits
}

interface LoopResult {
  success: boolean;
  completed: boolean;                 // All tasks done?
  iterations: IterationResult[];
  totalDuration: number;
  finalState: TaskState;              // Final prd.json/rrd.json state
  progressLog: string;                // Contents of progress.txt
}

interface IterationResult {
  iteration: number;
  taskId: string;                     // Story/task ID worked on
  success: boolean;
  commits?: string[];                 // Git commits (code mode)
  findings?: string[];                // Findings files (research mode)
  duration: number;
  error?: Error;
}
```

### Error Handling

```typescript
interface ErrorStrategy {
  mode: 'fail-fast' | 'retry' | 'graceful' | 'custom';
  maxAttempts?: number;               // For retry mode
  backoffMs?: number;                 // Initial backoff delay
  backoffMultiplier?: number;         // Exponential backoff
  onError?: (error: Error, attempt: number) => void | Promise<void>;
  shouldRetry?: (error: Error) => boolean; // Custom retry logic
  defaultValue?: any;                 // For graceful mode
  handler?: (fn: () => Promise<any>) => Promise<any>; // Custom handler
}

// Custom error classes
class ClaudeCodeError extends Error {
  code: string;
  details?: any;
}

class ValidationError extends ClaudeCodeError {
  zodError: z.ZodError;
}

class ProcessTimeoutError extends ClaudeCodeError {
  timeoutMs: number;
}

class TaskIncompleteError extends ClaudeCodeError {
  completedTasks: number;
  totalTasks: number;
}
```

---

## File Structure

### Single-Shot Temp Directory

```
/tmp/claude-tasks/task-{uuid}/
├── instructions.json      # Task specification
├── schema.json           # Zod schema (serialized to JSON Schema)
├── variables.json        # Template variables
├── prompt.md             # Generated prompt for Claude
├── result.json           # Claude's validated output
├── logs.txt              # Execution logs
└── artifacts/            # Generated files
    ├── file1.ts
    └── file2.tsx
```

### Loop Execution (Code Mode)

```
/project/root/
├── prd.json              # Task definitions
├── progress.txt          # Progress log
├── .claude-tasks/        # Hidden temp directory
│   └── iteration-{n}/
│       ├── prompt.md
│       ├── logs.txt
│       └── output.txt
└── src/                  # Git commits happen here
```

### Loop Execution (Research Mode)

```
/project/root/
├── rrd.json              # Research task definitions
├── progress.txt          # Progress log
├── findings/             # Research outputs
│   ├── rt-001-market.md
│   └── rt-002-competition.md
└── reports/              # Final reports
    └── final-report.md
```

---

## Claude Code Skill

### Skill Installation

The library installs a skill at `~/.claude/skills/claude-code-manager/` that bridges Node.js and Claude Code.

### Skill Structure

```markdown
---
name: execute-task
description: Execute a structured task with validated JSON output
---

# Task Execution with Structured Output

You are executing a task that requires structured, validated output.

## Instructions

1. Read task details from `instructions.json` in the working directory
2. Read the Zod schema from `schema.json` for output structure
3. Read template variables from `variables.json`
4. Execute the task described in the prompt
5. Write your result to `result.json` matching the provided schema
6. Write execution logs to `logs.txt`
7. Save any generated files to `artifacts/` directory
8. Validate your output before finishing

## Output Format

Your `result.json` must validate against the Zod schema provided.

## Completion

When done, ensure:
- result.json exists and validates
- logs.txt contains execution details
- artifacts/ has any generated files
```

### Prompt Generation

The library generates a prompt combining:
1. User's task prompt with variable substitution
2. Schema requirements from Zod
3. Output directory instructions
4. Skill invocation

Example generated prompt:
```markdown
You are executing a task with structured output requirements.

Task: Create a {{framework}} component for {{feature}}.

Variables:
- framework: React
- feature: user authentication
- styling: Tailwind CSS

Output Requirements:
- Write result to: /tmp/claude-task-abc123/result.json
- Validate against schema in: /tmp/claude-task-abc123/schema.json
- Write logs to: /tmp/claude-task-abc123/logs.txt
- Save any artifacts to: /tmp/claude-task-abc123/artifacts/

Schema (JSON Schema format):
{...schema...}

Use the /execute-task skill to handle structured output.
```

---

## Process Management

### Single-Shot Process

Simple spawn and wait:
```typescript
spawn('claude', ['--dangerously-skip-permissions', '--print'], {
  cwd: workingDir,
  timeout: timeout
});
```

### Loop Process

Full control with streaming:
```typescript
const process = spawn('claude', [...args], options);

// Stream output
process.stdout.on('data', (chunk) => {
  onOutput?.(chunk.toString());

  // Detect completion
  if (chunk.includes('<promise>COMPLETE</promise>')) {
    completionDetected = true;
  }
});

// Handle cancellation
cancelToken?.onCancel(() => process.kill('SIGTERM'));
```

### Resource Management

```typescript
interface ProcessOptions {
  timeout?: number;              // Per-iteration timeout
  maxMemoryMB?: number;          // Memory limit
  killSignal?: NodeJS.Signals;   // Default: SIGTERM
  cleanupOnError?: boolean;      // Clean temp files on error
}
```

---

## Ralph Integration

### Task File Formats

**PRD (Code Mode)**
```json
{
  "project": "User Dashboard",
  "branchName": "ralph/user-dashboard",
  "description": "Build user management dashboard",
  "userStories": [
    {
      "id": "US-001",
      "title": "Create user list component",
      "description": "Display paginated user list",
      "acceptanceCriteria": ["..."],
      "priority": 1,
      "estimatedComplexity": 3,
      "passes": false
    }
  ]
}
```

**RRD (Research Mode)**
```json
{
  "project": "Market Analysis",
  "taskType": "research",
  "outputFile": "reports/market-analysis.md",
  "researchTasks": [
    {
      "id": "RT-001",
      "title": "Market sizing",
      "description": "Calculate TAM/SAM/SOM",
      "methodology": "Web research",
      "acceptanceCriteria": ["..."],
      "outputFile": "findings/rt-001.md",
      "priority": 1,
      "completed": false
    }
  ]
}
```

### Progress Tracking

Appends to `progress.txt`:
```markdown
## 2026-02-03 14:30 - US-001
- Implemented user list component
- Files changed: src/components/UserList.tsx, src/api/users.ts
- **Learnings for future iterations:**
  - This codebase uses React Query for data fetching
  - Tests require msw for API mocking
---
```

### Completion Detection

Loop exits when:
- **Code Mode**: All userStories have `passes: true`
- **Research Mode**: All researchTasks have `completed: true`
- Claude outputs `<promise>COMPLETE</promise>`

---

## Cleanup Strategy

```typescript
interface CleanupOptions {
  strategy: 'immediate' | 'on-success' | 'on-exit' | 'manual';
  keepOnError?: boolean;        // Preserve for debugging
  maxAgeDays?: number;          // Auto-cleanup old tasks
  preserveArtifacts?: boolean;  // Keep artifacts, delete temp files
}
```

**Strategies:**
- **immediate**: Clean after each execution
- **on-success**: Clean only successful executions
- **on-exit**: Clean when process exits
- **manual**: User controls cleanup

---

## Example Usage

### Single-Shot

```typescript
import { ClaudeCodeManager } from 'claude-code-manager';
import { z } from 'zod';

const manager = new ClaudeCodeManager();

const schema = z.object({
  code: z.string(),
  tests: z.array(z.string()),
  dependencies: z.array(z.string())
});

const result = await manager.execute({
  prompt: 'Create a React UserCard component',
  variables: { styling: 'tailwind' },
  schema,
  onOutput: (chunk) => process.stdout.write(chunk)
});

console.log('Component:', result.data.code);
```

### Loop Execution

```typescript
const result = await manager.executeLoop({
  taskFile: './prd.json',
  maxIterations: 10,
  onIteration: (iter) => {
    console.log(`Iteration ${iter.iteration}: ${iter.taskId}`);
  }
});

if (result.completed) {
  console.log('All tasks completed!');
}
```

### Ralph-Compatible

```typescript
// Create PRD
const prd = manager.createPRD({
  project: 'Dashboard',
  branchName: 'ralph/dashboard',
  userStories: [...]
});
await prd.save('./prd.json');

// Run loop
const result = await manager.executeLoop({
  taskFile: './prd.json',
  ralphOptions: {
    gitAutoCommit: true,
    branchAutoCreate: true,
    archiveOnComplete: true
  }
});
```

---

## Dependencies

```json
{
  "dependencies": {
    "zod": "^3.22.4",
    "zod-to-json-schema": "^3.22.4",
    "uuid": "^9.0.1"
  },
  "peerDependencies": {
    "@anthropic-ai/claude-code": ">=0.5.0"
  }
}
```

---

## Testing Strategy

### Unit Tests
- Manager configuration and initialization
- Single-shot execution with validation
- Loop execution logic
- Error handling strategies
- File management and cleanup
- Ralph task file utilities

### Integration Tests
- End-to-end single-shot execution
- Complete loop execution with PRD
- Research mode with RRD
- Error recovery and retry
- Cancellation and timeouts
- Skill installation

---

## Implementation Phases

### Phase 1: Core Foundation
- Project setup (TypeScript, build config)
- Manager class structure
- File management system
- Error handling framework

### Phase 2: Single-Shot Execution
- SingleShotExecutor implementation
- Process runner (basic)
- Zod schema integration
- Skill templates

### Phase 3: Loop Execution
- LoopExecutor implementation
- Ralph task file utilities (PRD/RRD)
- Progress tracking
- Completion detection

### Phase 4: Advanced Features
- Full process control (streaming, cancellation)
- Error retry strategies
- Lifecycle hooks
- State persistence

### Phase 5: Polish
- Comprehensive testing
- Documentation and examples
- Skill installer
- Package publishing

---

## Success Criteria

✅ Single-shot execution returns validated Zod results
✅ Loop mode completes all PRD stories
✅ Research mode generates findings and reports
✅ Error strategies work correctly (retry, graceful, fail-fast)
✅ Streaming and cancellation functional
✅ Ralph compatibility verified
✅ Skills auto-install on first run
✅ Cleanup strategies work as configured
✅ Full TypeScript type safety
✅ Comprehensive test coverage (>80%)

---

## Future Enhancements

- **Parallel execution**: Run multiple tasks concurrently
- **State persistence**: Resume interrupted loops
- **Metrics and observability**: Detailed execution metrics
- **Custom validators**: Beyond Zod (e.g., custom validation functions)
- **Browser automation**: Integration with Playwright for UI verification
- **MCP integration**: Use MCP tools within tasks
- **Template library**: Pre-built task templates
- **CLI tool**: Command-line interface for quick execution
