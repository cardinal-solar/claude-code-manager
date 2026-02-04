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
import { LoopExecutor } from './executors/loop';
import { SkillInstaller } from './skills/installer';
import {
  JobManager,
  JobPollResult,
  JobEvents,
  JobManagerOptions,
  StartJobOptions,
  Job,
  JobStatus
} from './jobs';

export interface ClaudeCodeManagerJobOptions extends JobManagerOptions {
  /** Enable job management features */
  enableJobs?: boolean;
}

export class ClaudeCodeManager {
  private config: Required<Omit<ClaudeCodeManagerConfig, 'hooks' | 'globalTimeout'>> &
    Pick<ClaudeCodeManagerConfig, 'hooks' | 'globalTimeout'>;
  private singleShotExecutor: SingleShotExecutor;
  private loopExecutor: LoopExecutor;
  private jobManager?: JobManager;

  constructor(config?: ClaudeCodeManagerConfig, jobOptions?: ClaudeCodeManagerJobOptions) {
    this.config = {
      claudeCodePath: config?.claudeCodePath || 'claude',
      workingDir: config?.workingDir || process.cwd(),
      tempDir: config?.tempDir || path.join(os.tmpdir(), 'claude-tasks'),
      skillsDir: config?.skillsDir || path.join(os.homedir(), '.claude', 'skills'),
      cleanupOnExit: config?.cleanupOnExit ?? true,
      hooks: config?.hooks,
      globalTimeout: config?.globalTimeout
    };

    const executorConfig = {
      claudeCodePath: this.config.claudeCodePath,
      tempDir: this.config.tempDir
    };

    this.singleShotExecutor = new SingleShotExecutor(executorConfig);
    this.loopExecutor = new LoopExecutor(executorConfig);

    // Initialize job manager if enabled
    if (jobOptions?.enableJobs) {
      this.jobManager = new JobManager(executorConfig, jobOptions);
    }
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
    // Call beforeIteration hook if provided
    if (this.config.hooks?.beforeIteration) {
      await this.config.hooks.beforeIteration(0);
    }

    const result = await this.loopExecutor.execute(options);

    // Call afterIteration hook if provided
    if (this.config.hooks?.afterIteration && result.iterations.length > 0) {
      await this.config.hooks.afterIteration(
        result.iterations[result.iterations.length - 1]
      );
    }

    return result;
  }

  // ============================================
  // Job Management Methods (for long-running operations)
  // ============================================

  /**
   * Start a single-shot execution as a background job.
   * Returns immediately with a job ID that can be polled for status.
   *
   * @example
   * ```typescript
   * const jobId = await manager.startJob(options);
   * // Later, poll for status
   * const status = await manager.pollJob(jobId);
   * if (status.finished) {
   *   console.log('Result:', status.result);
   * }
   * ```
   */
  async startJob<T extends z.ZodType>(
    options: ExecuteOptions<T>,
    startOptions?: StartJobOptions
  ): Promise<string> {
    this.ensureJobManager();
    return this.jobManager!.startSingleShot(options, startOptions);
  }

  /**
   * Start a loop execution as a background job.
   * Returns immediately with a job ID that can be polled for status.
   *
   * @example
   * ```typescript
   * const jobId = await manager.startLoopJob(options);
   * // Poll periodically
   * const interval = setInterval(async () => {
   *   const status = await manager.pollJob(jobId);
   *   console.log(`Progress: ${status.progress?.tasksCompleted}/${status.progress?.tasksTotal}`);
   *   if (status.finished) {
   *     clearInterval(interval);
   *     console.log('Loop completed:', status.result);
   *   }
   * }, 5000);
   * ```
   */
  async startLoopJob(
    options: ExecuteLoopOptions,
    startOptions?: StartJobOptions
  ): Promise<string> {
    this.ensureJobManager();
    return this.jobManager!.startLoop(options, startOptions);
  }

  /**
   * Poll for job status.
   * This is the main method for checking job progress without blocking.
   */
  async pollJob(jobId: string): Promise<JobPollResult> {
    this.ensureJobManager();
    return this.jobManager!.poll(jobId);
  }

  /**
   * Wait for a job to complete (blocking).
   * Use this only when you want synchronous behavior with polling internally.
   *
   * @param jobId - The job ID to wait for
   * @param pollIntervalMs - Polling interval in milliseconds (default: 1000)
   */
  async waitForJob(jobId: string, pollIntervalMs?: number): Promise<JobPollResult> {
    this.ensureJobManager();
    return this.jobManager!.waitForCompletion(jobId, pollIntervalMs);
  }

  /**
   * Cancel a running job.
   * Returns true if the job was cancelled, false if it was already finished.
   */
  async cancelJob(jobId: string): Promise<boolean> {
    this.ensureJobManager();
    return this.jobManager!.cancel(jobId);
  }

  /**
   * Get a job by ID.
   */
  async getJob(jobId: string): Promise<Job | undefined> {
    this.ensureJobManager();
    return this.jobManager!.getJob(jobId);
  }

  /**
   * Get all jobs, optionally filtered by status.
   */
  async getAllJobs(status?: JobStatus | JobStatus[]): Promise<Job[]> {
    this.ensureJobManager();
    return this.jobManager!.getAllJobs(status);
  }

  /**
   * Delete a completed job from the store.
   */
  async deleteJob(jobId: string): Promise<void> {
    this.ensureJobManager();
    return this.jobManager!.deleteJob(jobId);
  }

  /**
   * Set event handlers for job lifecycle events.
   */
  setJobEventHandlers(events: JobEvents): void {
    this.ensureJobManager();
    this.jobManager!.setEventHandlers(events);
  }

  /**
   * Get the number of currently running jobs.
   */
  getRunningJobsCount(): number {
    if (!this.jobManager) return 0;
    return this.jobManager.getRunningCount();
  }

  /**
   * Cleanup old completed jobs.
   * Returns the number of jobs deleted.
   */
  async cleanupJobs(): Promise<number> {
    this.ensureJobManager();
    return this.jobManager!.cleanup();
  }

  /**
   * Close the manager and release resources.
   */
  close(): void {
    this.jobManager?.close();
  }

  private ensureJobManager(): void {
    if (!this.jobManager) {
      throw new Error(
        'Job management is not enabled. ' +
        'Initialize ClaudeCodeManager with { enableJobs: true } to use job features.'
      );
    }
  }

  static async installSkills(skillsDir?: string): Promise<void> {
    const dir = skillsDir || path.join(os.homedir(), '.claude', 'skills');
    const installer = new SkillInstaller(dir);

    if (await installer.isInstalled()) {
      return; // Already installed
    }

    await installer.install();
  }
}
