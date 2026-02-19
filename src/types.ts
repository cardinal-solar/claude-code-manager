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
  skill?: string;
  timeout?: number;
  errorStrategy?: ErrorStrategy;
  onOutput?: (chunk: string) => void;
  permissions?: string[];
  /** Extra environment variables passed to the Claude Code child process (e.g. ANTHROPIC_API_KEY). */
  env?: Record<string, string>;
  /** Model to use (e.g. "claude-sonnet-4-5-20250514"). Passed as --model to Claude Code. */
  model?: string;
  /** Permission mode override (default: "bypassPermissions"). Passed as --permission-mode. */
  permissionMode?: string;
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

export interface ExecuteResult<T extends z.ZodType> extends ExecuteResultBase {
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
  /** Extra environment variables passed to each iteration's Claude Code process. */
  env?: Record<string, string>;
  /** Model to use for each iteration. */
  model?: string;
  /** Permission mode for each iteration (default: "bypassPermissions"). */
  permissionMode?: string;
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
