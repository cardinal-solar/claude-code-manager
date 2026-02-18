import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  Job,
  SingleShotJob,
  LoopJob,
  JobPollResult,
  JobStatus,
  JobManagerOptions,
  JobEvents,
  StartJobOptions
} from './types';
import { JobStore } from './store';
import {
  ExecuteOptions,
  ExecuteLoopOptions,
  CancellationToken,
  IterationResult
} from '../types';
import { SingleShotExecutor } from '../executors/single-shot';
import { LoopExecutor } from '../executors/loop';

interface ExecutorConfig {
  claudeCodePath: string;
  tempDir: string;
}

/**
 * JobManager handles the lifecycle of background jobs.
 * Jobs are executed asynchronously and can be polled for status.
 */
export class JobManager {
  private store: JobStore;
  private singleShotExecutor: SingleShotExecutor;
  private loopExecutor: LoopExecutor;
  private cancellationTokens: Map<string, CancellationToken> = new Map();
  private runningJobs: Map<string, Promise<void>> = new Map();
  private events: JobEvents;
  private maxConcurrentJobs: number;
  private initialized = false;

  constructor(
    executorConfig: ExecutorConfig,
    options: JobManagerOptions = {}
  ) {
    this.store = new JobStore({
      persistToFile: options.persistToFile,
      storeDir: options.storeDir,
      maxJobAge: options.maxJobAge,
      cleanupInterval: options.cleanupInterval
    });

    this.singleShotExecutor = new SingleShotExecutor(executorConfig);
    this.loopExecutor = new LoopExecutor(executorConfig);
    this.events = {};
    this.maxConcurrentJobs = options.maxConcurrentJobs ?? Infinity;
  }

  /**
   * Initialize the job manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.store.initialize();
    this.initialized = true;
  }

  /**
   * Set event handlers
   */
  setEventHandlers(events: JobEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Start a single-shot job in the background
   * Returns immediately with the job ID for polling
   */
  async startSingleShot<T extends z.ZodType>(
    options: ExecuteOptions<T>,
    startOptions: StartJobOptions = {}
  ): Promise<string> {
    await this.ensureInitialized();
    this.checkConcurrencyLimit();

    const jobId = startOptions.jobId ?? randomUUID();

    const job: SingleShotJob<T> = {
      id: jobId,
      type: 'single-shot',
      status: 'pending',
      createdAt: new Date(),
      options,
      progress: {
        currentIteration: 0,
        tasksCompleted: 0,
        tasksTotal: 1,
        lastUpdate: new Date(),
        message: 'Job created'
      }
    };

    await this.store.save(job);

    // Start execution in background (non-blocking)
    const executionPromise = this.executeSingleShot(job);
    this.runningJobs.set(jobId, executionPromise);

    // Clean up running jobs map when done
    executionPromise.finally(() => {
      this.runningJobs.delete(jobId);
    });

    return jobId;
  }

  /**
   * Start a loop job in the background
   * Returns immediately with the job ID for polling
   */
  async startLoop(
    options: ExecuteLoopOptions,
    startOptions: StartJobOptions = {}
  ): Promise<string> {
    await this.ensureInitialized();
    this.checkConcurrencyLimit();

    const jobId = startOptions.jobId ?? randomUUID();

    // Create cancellation token for this job
    const cancelToken = new CancellationToken();
    this.cancellationTokens.set(jobId, cancelToken);

    const job: LoopJob = {
      id: jobId,
      type: 'loop',
      status: 'pending',
      createdAt: new Date(),
      options: { ...options, cancelToken },
      iterations: [],
      progress: {
        currentIteration: 0,
        tasksCompleted: 0,
        tasksTotal: 0, // Will be updated when PRD is loaded
        lastUpdate: new Date(),
        message: 'Job created'
      }
    };

    await this.store.save(job);

    // Start execution in background (non-blocking)
    const executionPromise = this.executeLoop(job);
    this.runningJobs.set(jobId, executionPromise);

    // Clean up running jobs map when done
    executionPromise.finally(() => {
      this.runningJobs.delete(jobId);
      this.cancellationTokens.delete(jobId);
    });

    return jobId;
  }

  /**
   * Poll for job status
   * This is the main method for checking job progress
   */
  async poll(jobId: string): Promise<JobPollResult> {
    await this.ensureInitialized();

    const job = this.store.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const finished = ['completed', 'failed', 'cancelled'].includes(job.status);
    const duration = finished && job.completedAt && job.startedAt
      ? job.completedAt.getTime() - job.startedAt.getTime()
      : undefined;

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      finished,
      result: finished ? job.result : undefined,
      error: job.error,
      duration
    };
  }

  /**
   * Wait for a job to complete with polling
   * Useful for simpler use cases where blocking is acceptable
   */
  async waitForCompletion(
    jobId: string,
    pollIntervalMs: number = 1000
  ): Promise<JobPollResult> {
    for (;;) {
      const result = await this.poll(jobId);
      if (result.finished) {
        return result;
      }
      await this.sleep(pollIntervalMs);
    }
  }

  /**
   * Cancel a running job
   */
  async cancel(jobId: string): Promise<boolean> {
    await this.ensureInitialized();

    const job = this.store.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      return false; // Already finished
    }

