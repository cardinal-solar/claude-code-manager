# Claude Code Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Node.js library for programmatically managing Claude Code processes with both single-shot and Ralph-compatible loop execution modes.

**Architecture:** TypeScript library with modular executors (single-shot and loop), process management with adaptive control, Zod schema validation, and Claude Code skill integration for structured I/O. Ralph compatibility achieved through task file utilities and progress tracking.

**Tech Stack:** TypeScript, Node.js, Zod, zod-to-json-schema, uuid, Vitest

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts`
- Create: `.npmignore`

**Step 1: Initialize package.json**

Create `package.json`:

```json
{
  "name": "claude-code-manager",
  "version": "0.1.0",
  "description": "Node.js library for managing Claude Code processes",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext .ts",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "claude",
    "claude-code",
    "ai",
    "automation",
    "ralph"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "zod": "^3.22.4",
    "zod-to-json-schema": "^3.22.4",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/uuid": "^9.0.7",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0"
  },
  "peerDependencies": {
    "@anthropic-ai/claude-code": ">=0.5.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Step 2: Create TypeScript configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 3: Create initial index file**

Create `src/index.ts`:

```typescript
export { ClaudeCodeManager } from './manager';
export * from './types';
```

**Step 4: Create .npmignore**

Create `.npmignore`:

```
src/
tests/
*.test.ts
tsconfig.json
.gitignore
.worktrees/
```

**Step 5: Install dependencies**

Run: `npm install`
Expected: Dependencies installed successfully

**Step 6: Verify build works**

Run: `npm run build`
Expected: Build completes, `dist/` directory created

**Step 7: Commit**

```bash
git add package.json tsconfig.json src/index.ts .npmignore
git commit -m "chore: initialize project with TypeScript setup"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types.ts`

**Step 1: Create core type definitions**

Create `src/types.ts`:

```typescript
import { z } from 'zod';

// Configuration types
export interface ClaudeCodeManagerConfig {
  claudeCodePath?: string;
  workingDir?: string;
  tempDir?: string;
  skillsDir?: string;
  cleanupOnExit?: boolean;
  globalTimeout?: number;
  hooks?: LifecycleHooks;
}

export interface LifecycleHooks {
  beforeExecute?: (options: ExecuteOptionsBase) => void | Promise<void>;
  afterExecute?: (result: ExecuteResultBase) => void | Promise<void>;
  beforeIteration?: (iteration: number) => void | Promise<void>;
  afterIteration?: (result: IterationResult) => void | Promise<void>;
}

// Error handling types
export interface ErrorStrategy {
  mode: 'fail-fast' | 'retry' | 'graceful' | 'custom';
  maxAttempts?: number;
  backoffMs?: number;
  backoffMultiplier?: number;
  onError?: (error: Error, attempt: number) => void | Promise<void>;
  shouldRetry?: (error: Error) => boolean;
  defaultValue?: any;
  handler?: (fn: () => Promise<any>) => Promise<any>;
}

// Process management types
export interface ProcessOptions {
  timeout?: number;
  maxMemoryMB?: number;
  killSignal?: NodeJS.Signals;
  cleanupOnError?: boolean;
}

// Single-shot execution types
export interface ExecuteOptionsBase {
  prompt: string;
  variables?: Record<string, any>;
  timeout?: number;
  errorStrategy?: ErrorStrategy;
  onOutput?: (chunk: string) => void;
  permissions?: string[];
}

export interface ExecuteOptions<T extends z.ZodType> extends ExecuteOptionsBase {
  schema: T;
  mode?: 'single';
}

export interface ExecuteResultBase {
  success: boolean;
  outputDir: string;
  logs: string;
  duration: number;
  error?: Error;
}

export interface ExecuteResult<T> extends ExecuteResultBase {
  data?: z.infer<T>;
  artifacts?: string[];
}

// Loop execution types
export interface RalphOptions {
  progressFile?: string;
  archiveOnComplete?: boolean;
  archiveDir?: string;
  gitAutoCommit?: boolean;
  branchAutoCreate?: boolean;
}

export interface ExecuteLoopOptions {
  taskFile: string;
  maxIterations?: number;
  mode?: 'code' | 'research' | 'auto';
  progressFile?: string;
  onIteration?: (iteration: IterationResult) => void;
  errorStrategy?: ErrorStrategy;
  streamOutput?: boolean;
  permissions?: string[];
  ralphOptions?: RalphOptions;
  cancelToken?: CancellationToken;
  processOptions?: ProcessOptions;
}

export interface LoopResult {
  success: boolean;
  completed: boolean;
  iterations: IterationResult[];
  totalDuration: number;
  finalState: TaskState;
  progressLog: string;
}

export interface IterationResult {
  iteration: number;
  taskId: string;
  success: boolean;
  commits?: string[];
  findings?: string[];
  duration: number;
  error?: Error;
}

export interface TaskState {
  mode: 'code' | 'research';
  tasksTotal: number;
  tasksCompleted: number;
  tasks: Array<UserStory | ResearchTask>;
}

// Ralph task file types
export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  estimatedComplexity: number;
  passes: boolean;
}

export interface ResearchTask {
  id: string;
  title: string;
  description: string;
  methodology: string;
  acceptanceCriteria: string[];
  outputFile: string;
  priority: number;
  completed: boolean;
}

export interface PRDSpec {
  project: string;
  branchName: string;
  description: string;
  userStories: UserStory[];
}

export interface RRDSpec {
  project: string;
  taskType: string;
  outputFile: string;
  description: string;
  researchTasks: ResearchTask[];
}

// Cancellation support
export class CancellationToken {
  private cancelled = false;
  private callbacks: Array<() => void> = [];

  cancel(): void {
    this.cancelled = true;
    this.callbacks.forEach(cb => cb());
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  onCancel(callback: () => void): void {
    if (this.cancelled) {
      callback();
    } else {
      this.callbacks.push(callback);
    }
  }
}

// Cleanup types
export interface CleanupOptions {
  strategy: 'immediate' | 'on-success' | 'on-exit' | 'manual';
  keepOnError?: boolean;
  maxAgeDays?: number;
  preserveArtifacts?: boolean;
}

// Progress tracking types
export interface ProgressEntry {
  storyId: string;
  summary: string;
  filesChanged: string[];
  learnings: string[];
}

export interface ProgressLog {
  learnings: string[];
  patterns: string[];
  entries: ProgressEntry[];
}
```

**Step 2: Verify TypeScript compilation**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/types.ts src/index.ts
git commit -m "feat: add core type definitions"
```

---

## Task 3: Error Classes

**Files:**
- Create: `src/errors/index.ts`

**Step 1: Create custom error classes**

Create `src/errors/index.ts`:

```typescript
import { z } from 'zod';

export class ClaudeCodeError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ClaudeCodeError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ClaudeCodeError {
  constructor(
    message: string,
    public zodError: z.ZodError
  ) {
    super(message, 'VALIDATION_ERROR', zodError.format());
    this.name = 'ValidationError';
  }
}

export class ProcessTimeoutError extends ClaudeCodeError {
  constructor(public timeoutMs: number) {
    super(
      `Process timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      { timeoutMs }
    );
    this.name = 'ProcessTimeoutError';
  }
}

export class TaskIncompleteError extends ClaudeCodeError {
  constructor(
    public completedTasks: number,
    public totalTasks: number
  ) {
    super(
      `Only ${completedTasks}/${totalTasks} tasks completed`,
      'INCOMPLETE',
      { completedTasks, totalTasks }
    );
    this.name = 'TaskIncompleteError';
  }
}

export class ProcessError extends ClaudeCodeError {
  constructor(
    message: string,
    public exitCode: number | null,
    public signal: NodeJS.Signals | null
  ) {
    super(message, 'PROCESS_ERROR', { exitCode, signal });
    this.name = 'ProcessError';
  }
}

export class SkillInstallError extends ClaudeCodeError {
  constructor(message: string, details?: any) {
    super(message, 'SKILL_INSTALL_ERROR', details);
    this.name = 'SkillInstallError';
  }
}
```

**Step 2: Export errors from index**

Modify `src/index.ts`:

```typescript
export { ClaudeCodeManager } from './manager';
export * from './types';
export * from './errors';
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/errors/index.ts src/index.ts
git commit -m "feat: add custom error classes"
```

---

## Task 4: File Manager

**Files:**
- Create: `src/files/file-manager.ts`
- Create: `tests/files/file-manager.test.ts`

**Step 1: Write failing test**

Create `tests/files/file-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileManager } from '../../src/files/file-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('FileManager', () => {
  let fileManager: FileManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    fileManager = new FileManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create task directory with artifacts subdirectory', async () => {
    const taskId = 'test-task-123';
    const taskDir = await fileManager.createTaskDir(taskId);

    expect(taskDir).toContain(`task-${taskId}`);
    const stats = await fs.stat(taskDir);
    expect(stats.isDirectory()).toBe(true);

    const artifactsDir = path.join(taskDir, 'artifacts');
    const artifactsStats = await fs.stat(artifactsDir);
    expect(artifactsStats.isDirectory()).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/files/file-manager.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/files/file-manager.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileManager {
  constructor(private tempDir: string) {}

  async createTaskDir(taskId: string): Promise<string> {
    const taskDir = path.join(this.tempDir, `task-${taskId}`);
    await fs.mkdir(taskDir, { recursive: true });
    await fs.mkdir(path.join(taskDir, 'artifacts'), { recursive: true });
    return taskDir;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/files/file-manager.test.ts`
Expected: PASS

**Step 5: Add more tests for file operations**

Add to `tests/files/file-manager.test.ts`:

```typescript
it('should write task specification', async () => {
  const taskDir = await fileManager.createTaskDir('test-123');
  const spec = {
    prompt: 'Test prompt',
    variables: { key: 'value' }
  };

  await fileManager.writeTaskSpec(taskDir, spec);

  const content = await fs.readFile(
    path.join(taskDir, 'instructions.json'),
    'utf-8'
  );
  expect(JSON.parse(content)).toEqual(spec);
});

it('should write schema file', async () => {
  const taskDir = await fileManager.createTaskDir('test-123');
  const schema = {
    type: 'object',
    properties: {
      result: { type: 'string' }
    }
  };

  await fileManager.writeSchema(taskDir, schema);

  const content = await fs.readFile(
    path.join(taskDir, 'schema.json'),
    'utf-8'
  );
  expect(JSON.parse(content)).toEqual(schema);
});

it('should read result file', async () => {
  const taskDir = await fileManager.createTaskDir('test-123');
  const result = { data: 'test result' };

  await fs.writeFile(
    path.join(taskDir, 'result.json'),
    JSON.stringify(result)
  );

  const readResult = await fileManager.readResult(taskDir);
  expect(readResult).toEqual(result);
});

it('should list artifacts', async () => {
  const taskDir = await fileManager.createTaskDir('test-123');
  const artifactsDir = path.join(taskDir, 'artifacts');

  await fs.writeFile(path.join(artifactsDir, 'file1.ts'), 'content1');
  await fs.writeFile(path.join(artifactsDir, 'file2.ts'), 'content2');

  const artifacts = await fileManager.listArtifacts(taskDir);
  expect(artifacts).toHaveLength(2);
  expect(artifacts).toContain(path.join(artifactsDir, 'file1.ts'));
  expect(artifacts).toContain(path.join(artifactsDir, 'file2.ts'));
});
```

**Step 6: Run tests to verify they fail**

Run: `npm test -- tests/files/file-manager.test.ts`
Expected: FAIL for new tests

**Step 7: Implement remaining methods**

Update `src/files/file-manager.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileManager {
  constructor(private tempDir: string) {}

  async createTaskDir(taskId: string): Promise<string> {
    const taskDir = path.join(this.tempDir, `task-${taskId}`);
    await fs.mkdir(taskDir, { recursive: true });
    await fs.mkdir(path.join(taskDir, 'artifacts'), { recursive: true });
    return taskDir;
  }

  async writeTaskSpec(taskDir: string, spec: any): Promise<void> {
    const filePath = path.join(taskDir, 'instructions.json');
    await fs.writeFile(filePath, JSON.stringify(spec, null, 2));
  }

  async writeSchema(taskDir: string, schema: any): Promise<void> {
    const filePath = path.join(taskDir, 'schema.json');
    await fs.writeFile(filePath, JSON.stringify(schema, null, 2));
  }

  async readResult(taskDir: string): Promise<any> {
    const filePath = path.join(taskDir, 'result.json');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  async listArtifacts(taskDir: string): Promise<string[]> {
    const artifactsDir = path.join(taskDir, 'artifacts');
    try {
      const files = await fs.readdir(artifactsDir);
      return files.map(file => path.join(artifactsDir, file));
    } catch {
      return [];
    }
  }

  async cleanup(taskDir: string): Promise<void> {
    await fs.rm(taskDir, { recursive: true, force: true });
  }
}
```

**Step 8: Run tests to verify they pass**

Run: `npm test -- tests/files/file-manager.test.ts`
Expected: PASS all tests

**Step 9: Commit**

```bash
git add src/files/file-manager.ts tests/files/file-manager.test.ts
git commit -m "feat: add file manager with tests"
```

---

## Task 5: Schema Validator

**Files:**
- Create: `src/validation/schema.ts`
- Create: `tests/validation/schema.test.ts`

**Step 1: Write failing test**

Create `tests/validation/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { SchemaValidator } from '../../src/validation/schema';

describe('SchemaValidator', () => {
  it('should convert Zod schema to JSON Schema', () => {
    const zodSchema = z.object({
      name: z.string(),
      age: z.number()
    });

    const jsonSchema = SchemaValidator.toJsonSchema(zodSchema);

    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties).toHaveProperty('name');
    expect(jsonSchema.properties).toHaveProperty('age');
  });

  it('should validate data against Zod schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number()
    });

    const validData = { name: 'John', age: 30 };
    const result = SchemaValidator.validate(validData, schema);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validData);
  });

  it('should return error for invalid data', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number()
    });

    const invalidData = { name: 'John', age: 'thirty' };
    const result = SchemaValidator.validate(invalidData, schema);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/validation/schema.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/validation/schema.ts`:

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export class SchemaValidator {
  static toJsonSchema(schema: z.ZodType): any {
    return zodToJsonSchema(schema);
  }

  static validate<T extends z.ZodType>(
    data: unknown,
    schema: T
  ): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
    const result = schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/validation/schema.test.ts`
Expected: PASS all tests

**Step 5: Commit**

```bash
git add src/validation/schema.ts tests/validation/schema.test.ts
git commit -m "feat: add schema validator with Zod integration"
```

---

## Task 6: Process Runner (Basic)

**Files:**
- Create: `src/process/runner.ts`
- Create: `tests/process/runner.test.ts`

**Step 1: Write failing test**

Create `tests/process/runner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ProcessRunner } from '../../src/process/runner';

describe('ProcessRunner', () => {
  it('should run a simple command and capture output', async () => {
    const runner = new ProcessRunner();
    const result = await runner.run({
      command: 'echo',
      args: ['hello world'],
      timeout: 5000
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('hello world');
  });

  it('should handle command timeout', async () => {
    const runner = new ProcessRunner();

    await expect(
      runner.run({
        command: 'sleep',
        args: ['10'],
        timeout: 100
      })
    ).rejects.toThrow('timeout');
  }, 10000);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/process/runner.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/process/runner.ts`:

```typescript
import { spawn, ChildProcess } from 'child_process';
import { ProcessTimeoutError } from '../errors';

export interface RunOptions {
  command: string;
  args?: string[];
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface RunResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  output: string;
  error: string;
  duration: number;
}

export class ProcessRunner {
  async run(options: RunOptions): Promise<RunResult> {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    return new Promise((resolve, reject) => {
      const process = spawn(options.command, options.args || [], {
        cwd: options.cwd,
        env: { ...process.env, ...options.env }
      });

      process.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      process.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      let timeoutId: NodeJS.Timeout | undefined;

      if (options.timeout) {
        timeoutId = setTimeout(() => {
          process.kill('SIGTERM');
          reject(new ProcessTimeoutError(options.timeout!));
        }, options.timeout);
      }

      process.on('close', (code, signal) => {
        if (timeoutId) clearTimeout(timeoutId);

        resolve({
          exitCode: code,
          signal,
          output: stdout,
          error: stderr,
          duration: Date.now() - startTime
        });
      });

      process.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
    });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/process/runner.test.ts`
Expected: PASS all tests

**Step 5: Commit**

```bash
git add src/process/runner.ts tests/process/runner.test.ts
git commit -m "feat: add basic process runner"
```

---

## Task 7: Single-Shot Executor (Core)

**Files:**
- Create: `src/executors/single-shot.ts`
- Create: `tests/executors/single-shot.test.ts`

**Step 1: Write failing test**

Create `tests/executors/single-shot.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SingleShotExecutor } from '../../src/executors/single-shot';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('SingleShotExecutor', () => {
  let executor: SingleShotExecutor;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `test-executor-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    executor = new SingleShotExecutor({
      claudeCodePath: 'echo',
      tempDir
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create task directory structure', async () => {
    const schema = z.object({ result: z.string() });

    const taskDir = await executor.prepareTask({
      prompt: 'Test task',
      schema,
      variables: { key: 'value' }
    });

    expect(taskDir).toContain('task-');

    const instructionsExist = await fs.access(
      path.join(taskDir, 'instructions.json')
    ).then(() => true).catch(() => false);
    expect(instructionsExist).toBe(true);

    const schemaExist = await fs.access(
      path.join(taskDir, 'schema.json')
    ).then(() => true).catch(() => false);
    expect(schemaExist).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/executors/single-shot.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/executors/single-shot.ts`:

```typescript
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { FileManager } from '../files/file-manager';
import { SchemaValidator } from '../validation/schema';
import { ExecuteOptions, ExecuteResult } from '../types';

interface SingleShotConfig {
  claudeCodePath: string;
  tempDir: string;
}

export class SingleShotExecutor {
  private fileManager: FileManager;

  constructor(private config: SingleShotConfig) {
    this.fileManager = new FileManager(config.tempDir);
  }

  async prepareTask<T extends z.ZodType>(
    options: ExecuteOptions<T>
  ): Promise<string> {
    const taskId = uuidv4();
    const taskDir = await this.fileManager.createTaskDir(taskId);

    // Write instructions
    await this.fileManager.writeTaskSpec(taskDir, {
      prompt: options.prompt,
      variables: options.variables || {}
    });

    // Write schema
    const jsonSchema = SchemaValidator.toJsonSchema(options.schema);
    await this.fileManager.writeSchema(taskDir, jsonSchema);

    return taskDir;
  }

  async execute<T extends z.ZodType>(
    options: ExecuteOptions<T>
  ): Promise<ExecuteResult<T>> {
    const startTime = Date.now();

    try {
      const taskDir = await this.prepareTask(options);

      // TODO: Execute Claude Code process
      // TODO: Read and validate result

      return {
        success: true,
        outputDir: taskDir,
        logs: '',
        duration: Date.now() - startTime,
        data: undefined as any,
        artifacts: []
      };
    } catch (error) {
      return {
        success: false,
        outputDir: '',
        logs: '',
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/executors/single-shot.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/executors/single-shot.ts tests/executors/single-shot.test.ts
git commit -m "feat: add single-shot executor foundation"
```

---

## Task 8: Main Manager Class

**Files:**
- Create: `src/manager.ts`
- Create: `tests/manager.test.ts`

**Step 1: Write failing test**

Create `tests/manager.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ClaudeCodeManager } from '../src/manager';
import * as os from 'os';

describe('ClaudeCodeManager', () => {
  it('should initialize with default config', () => {
    const manager = new ClaudeCodeManager();
    expect(manager).toBeDefined();
  });

  it('should initialize with custom config', () => {
    const manager = new ClaudeCodeManager({
      claudeCodePath: '/custom/path/claude',
      tempDir: '/tmp/custom'
    });
    expect(manager).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/manager.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/manager.ts`:

```typescript
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import {
  ClaudeCodeManagerConfig,
  ExecuteOptions,
  ExecuteResult,
  ExecuteLoopOptions,
  LoopResult
} from './types';
import { SingleShotExecutor } from './executors/single-shot';

export class ClaudeCodeManager {
  private config: Required<Omit<ClaudeCodeManagerConfig, 'hooks' | 'globalTimeout'>> &
    Pick<ClaudeCodeManagerConfig, 'hooks' | 'globalTimeout'>;
  private singleShotExecutor: SingleShotExecutor;

  constructor(config?: ClaudeCodeManagerConfig) {
    this.config = {
      claudeCodePath: config?.claudeCodePath || 'claude',
      workingDir: config?.workingDir || process.cwd(),
      tempDir: config?.tempDir || path.join(os.tmpdir(), 'claude-tasks'),
      skillsDir: config?.skillsDir || path.join(os.homedir(), '.claude', 'skills'),
      cleanupOnExit: config?.cleanupOnExit ?? true,
      hooks: config?.hooks,
      globalTimeout: config?.globalTimeout
    };

    this.singleShotExecutor = new SingleShotExecutor({
      claudeCodePath: this.config.claudeCodePath,
      tempDir: this.config.tempDir
    });
  }

  async execute<T extends z.ZodType>(
    options: ExecuteOptions<T>
  ): Promise<ExecuteResult<T>> {
    await this.config.hooks?.beforeExecute?.(options);

    const result = await this.singleShotExecutor.execute(options);

    await this.config.hooks?.afterExecute?.(result);

    return result;
  }

  async executeLoop(options: ExecuteLoopOptions): Promise<LoopResult> {
    // TODO: Implement loop execution
    throw new Error('Not implemented');
  }

  static async installSkills(): Promise<void> {
    // TODO: Implement skill installation
    throw new Error('Not implemented');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/manager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/manager.ts tests/manager.test.ts
git commit -m "feat: add main manager class"
```

---

## Task 9: Claude Code Skill Templates

**Files:**
- Create: `src/skills/templates/execute-task.md`
- Create: `src/skills/templates/validate-output.md`

**Step 1: Create execute-task skill template**

Create `src/skills/templates/execute-task.md`:

```markdown
---
name: execute-task
description: Execute a structured task with validated JSON output
---

# Task Execution with Structured Output

You are executing a task that requires structured, validated output.

## Instructions

1. Read task details from `instructions.json` in the working directory
2. Read the JSON Schema from `schema.json` for output structure requirements
3. Read template variables from `variables.json` (if present)
4. Execute the task described in the prompt
5. Write your result to `result.json` matching the provided schema
6. Write execution logs to `logs.txt`
7. Save any generated files to `artifacts/` directory
8. Validate your output before finishing

## Output Format

Your `result.json` must validate against the JSON Schema provided in `schema.json`.

The schema defines the exact structure your output should have. Ensure all required fields are present and have the correct types.

## Example Workflow

1. Read instructions:
   ```bash
   cat instructions.json
   ```

2. Read schema requirements:
   ```bash
   cat schema.json
   ```

3. Complete the task as described

4. Write your result:
   ```bash
   echo '{"your": "result"}' > result.json
   ```

5. Write logs:
   ```bash
   echo "Task completed successfully" > logs.txt
   ```

6. Validate (use the /validate-output skill if available)

## Completion Checklist

Before finishing, ensure:
- [ ] result.json exists and contains valid JSON
- [ ] result.json matches the schema structure
- [ ] logs.txt contains execution details
- [ ] artifacts/ has any generated files
- [ ] All required schema fields are present
```

**Step 2: Create validate-output skill template**

Create `src/skills/templates/validate-output.md`:

```markdown
---
name: validate-output
description: Validate result.json against schema.json
---

# Output Validation

This skill helps you validate your output against the required schema.

## Usage

1. Ensure `result.json` exists in the current directory
2. Ensure `schema.json` exists in the current directory
3. Use this skill to validate the result

## Validation Process

The validation will check:
- JSON syntax is valid
- All required fields are present
- Field types match the schema
- Additional constraints are satisfied

## If Validation Fails

1. Read the error message carefully
2. Check which field failed validation
3. Fix the issue in `result.json`
4. Validate again

## Example

```bash
# Your result.json
{
  "name": "John",
  "age": 30
}

# Schema requires
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number" }
  },
  "required": ["name", "age"]
}

# This validates successfully!
```
```

**Step 3: Commit**

```bash
git add src/skills/templates/
git commit -m "feat: add Claude Code skill templates"
```

---

## Task 10: Skill Installer

**Files:**
- Create: `src/skills/installer.ts`
- Create: `tests/skills/installer.test.ts`

**Step 1: Write failing test**

Create `tests/skills/installer.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillInstaller } from '../../src/skills/installer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('SkillInstaller', () => {
  let installer: SkillInstaller;
  let tempSkillsDir: string;

  beforeEach(async () => {
    tempSkillsDir = path.join(os.tmpdir(), `test-skills-${Date.now()}`);
    await fs.mkdir(tempSkillsDir, { recursive: true });
    installer = new SkillInstaller(tempSkillsDir);
  });

  afterEach(async () => {
    await fs.rm(tempSkillsDir, { recursive: true, force: true });
  });

  it('should check if skills are installed', async () => {
    const installed = await installer.isInstalled();
    expect(installed).toBe(false);
  });

  it('should install skills', async () => {
    await installer.install();

    const installed = await installer.isInstalled();
    expect(installed).toBe(true);

    const executeTaskPath = path.join(
      tempSkillsDir,
      'claude-code-manager',
      'execute-task.md'
    );
    const exists = await fs.access(executeTaskPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/skills/installer.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/skills/installer.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillInstallError } from '../errors';

export class SkillInstaller {
  private skillDir: string;

  constructor(private skillsBaseDir: string) {
    this.skillDir = path.join(skillsBaseDir, 'claude-code-manager');
  }

  async isInstalled(): Promise<boolean> {
    try {
      await fs.access(this.skillDir);
      return true;
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    try {
      // Create skill directory
      await fs.mkdir(this.skillDir, { recursive: true });

      // Copy skill templates
      const templatesDir = path.join(__dirname, 'templates');

      const executeTaskTemplate = await fs.readFile(
        path.join(templatesDir, 'execute-task.md'),
        'utf-8'
      );
      await fs.writeFile(
        path.join(this.skillDir, 'execute-task.md'),
        executeTaskTemplate
      );

      const validateOutputTemplate = await fs.readFile(
        path.join(templatesDir, 'validate-output.md'),
        'utf-8'
      );
      await fs.writeFile(
        path.join(this.skillDir, 'validate-output.md'),
        validateOutputTemplate
      );
    } catch (error) {
      throw new SkillInstallError(
        'Failed to install skills',
        error
      );
    }
  }

  async uninstall(): Promise<void> {
    try {
      await fs.rm(this.skillDir, { recursive: true, force: true });
    } catch (error) {
      throw new SkillInstallError(
        'Failed to uninstall skills',
        error
      );
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/skills/installer.test.ts`
Expected: PASS

**Step 5: Add installSkills to manager**

Update `src/manager.ts`:

```typescript
import { SkillInstaller } from './skills/installer';

// In ClaudeCodeManager class:
static async installSkills(skillsDir?: string): Promise<void> {
  const dir = skillsDir || path.join(os.homedir(), '.claude', 'skills');
  const installer = new SkillInstaller(dir);

  if (await installer.isInstalled()) {
    return; // Already installed
  }

  await installer.install();
}
```

**Step 6: Build and verify**

Run: `npm run build`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add src/skills/installer.ts tests/skills/installer.test.ts src/manager.ts
git commit -m "feat: add skill installer"
```

---

## Task 11: Ralph Task File Utilities (PRD)

**Files:**
- Create: `src/ralph/prd.ts`
- Create: `tests/ralph/prd.test.ts`

**Step 1: Write failing test**

Create `tests/ralph/prd.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PRD } from '../../src/ralph/prd';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('PRD', () => {
  let tempDir: string;
  let prdPath: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `test-prd-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    prdPath = path.join(tempDir, 'prd.json');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create PRD from spec', () => {
    const prd = PRD.create({
      project: 'Test Project',
      branchName: 'ralph/test',
      description: 'Test description',
      userStories: [
        {
          id: 'US-001',
          title: 'Test story',
          description: 'Test',
          acceptanceCriteria: ['Criteria 1'],
          priority: 1,
          estimatedComplexity: 2,
          passes: false
        }
      ]
    });

    expect(prd.getProject()).toBe('Test Project');
    expect(prd.getBranchName()).toBe('ralph/test');
    expect(prd.getUserStories()).toHaveLength(1);
  });

  it('should save and load PRD', async () => {
    const prd = PRD.create({
      project: 'Test',
      branchName: 'test',
      description: 'desc',
      userStories: []
    });

    await prd.save(prdPath);

    const loaded = await PRD.load(prdPath);
    expect(loaded.getProject()).toBe('Test');
  });

  it('should get next story', () => {
    const prd = PRD.create({
      project: 'Test',
      branchName: 'test',
      description: 'desc',
      userStories: [
        {
          id: 'US-001',
          title: 'Story 1',
          description: 'Test',
          acceptanceCriteria: [],
          priority: 2,
          estimatedComplexity: 1,
          passes: false
        },
        {
          id: 'US-002',
          title: 'Story 2',
          description: 'Test',
          acceptanceCriteria: [],
          priority: 1,
          estimatedComplexity: 1,
          passes: false
        }
      ]
    });

    const next = prd.getNextStory();
    expect(next?.id).toBe('US-002'); // Higher priority (1 < 2)
  });

  it('should update story status', async () => {
    const prd = PRD.create({
      project: 'Test',
      branchName: 'test',
      description: 'desc',
      userStories: [
        {
          id: 'US-001',
          title: 'Story 1',
          description: 'Test',
          acceptanceCriteria: [],
          priority: 1,
          estimatedComplexity: 1,
          passes: false
        }
      ]
    });

    prd.updateStory('US-001', { passes: true });

    const story = prd.getUserStories()[0];
    expect(story.passes).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ralph/prd.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/ralph/prd.ts`:

```typescript
import * as fs from 'fs/promises';
import { PRDSpec, UserStory } from '../types';

export class PRD {
  private constructor(private spec: PRDSpec) {}

  static create(spec: PRDSpec): PRD {
    return new PRD(spec);
  }

  static async load(path: string): Promise<PRD> {
    const content = await fs.readFile(path, 'utf-8');
    const spec = JSON.parse(content) as PRDSpec;
    return new PRD(spec);
  }

  async save(path: string): Promise<void> {
    await fs.writeFile(path, JSON.stringify(this.spec, null, 2));
  }

  getProject(): string {
    return this.spec.project;
  }

  getBranchName(): string {
    return this.spec.branchName;
  }

  getUserStories(): UserStory[] {
    return this.spec.userStories;
  }

  getNextStory(): UserStory | null {
    const incomplete = this.spec.userStories.filter(s => !s.passes);

    if (incomplete.length === 0) {
      return null;
    }

    // Sort by priority (lower number = higher priority)
    incomplete.sort((a, b) => a.priority - b.priority);

    return incomplete[0];
  }

  updateStory(id: string, updates: Partial<UserStory>): void {
    const story = this.spec.userStories.find(s => s.id === id);
    if (story) {
      Object.assign(story, updates);
    }
  }

  isComplete(): boolean {
    return this.spec.userStories.every(s => s.passes);
  }

  getProgress(): { completed: number; total: number } {
    const completed = this.spec.userStories.filter(s => s.passes).length;
    return { completed, total: this.spec.userStories.length };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ralph/prd.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ralph/prd.ts tests/ralph/prd.test.ts
git commit -m "feat: add PRD utilities"
```

---

## Task 12: Progress Tracking

**Files:**
- Create: `src/ralph/progress.ts`
- Create: `tests/ralph/progress.test.ts`

**Step 1: Write failing test**

Create `tests/ralph/progress.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProgressTracker } from '../../src/ralph/progress';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ProgressTracker', () => {
  let tempDir: string;
  let progressPath: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `test-progress-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    progressPath = path.join(tempDir, 'progress.txt');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should initialize progress file', async () => {
    await ProgressTracker.initialize(progressPath);

    const content = await fs.readFile(progressPath, 'utf-8');
    expect(content).toContain('Ralph Progress Log');
  });

  it('should append entry to progress', async () => {
    await ProgressTracker.initialize(progressPath);

    await ProgressTracker.append(progressPath, {
      storyId: 'US-001',
      summary: 'Implemented feature',
      filesChanged: ['file1.ts', 'file2.ts'],
      learnings: ['Learning 1', 'Learning 2']
    });

    const content = await fs.readFile(progressPath, 'utf-8');
    expect(content).toContain('US-001');
    expect(content).toContain('Implemented feature');
    expect(content).toContain('Learning 1');
  });

  it('should read progress log', async () => {
    await ProgressTracker.initialize(progressPath);

    await ProgressTracker.append(progressPath, {
      storyId: 'US-001',
      summary: 'Test',
      filesChanged: [],
      learnings: ['Learning 1']
    });

    const log = await ProgressTracker.read(progressPath);
    expect(log.entries).toHaveLength(1);
    expect(log.learnings).toContain('Learning 1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ralph/progress.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/ralph/progress.ts`:

```typescript
import * as fs from 'fs/promises';
import { ProgressEntry, ProgressLog } from '../types';

export class ProgressTracker {
  static async initialize(path: string): Promise<void> {
    const content = `# Ralph Progress Log
Started: ${new Date().toISOString()}
---

`;
    await fs.writeFile(path, content);
  }

  static async append(path: string, entry: ProgressEntry): Promise<void> {
    const timestamp = new Date().toISOString();
    const content = `
## ${timestamp} - ${entry.storyId}
- ${entry.summary}
- Files changed: ${entry.filesChanged.join(', ')}
- **Learnings for future iterations:**
${entry.learnings.map(l => `  - ${l}`).join('\n')}
---
`;

    await fs.appendFile(path, content);
  }

  static async read(path: string): Promise<ProgressLog> {
    try {
      const content = await fs.readFile(path, 'utf-8');

      // Parse entries (simple parsing, could be improved)
      const entries: ProgressEntry[] = [];
      const learnings: string[] = [];
      const patterns: string[] = [];

      // Extract learnings from entries
      const learningMatches = content.matchAll(/- (.+)/g);
      for (const match of learningMatches) {
        if (match[1] && !match[1].startsWith('Files changed')) {
          learnings.push(match[1]);
        }
      }

      return { entries, learnings, patterns };
    } catch {
      return { entries: [], learnings: [], patterns: [] };
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ralph/progress.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ralph/progress.ts tests/ralph/progress.test.ts
git commit -m "feat: add progress tracking utilities"
```

---

## Task 13: README and Examples

**Files:**
- Create: `README.md`
- Create: `examples/single-shot.ts`
- Create: `examples/loop-basic.ts`

**Step 1: Create README**

Create `README.md`:

```markdown
# Claude Code Manager

A Node.js library for programmatically managing Claude Code processes with both single-shot and Ralph-compatible loop execution modes.

## Features

- **Dual Execution Modes**: Single-shot and loop-based (Ralph-compatible)
- **Schema Validation**: Zod integration for type-safe output validation
- **Structured Output**: Organized temp directories with result.json, logs, artifacts
- **Skill-Based Bridge**: Claude Code skill for structured I/O
- **Error Handling**: Configurable strategies (fail-fast, retry, graceful, custom)
- **Process Control**: Adaptive - simple for single-shot, full control for loops
- **Ralph Compatibility**: Full support for prd.json/rrd.json workflows
- **TypeScript-First**: Full type safety and IntelliSense support

## Installation

```bash
npm install claude-code-manager
```

Requires `@anthropic-ai/claude-code` to be installed:

```bash
npm install -g @anthropic-ai/claude-code
```

## Quick Start

### Single-Shot Execution

```typescript
import { ClaudeCodeManager } from 'claude-code-manager';
import { z } from 'zod';

const manager = new ClaudeCodeManager();

const schema = z.object({
  code: z.string(),
  tests: z.array(z.string())
});

const result = await manager.execute({
  prompt: 'Create a React UserCard component',
  variables: { styling: 'tailwind' },
  schema
});

console.log('Component:', result.data.code);
```

### Loop Execution (Ralph-Compatible)

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

## Documentation

See the [examples](./examples) directory for more usage examples.

## License

MIT
```

**Step 2: Create single-shot example**

Create `examples/single-shot.ts`:

```typescript
import { ClaudeCodeManager } from '../src';
import { z } from 'zod';

async function main() {
  const manager = new ClaudeCodeManager();

  const componentSchema = z.object({
    code: z.string(),
    tests: z.array(z.string()),
    dependencies: z.array(z.string())
  });

  console.log('Executing single-shot task...');

  const result = await manager.execute({
    prompt: 'Create a React UserCard component with avatar, name, and email',
    variables: {
      styling: 'tailwind'
    },
    schema: componentSchema,
    onOutput: (chunk) => process.stdout.write(chunk)
  });

  if (result.success && result.data) {
    console.log('\n✅ Task completed successfully!');
    console.log('\nGenerated code:');
    console.log(result.data.code);
    console.log('\nTests:', result.data.tests);
    console.log('\nDependencies:', result.data.dependencies);
  } else {
    console.error('❌ Task failed:', result.error);
  }
}

main().catch(console.error);
```

**Step 3: Create loop example**

Create `examples/loop-basic.ts`:

```typescript
import { ClaudeCodeManager } from '../src';

async function main() {
  const manager = new ClaudeCodeManager();

  console.log('Starting Ralph-compatible loop execution...');

  const result = await manager.executeLoop({
    taskFile: './prd.json',
    maxIterations: 10,
    mode: 'code',
    streamOutput: true,
    onIteration: (iter) => {
      console.log(`\n=== Iteration ${iter.iteration} ===`);
      console.log(`Task: ${iter.taskId}`);

      if (iter.commits?.length) {
        console.log(`Commits: ${iter.commits.join(', ')}`);
      }
    }
  });

  if (result.completed) {
    console.log('\n✅ All tasks completed!');
    console.log(`Total iterations: ${result.iterations.length}`);
    console.log(`Duration: ${result.totalDuration}ms`);
  } else {
    console.log('\n⚠️ Loop ended before completion');
    console.log(`Completed: ${result.finalState.tasksCompleted}/${result.finalState.tasksTotal}`);
  }
}

main().catch(console.error);
```

**Step 4: Commit**

```bash
git add README.md examples/
git commit -m "docs: add README and examples"
```

---

## Remaining Tasks

The implementation plan continues with these tasks:

- **Task 14**: Complete single-shot executor with Claude Code integration
- **Task 15**: Loop executor foundation
- **Task 16**: Ralph loop integration
- **Task 17**: Error handling strategies implementation
- **Task 18**: Advanced process control (streaming, cancellation)
- **Task 19**: Cleanup strategies
- **Task 20**: Integration tests
- **Task 21**: Package publishing setup

---

## Next Steps

1. Review this plan
2. Choose execution approach (subagent-driven or parallel session)
3. Begin implementation task-by-task
