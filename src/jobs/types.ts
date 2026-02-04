import { z } from 'zod';
import {
  ExecuteOptions,
  ExecuteResult,
  ExecuteLoopOptions,
  LoopResult,
  IterationResult
} from '../types';

/**
 * Job status represents the current state of a job in its lifecycle
 */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Job type distinguishes between single execution and loop execution
 */
export type JobType = 'single-shot' | 'loop';

/**
 * Base job information shared across all job types
 */
export interface JobBase {
  id: string;
  type: JobType;
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  progress?: JobProgress;
}

/**
 * Progress information for tracking job execution
 */
export interface JobProgress {
  /** Current iteration (for loop jobs) */
  currentIteration: number;
  /** Total iterations expected (for loop jobs) */
  totalIterations?: number;
  /** Current task being executed */
  currentTaskId?: string;
  /** Number of tasks completed */
  tasksCompleted: number;
  /** Total number of tasks */
  tasksTotal: number;
  /** Last update timestamp */
  lastUpdate: Date;
  /** Optional message describing current activity */
  message?: string;
}

/**
 * Single-shot job with typed schema
 */
export interface SingleShotJob<T extends z.ZodType = z.ZodType> extends JobBase {
  type: 'single-shot';
  options: ExecuteOptions<T>;
  result?: ExecuteResult<T>;
}

/**
 * Loop job for Ralph-style iterative execution
 */
export interface LoopJob extends JobBase {
  type: 'loop';
  options: ExecuteLoopOptions;
  result?: LoopResult;
  iterations: IterationResult[];
}

/**
 * Union type for all job types
 */
export type Job = SingleShotJob | LoopJob;

/**
 * Job polling result returned when checking job status
 */
export interface JobPollResult {
  id: string;
  status: JobStatus;
  progress?: JobProgress;
  /** True if job has finished (completed, failed, or cancelled) */
  finished: boolean;
  /** Result if job is completed */
  result?: ExecuteResult<any> | LoopResult;
  /** Error message if job failed */
  error?: string;
  /** Duration in milliseconds (if finished) */
  duration?: number;
}

/**
 * Options for starting a job
 */
export interface StartJobOptions {
  /** Optional custom job ID (auto-generated if not provided) */
  jobId?: string;
}

/**
 * Options for the job store
 */
export interface JobStoreOptions {
  /** Enable file-based persistence */
  persistToFile?: boolean;
  /** Directory for storing job state files */
  storeDir?: string;
  /** Max age for completed jobs in milliseconds (default: 24 hours) */
  maxJobAge?: number;
  /** Cleanup interval in milliseconds (default: 1 hour) */
  cleanupInterval?: number;
}

/**
 * Options for job manager
 */
export interface JobManagerOptions extends JobStoreOptions {
  /** Polling interval for internal checks in milliseconds */
  internalPollInterval?: number;
  /** Max concurrent jobs (default: unlimited) */
  maxConcurrentJobs?: number;
}

/**
 * Callback for job completion notification
 */
export type JobCompletionCallback = (job: Job) => void | Promise<void>;

/**
 * Callback for job progress updates
 */
export type JobProgressCallback = (jobId: string, progress: JobProgress) => void | Promise<void>;

/**
 * Event types for job manager
 */
export interface JobEvents {
  onJobStarted?: (job: Job) => void | Promise<void>;
  onJobCompleted?: (job: Job) => void | Promise<void>;
  onJobFailed?: (job: Job, error: Error) => void | Promise<void>;
  onJobCancelled?: (job: Job) => void | Promise<void>;
  onJobProgress?: (job: Job, progress: JobProgress) => void | Promise<void>;
}

/**
 * Serializable job data for persistence
 */
export interface SerializedJob {
  id: string;
  type: JobType;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  progress?: JobProgress;
  options: any;
  result?: any;
  iterations?: IterationResult[];
}
