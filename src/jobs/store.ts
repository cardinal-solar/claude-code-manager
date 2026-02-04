import * as fs from 'fs/promises';
import * as path from 'path';
import {
  Job,
  JobStatus,
  JobStoreOptions,
  SerializedJob,
  JobProgress
} from './types';

const DEFAULT_MAX_JOB_AGE = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * JobStore manages the persistence and retrieval of job state.
 * Supports both in-memory storage and optional file-based persistence.
 */
export class JobStore {
  private jobs: Map<string, Job> = new Map();
  private options: Required<JobStoreOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: JobStoreOptions = {}) {
    this.options = {
      persistToFile: options.persistToFile ?? false,
      storeDir: options.storeDir ?? path.join(process.cwd(), '.claude-jobs'),
      maxJobAge: options.maxJobAge ?? DEFAULT_MAX_JOB_AGE,
      cleanupInterval: options.cleanupInterval ?? DEFAULT_CLEANUP_INTERVAL
    };

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Initialize the store, loading persisted jobs if enabled
   */
  async initialize(): Promise<void> {
    if (this.options.persistToFile) {
      await this.ensureStoreDir();
      await this.loadPersistedJobs();
    }
  }

  /**
   * Save a job to the store
   */
  async save(job: Job): Promise<void> {
    this.jobs.set(job.id, job);

    if (this.options.persistToFile) {
      await this.persistJob(job);
    }
  }

  /**
   * Get a job by ID
   */
  get(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs, optionally filtered by status
   */
  getAll(status?: JobStatus | JobStatus[]): Job[] {
    const allJobs = Array.from(this.jobs.values());

    if (!status) {
      return allJobs;
    }

    const statuses = Array.isArray(status) ? status : [status];
    return allJobs.filter(job => statuses.includes(job.status));
  }

  /**
   * Update job status
   */
  async updateStatus(jobId: string, status: JobStatus, error?: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.status = status;

    if (status === 'running' && !job.startedAt) {
      job.startedAt = new Date();
    }

    if (['completed', 'failed', 'cancelled'].includes(status)) {
      job.completedAt = new Date();
    }

    if (error) {
      job.error = error;
    }

    await this.save(job);
  }

  /**
   * Update job progress
   */
  async updateProgress(jobId: string, progress: Partial<JobProgress>): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.progress = {
      ...job.progress,
      currentIteration: progress.currentIteration ?? job.progress?.currentIteration ?? 0,
      totalIterations: progress.totalIterations ?? job.progress?.totalIterations,
      currentTaskId: progress.currentTaskId ?? job.progress?.currentTaskId,
      tasksCompleted: progress.tasksCompleted ?? job.progress?.tasksCompleted ?? 0,
      tasksTotal: progress.tasksTotal ?? job.progress?.tasksTotal ?? 0,
      lastUpdate: new Date(),
      message: progress.message ?? job.progress?.message
    };

    await this.save(job);
  }

  /**
   * Update job result
   */
  async updateResult(jobId: string, result: any): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.result = result;
    await this.save(job);
  }

  /**
   * Delete a job from the store
   */
  async delete(jobId: string): Promise<void> {
    this.jobs.delete(jobId);

    if (this.options.persistToFile) {
      const filePath = this.getJobFilePath(jobId);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        // Ignore if file doesn't exist
      }
    }
  }

  /**
   * Check if a job exists
   */
  has(jobId: string): boolean {
    return this.jobs.has(jobId);
  }

  /**
   * Get count of jobs by status
   */
  count(status?: JobStatus): number {
    if (!status) {
      return this.jobs.size;
    }
    return Array.from(this.jobs.values()).filter(j => j.status === status).length;
  }

  /**
   * Cleanup old completed jobs
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, job] of this.jobs) {
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        const completedAt = job.completedAt?.getTime() ?? job.createdAt.getTime();
        if (now - completedAt > this.options.maxJobAge) {
          toDelete.push(id);
        }
      }
    }

    for (const id of toDelete) {
      await this.delete(id);
    }

    return toDelete.length;
  }

  /**
   * Stop the cleanup timer and close the store
   */
  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  // Private methods

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(
      () => this.cleanup(),
      this.options.cleanupInterval
    );
    // Don't keep process alive just for cleanup
    this.cleanupTimer.unref();
  }

  private async ensureStoreDir(): Promise<void> {
    await fs.mkdir(this.options.storeDir, { recursive: true });
  }

  private getJobFilePath(jobId: string): string {
    return path.join(this.options.storeDir, `${jobId}.json`);
  }

  private async persistJob(job: Job): Promise<void> {
    const serialized = this.serializeJob(job);
    const filePath = this.getJobFilePath(job.id);
    await fs.writeFile(filePath, JSON.stringify(serialized, null, 2), 'utf-8');
  }

  private async loadPersistedJobs(): Promise<void> {
    try {
      const files = await fs.readdir(this.options.storeDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.options.storeDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const serialized: SerializedJob = JSON.parse(content);
          const job = this.deserializeJob(serialized);

          // Only load jobs that are still relevant
          if (!['completed', 'failed', 'cancelled'].includes(job.status)) {
            // Mark running jobs as failed on restart (they were interrupted)
            if (job.status === 'running') {
              job.status = 'failed';
              job.error = 'Job was interrupted by process restart';
              job.completedAt = new Date();
            }
            this.jobs.set(job.id, job);
          } else {
            // Check if completed job is still within max age
            const completedAt = job.completedAt?.getTime() ?? job.createdAt.getTime();
            if (Date.now() - completedAt < this.options.maxJobAge) {
              this.jobs.set(job.id, job);
            } else {
              // Delete old job file
              await fs.unlink(filePath);
            }
          }
        } catch (err) {
          // Skip invalid job files
          console.error(`Failed to load job file ${file}:`, err);
        }
      }
    } catch (err) {
      // Directory doesn't exist or other error, start fresh
    }
  }

  private serializeJob(job: Job): SerializedJob {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      error: job.error,
      progress: job.progress,
      options: this.serializeOptions(job.options),
      result: job.result,
      iterations: job.type === 'loop' ? job.iterations : undefined
    };
  }

  private deserializeJob(serialized: SerializedJob): Job {
    const base = {
      id: serialized.id,
      status: serialized.status,
      createdAt: new Date(serialized.createdAt),
      startedAt: serialized.startedAt ? new Date(serialized.startedAt) : undefined,
      completedAt: serialized.completedAt ? new Date(serialized.completedAt) : undefined,
      error: serialized.error,
      progress: serialized.progress ? {
        ...serialized.progress,
        lastUpdate: new Date(serialized.progress.lastUpdate)
      } : undefined
    };

    if (serialized.type === 'loop') {
      return {
        ...base,
        type: 'loop',
        options: serialized.options,
        result: serialized.result,
        iterations: serialized.iterations || []
      };
    }

    return {
      ...base,
      type: 'single-shot',
      options: serialized.options,
      result: serialized.result
    };
  }

  private serializeOptions(options: any): any {
    // Remove non-serializable options like callbacks
    const { onIteration, cancelToken, onOutput, ...serializable } = options;

    // Convert schema to a placeholder if it's a Zod schema
    if (serializable.schema && typeof serializable.schema.parse === 'function') {
      serializable.schemaType = 'zod';
      // Store schema description if available
      serializable.schemaDescription = serializable.schema.description;
      delete serializable.schema;
    }

    return serializable;
  }
}