    // Trigger cancellation token
    const token = this.cancellationTokens.get(jobId);
    if (token) {
      token.cancel();
    }

    await this.store.updateStatus(jobId, 'cancelled');
    await this.events.onJobCancelled?.(job);

    return true;
  }

  /**
   * Get a job by ID
   */
  async getJob(jobId: string): Promise<Job | undefined> {
    await this.ensureInitialized();
    return this.store.get(jobId);
  }

  /**
   * Get all jobs, optionally filtered by status
   */
  async getAllJobs(status?: JobStatus | JobStatus[]): Promise<Job[]> {
    await this.ensureInitialized();
    return this.store.getAll(status);
  }

  /**
   * Get count of running jobs
   */
  getRunningCount(): number {
    return this.runningJobs.size;
  }

  /**
   * Delete a completed job from the store
   */
  async deleteJob(jobId: string): Promise<void> {
    await this.ensureInitialized();
    const job = this.store.get(jobId);
    if (job && !['completed', 'failed', 'cancelled'].includes(job.status)) {
      throw new Error('Cannot delete a running job. Cancel it first.');
    }
    await this.store.delete(jobId);
  }

  /**
   * Cleanup old jobs
   */
  async cleanup(): Promise<number> {
    await this.ensureInitialized();
    return this.store.cleanup();
  }

  /**
   * Close the job manager
   */
  close(): void {
    this.store.close();
  }

  // Private execution methods

  private async executeSingleShot<T extends z.ZodType>(job: SingleShotJob<T>): Promise<void> {
    try {
      await this.store.updateStatus(job.id, 'running');
      await this.store.updateProgress(job.id, {
        message: 'Executing task...'
      });
      await this.events.onJobStarted?.(job);

      const result = await this.singleShotExecutor.execute(job.options);

      await this.store.updateResult(job.id, result);
      await this.store.updateProgress(job.id, {
        tasksCompleted: 1,
        message: result.success ? 'Task completed' : 'Task failed'
      });
      await this.store.updateStatus(job.id, result.success ? 'completed' : 'failed');

      const updatedJob = this.store.get(job.id)!;
      await this.events.onJobCompleted?.(updatedJob);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.store.updateStatus(job.id, 'failed', errorMessage);
      await this.store.updateProgress(job.id, {
        message: `Error: ${errorMessage}`
      });

      const updatedJob = this.store.get(job.id)!;
      await this.events.onJobFailed?.(updatedJob, error as Error);
    }
  }

  private async executeLoop(job: LoopJob): Promise<void> {
    try {
      await this.store.updateStatus(job.id, 'running');
      await this.store.updateProgress(job.id, {
        message: 'Starting loop execution...'
      });
      await this.events.onJobStarted?.(job);

      // Wrap the executor to capture progress updates
      const wrappedOptions: ExecuteLoopOptions = {
        ...job.options,
        onIteration: async (iteration: IterationResult) => {
          // Update job with iteration result
          const currentJob = this.store.get(job.id) as LoopJob;
          if (currentJob) {
            currentJob.iterations.push(iteration);
            await this.store.save(currentJob);
          }

          // Update progress
          await this.store.updateProgress(job.id, {
            currentIteration: iteration.iteration,
            currentTaskId: iteration.taskId,
            tasksCompleted: iteration.success
              ? (currentJob?.progress?.tasksCompleted ?? 0) + 1
              : currentJob?.progress?.tasksCompleted ?? 0,
            message: `Completed iteration ${iteration.iteration}: ${iteration.taskId}`
          });

          // Call original callback if provided
          await job.options.onIteration?.(iteration);

          // Fire progress event
          const updatedJob = this.store.get(job.id)!;
          await this.events.onJobProgress?.(updatedJob, updatedJob.progress!);
        }
      };

      const result = await this.loopExecutor.execute(wrappedOptions);

      await this.store.updateResult(job.id, result);
      await this.store.updateProgress(job.id, {
        tasksCompleted: result.finalState.tasksCompleted,
        tasksTotal: result.finalState.tasksTotal,
        message: result.completed ? 'All tasks completed' : 'Loop finished'
      });

      // Check if cancelled
      const currentStatus = this.store.get(job.id)?.status;
      if (currentStatus !== 'cancelled') {
        await this.store.updateStatus(job.id, result.success ? 'completed' : 'failed');
      }

      const updatedJob = this.store.get(job.id)!;
      await this.events.onJobCompleted?.(updatedJob);
    } catch (error) {
      // Check if cancelled
      const currentStatus = this.store.get(job.id)?.status;
      if (currentStatus === 'cancelled') {
        return; // Already marked as cancelled
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.store.updateStatus(job.id, 'failed', errorMessage);
      await this.store.updateProgress(job.id, {
        message: `Error: ${errorMessage}`
      });

      const updatedJob = this.store.get(job.id)!;
      await this.events.onJobFailed?.(updatedJob, error as Error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private checkConcurrencyLimit(): void {
    if (this.runningJobs.size >= this.maxConcurrentJobs) {
      throw new Error(
        `Maximum concurrent jobs limit reached (${this.maxConcurrentJobs}). ` +
        'Wait for some jobs to complete or increase the limit.'
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
