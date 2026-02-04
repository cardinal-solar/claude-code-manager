# Claude Code Manager

[![npm version](https://badge.fury.io/js/claude-code-manager.svg)](https://badge.fury.io/js/claude-code-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/claude-code-manager.svg)](https://nodejs.org)

A Node.js library for programmatically managing Claude Code processes with single-shot execution, Ralph-compatible loops, and **background job polling** for long-running operations.

## Features

- **Three Execution Modes**:
  - **Single-shot**: One-off task execution with structured output
  - **Loop (Ralph-compatible)**: Iterative execution through PRD/RRD task files
  - **Background Jobs**: Non-blocking execution with polling for long-running operations
- **Schema Validation**: Zod integration for type-safe output validation
- **Job Polling System**: Start jobs without blocking, poll for status - ideal for job schedulers
- **Progress Tracking**: Real-time progress updates for loop and background jobs
- **Error Handling**: Configurable strategies (fail-fast, retry, graceful, custom)
- **Persistence**: Optional file-based job state for crash recovery
- **TypeScript-First**: Full type safety and IntelliSense support

## Installation

```bash
npm install claude-code-manager
```

### Prerequisites

Claude Code CLI must be installed and configured:

```bash
npm install -g @anthropic-ai/claude-code
```

## Quick Start

### Single-Shot Execution

Execute a single task and get structured output:

```typescript
import { ClaudeCodeManager } from 'claude-code-manager';
import { z } from 'zod';

const manager = new ClaudeCodeManager();

// Define the expected output schema
const schema = z.object({
  code: z.string(),
  explanation: z.string(),
  tests: z.array(z.string())
});

const result = await manager.execute({
  prompt: 'Create a TypeScript function that validates email addresses',
  schema
});

if (result.success) {
  console.log('Code:', result.data.code);
  console.log('Explanation:', result.data.explanation);
}
```

### Loop Execution (Ralph-Compatible)

Execute multiple tasks from a PRD file:

```typescript
const result = await manager.executeLoop({
  taskFile: './prd.json',
  maxIterations: 10,
  progressFile: './progress.txt',
  onIteration: (iter) => {
    console.log(`Completed: ${iter.taskId} (${iter.success ? 'passed' : 'failed'})`);
  }
});

console.log(`Completed ${result.finalState.tasksCompleted}/${result.finalState.tasksTotal} tasks`);
```

### Background Job Polling (New!)

For long-running operations, use background jobs to avoid blocking Node.js threads:

```typescript
import { ClaudeCodeManager } from 'claude-code-manager';

// Enable job management
const manager = new ClaudeCodeManager(
  { claudeCodePath: 'claude' },
  { enableJobs: true, persistToFile: true }
);

// Start a job - returns immediately with job ID
const jobId = await manager.startLoopJob({
  taskFile: './prd.json',
  maxIterations: 100
});

console.log(`Job started: ${jobId}`);

// Poll for status (e.g., from a cron job or scheduler)
const checkStatus = async () => {
  const status = await manager.pollJob(jobId);

  console.log(`Status: ${status.status}`);
  console.log(`Progress: ${status.progress?.tasksCompleted}/${status.progress?.tasksTotal}`);

  if (status.finished) {
    console.log('Result:', status.result);
    return true;
  }
  return false;
};

// Poll every 5 seconds until done
const interval = setInterval(async () => {
  if (await checkStatus()) {
    clearInterval(interval);
    manager.close();
  }
}, 5000);
```

## API Reference

### ClaudeCodeManager

The main class for managing Claude Code executions.

#### Constructor

```typescript
const manager = new ClaudeCodeManager(config?, jobOptions?);
```

**Config Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `claudeCodePath` | `string` | `'claude'` | Path to Claude Code CLI |
| `workingDir` | `string` | `process.cwd()` | Working directory for executions |
| `tempDir` | `string` | `os.tmpdir()` | Directory for temporary files |
| `cleanupOnExit` | `boolean` | `true` | Clean up temp files on exit |
| `globalTimeout` | `number` | - | Global timeout in milliseconds |
| `hooks` | `LifecycleHooks` | - | Lifecycle event hooks |

**Job Options (for background jobs):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableJobs` | `boolean` | `false` | Enable job management features |
| `persistToFile` | `boolean` | `false` | Persist job state to disk |
| `storeDir` | `string` | `./.claude-jobs` | Directory for job state files |
| `maxJobAge` | `number` | `86400000` | Max age for completed jobs (ms) |
| `maxConcurrentJobs` | `number` | `Infinity` | Max parallel jobs |

#### Methods

##### Synchronous Execution

```typescript
// Single task execution
execute<T>(options: ExecuteOptions<T>): Promise<ExecuteResult<T>>

// Loop execution (Ralph-compatible)
executeLoop(options: ExecuteLoopOptions): Promise<LoopResult>
```

##### Background Job Methods

```typescript
// Start a single-shot job (non-blocking)
startJob<T>(options: ExecuteOptions<T>, startOptions?): Promise<string>

// Start a loop job (non-blocking)
startLoopJob(options: ExecuteLoopOptions, startOptions?): Promise<string>

// Poll for job status
pollJob(jobId: string): Promise<JobPollResult>

// Wait for job completion (blocking with internal polling)
waitForJob(jobId: string, pollIntervalMs?: number): Promise<JobPollResult>

// Cancel a running job
cancelJob(jobId: string): Promise<boolean>

// Get job details
getJob(jobId: string): Promise<Job | undefined>

// Get all jobs (optionally filtered by status)
getAllJobs(status?: JobStatus | JobStatus[]): Promise<Job[]>

// Delete a completed job
deleteJob(jobId: string): Promise<void>

// Set event handlers
setJobEventHandlers(events: JobEvents): void

// Get count of running jobs
getRunningJobsCount(): number

// Cleanup old completed jobs
cleanupJobs(): Promise<number>

// Close manager and release resources
close(): void
```

### Types

#### JobPollResult

Returned when polling for job status:

```typescript
interface JobPollResult {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: {
    currentIteration: number;
    totalIterations?: number;
    currentTaskId?: string;
    tasksCompleted: number;
    tasksTotal: number;
    lastUpdate: Date;
    message?: string;
  };
  finished: boolean;
  result?: ExecuteResult | LoopResult;
  error?: string;
  duration?: number;
}
```

#### JobEvents

Event handlers for job lifecycle:

```typescript
interface JobEvents {
  onJobStarted?: (job: Job) => void | Promise<void>;
  onJobCompleted?: (job: Job) => void | Promise<void>;
  onJobFailed?: (job: Job, error: Error) => void | Promise<void>;
  onJobCancelled?: (job: Job) => void | Promise<void>;
  onJobProgress?: (job: Job, progress: JobProgress) => void | Promise<void>;
}
```

## Integration with Job Schedulers

The job polling system is designed to integrate with external schedulers like cron, Bull, Agenda, etc.

### Example: Bull Queue Integration

```typescript
import Queue from 'bull';
import { ClaudeCodeManager } from 'claude-code-manager';

const manager = new ClaudeCodeManager({}, { enableJobs: true, persistToFile: true });

// Queue for starting jobs
const startQueue = new Queue('claude-start');

// Queue for polling jobs
const pollQueue = new Queue('claude-poll');

startQueue.process(async (job) => {
  const jobId = await manager.startLoopJob({
    taskFile: job.data.taskFile
  });

  // Schedule polling
  await pollQueue.add({ jobId }, { repeat: { every: 30000 } });

  return { jobId };
});

pollQueue.process(async (job) => {
  const status = await manager.pollJob(job.data.jobId);

  if (status.finished) {
    // Remove the repeating job
    await job.remove();

    // Handle completion
    console.log('Job finished:', status.result);
  }

  return status;
});
```

### Example: Simple Cron Polling

```typescript
import cron from 'node-cron';
import { ClaudeCodeManager } from 'claude-code-manager';

const manager = new ClaudeCodeManager({}, { enableJobs: true, persistToFile: true });
const pendingJobs = new Set<string>();

// Start a job
async function queueTask(taskFile: string) {
  const jobId = await manager.startLoopJob({ taskFile });
  pendingJobs.add(jobId);
  return jobId;
}

// Poll every minute
cron.schedule('* * * * *', async () => {
  for (const jobId of pendingJobs) {
    const status = await manager.pollJob(jobId);

    console.log(`[${jobId}] ${status.status} - ${status.progress?.tasksCompleted}/${status.progress?.tasksTotal}`);

    if (status.finished) {
      pendingJobs.delete(jobId);
      await manager.deleteJob(jobId);

      // Notify completion (webhook, email, etc.)
      notifyCompletion(jobId, status);
    }
  }
});
```

## PRD File Format

For loop execution, use a PRD (Product Requirements Document) JSON file:

```json
{
  "project": "My Project",
  "branchName": "feature/my-feature",
  "description": "Project description",
  "userStories": [
    {
      "id": "US-001",
      "title": "Implement user authentication",
      "description": "Create login and registration system",
      "acceptanceCriteria": [
        "Users can register with email",
        "Users can login with credentials",
        "Session management works correctly"
      ],
      "priority": 1,
      "estimatedComplexity": 3,
      "passes": false
    },
    {
      "id": "US-002",
      "title": "Add password reset",
      "description": "Allow users to reset forgotten passwords",
      "acceptanceCriteria": [
        "Users can request password reset",
        "Reset email is sent",
        "Password can be changed via link"
      ],
      "priority": 2,
      "estimatedComplexity": 2,
      "passes": false
    }
  ]
}
```

## Error Handling

Configure error strategies for different scenarios:

```typescript
const result = await manager.executeLoop({
  taskFile: './prd.json',
  errorStrategy: {
    mode: 'retry',      // 'fail-fast' | 'retry' | 'graceful' | 'custom'
    maxAttempts: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
    onError: (error, attempt) => {
      console.log(`Attempt ${attempt} failed: ${error.message}`);
    }
  }
});
```

## Cancellation

Cancel running operations:

```typescript
import { CancellationToken } from 'claude-code-manager';

const token = new CancellationToken();

// Start execution
const promise = manager.executeLoop({
  taskFile: './prd.json',
  cancelToken: token
});

// Cancel after 5 minutes
setTimeout(() => {
  token.cancel();
}, 5 * 60 * 1000);

// Or for background jobs
const jobId = await manager.startLoopJob({ taskFile: './prd.json' });
// Later...
await manager.cancelJob(jobId);
```

## Publishing to npm

```bash
# Login to npm
npm login

# Bump version (patch, minor, or major)
npm version patch

# Publish
npm publish
```

Or manually:

```bash
npm run build
npm publish
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run build:watch

# Run tests
npm test

# Run tests once
npm run test:run

# Lint
npm run lint

# Type check
npm run typecheck
```

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
