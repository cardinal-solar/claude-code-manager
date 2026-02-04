/**
 * Example: Job Polling System
 *
 * This example demonstrates how to use the job polling system for long-running
 * operations. Instead of blocking Node.js threads with await, you can:
 *
 * 1. Start a job and get a job ID immediately
 * 2. Poll periodically to check status
 * 3. Handle completion when ready
 *
 * This pattern is ideal for:
 * - Job schedulers (cron, Bull, Agenda, etc.)
 * - Serverless functions with timeout limits
 * - APIs that need to return quickly
 * - Monitoring dashboards
 */

import { z } from 'zod';
import { ClaudeCodeManager, JobPollResult } from '../src';

// =============================================================================
// Example 1: Basic Job Polling
// =============================================================================

async function basicJobPolling() {
  console.log('\n=== Example 1: Basic Job Polling ===\n');

  // Initialize manager with job support enabled
  const manager = new ClaudeCodeManager(
    { claudeCodePath: 'claude' },
    {
      enableJobs: true,
      persistToFile: false // In-memory only for this example
    }
  );

  // Define a schema for the expected output
  const outputSchema = z.object({
    result: z.string(),
    confidence: z.number()
  });

  // Start a job - returns immediately with job ID
  const jobId = await manager.startJob({
    prompt: 'Analyze this code snippet and provide your assessment',
    schema: outputSchema
  });

  console.log(`Job started with ID: ${jobId}`);

  // Poll for status (simulating external polling, e.g., from a cron job)
  let pollCount = 0;
  const pollInterval = setInterval(async () => {
    pollCount++;
    const status = await manager.pollJob(jobId);

    console.log(`Poll #${pollCount}: Status = ${status.status}`);

    if (status.progress) {
      console.log(`  Progress: ${status.progress.message}`);
    }

    if (status.finished) {
      clearInterval(pollInterval);

      if (status.status === 'completed') {
        console.log('\nJob completed successfully!');
        console.log('Result:', status.result);
        console.log(`Duration: ${status.duration}ms`);
      } else {
        console.log('\nJob failed:', status.error);
      }

      manager.close();
    }
  }, 2000); // Poll every 2 seconds
}

// =============================================================================
// Example 2: Loop Job with Progress Tracking
// =============================================================================

async function loopJobWithProgress() {
  console.log('\n=== Example 2: Loop Job with Progress Tracking ===\n');

  const manager = new ClaudeCodeManager(
    { claudeCodePath: 'claude' },
    {
      enableJobs: true,
      persistToFile: true,
      storeDir: './.claude-jobs' // Persist to disk for crash recovery
    }
  );

  // Set up event handlers for real-time notifications
  manager.setJobEventHandlers({
    onJobStarted: (job) => {
      console.log(`[Event] Job ${job.id} started`);
    },
    onJobProgress: (job, progress) => {
      console.log(
        `[Event] Job ${job.id} progress: ` +
          `${progress.tasksCompleted}/${progress.tasksTotal} tasks completed`
      );
    },
    onJobCompleted: (job) => {
      console.log(`[Event] Job ${job.id} completed`);
    },
    onJobFailed: (job, error) => {
      console.log(`[Event] Job ${job.id} failed:`, error.message);
    }
  });

  // Start a loop job
  const jobId = await manager.startLoopJob({
    taskFile: './examples/test-prd.json',
    maxIterations: 10,
    progressFile: './examples/job-progress.txt'
  });

  console.log(`Loop job started with ID: ${jobId}`);
  console.log('Polling for progress...\n');

  // Poll with detailed progress information
  const checkProgress = async (): Promise<JobPollResult> => {
    const status = await manager.pollJob(jobId);

    if (status.progress) {
      const { currentIteration, tasksCompleted, tasksTotal, currentTaskId, message } =
        status.progress;

      console.log(`[${new Date().toISOString()}] Status: ${status.status}`);
      console.log(`  Iteration: ${currentIteration}`);
      console.log(`  Progress: ${tasksCompleted}/${tasksTotal} tasks`);
      if (currentTaskId) {
        console.log(`  Current task: ${currentTaskId}`);
      }
      if (message) {
        console.log(`  Message: ${message}`);
      }
      console.log('');
    }

    return status;
  };

  // Poll until completion
  while (true) {
    const status = await checkProgress();
    if (status.finished) {
      console.log('Final result:', JSON.stringify(status.result, null, 2));
      break;
    }
    await sleep(5000); // Poll every 5 seconds
  }

  manager.close();
}

// =============================================================================
// Example 3: Job Scheduler Integration Pattern
// =============================================================================

/**
 * This pattern shows how to integrate with external job schedulers.
 * The scheduler starts jobs and stores IDs; a separate worker polls for completion.
 */

class JobSchedulerIntegration {
  private manager: ClaudeCodeManager;
  private pendingJobs: Map<string, { callback: (result: any) => void }> = new Map();

  constructor() {
    this.manager = new ClaudeCodeManager(
      { claudeCodePath: 'claude' },
      {
        enableJobs: true,
        persistToFile: true,
        storeDir: './.claude-jobs',
        maxConcurrentJobs: 5 // Limit concurrent executions
      }
    );
  }

  /**
   * Called by the job scheduler to queue a new task.
   * Returns immediately with the job ID.
   */
  async queueTask(
    taskFile: string,
    onComplete: (result: any) => void
  ): Promise<string> {
    const jobId = await this.manager.startLoopJob({
      taskFile,
      maxIterations: 100
    });

    this.pendingJobs.set(jobId, { callback: onComplete });
    console.log(`Queued job ${jobId} for task file: ${taskFile}`);

    return jobId;
  }

  /**
   * Called periodically by the scheduler (e.g., every minute via cron).
   * Checks all pending jobs and handles completions.
   */
  async pollPendingJobs(): Promise<void> {
    console.log(`\nPolling ${this.pendingJobs.size} pending jobs...`);

    for (const [jobId, { callback }] of this.pendingJobs) {
      try {
        const status = await this.manager.pollJob(jobId);

        console.log(`  Job ${jobId}: ${status.status}`);

        if (status.finished) {
          this.pendingJobs.delete(jobId);

          if (status.status === 'completed') {
            console.log(`  -> Completed in ${status.duration}ms`);
            callback(status.result);
          } else {
            console.log(`  -> Failed: ${status.error}`);
            callback({ error: status.error });
          }

          // Clean up the job from storage
          await this.manager.deleteJob(jobId);
        }
      } catch (error) {
        console.error(`  Error polling job ${jobId}:`, error);
      }
    }
  }

  /**
   * Get status of all running jobs (for monitoring dashboard)
   */
  async getJobsStatus(): Promise<Map<string, JobPollResult>> {
    const statuses = new Map<string, JobPollResult>();

    for (const jobId of this.pendingJobs.keys()) {
      statuses.set(jobId, await this.manager.pollJob(jobId));
    }

    return statuses;
  }

  /**
   * Cancel a specific job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const cancelled = await this.manager.cancelJob(jobId);
    if (cancelled) {
      this.pendingJobs.delete(jobId);
    }
    return cancelled;
  }

  close(): void {
    this.manager.close();
  }
}

async function schedulerIntegrationExample() {
  console.log('\n=== Example 3: Job Scheduler Integration ===\n');

  const scheduler = new JobSchedulerIntegration();

  // Simulate queuing multiple jobs
  const job1 = await scheduler.queueTask('./examples/test-prd.json', (result) => {
    console.log('\nJob 1 callback received:', result?.success ?? result?.error);
  });

  // Simulate periodic polling (like a cron job running every minute)
  console.log('\nSimulating periodic polling...');

  for (let i = 0; i < 10; i++) {
    await sleep(3000); // Wait 3 seconds between polls
    await scheduler.pollPendingJobs();

    // Check if all jobs are done
    const statuses = await scheduler.getJobsStatus();
    if (statuses.size === 0) {
      console.log('\nAll jobs completed!');
      break;
    }
  }

  scheduler.close();
}

// =============================================================================
// Example 4: Recovering Jobs After Restart
// =============================================================================

async function recoverJobsAfterRestart() {
  console.log('\n=== Example 4: Recovering Jobs After Restart ===\n');

  // This simulates recovering jobs after a process restart
  // When persistToFile is enabled, jobs are saved to disk

  const manager = new ClaudeCodeManager(
    { claudeCodePath: 'claude' },
    {
      enableJobs: true,
      persistToFile: true,
      storeDir: './.claude-jobs'
    }
  );

  // Get all jobs (including previously running ones that were interrupted)
  const allJobs = await manager.getAllJobs();
  console.log(`Found ${allJobs.length} persisted jobs`);

  // Check for interrupted jobs (marked as failed on restart)
  const failedJobs = await manager.getAllJobs('failed');
  for (const job of failedJobs) {
    if (job.error === 'Job was interrupted by process restart') {
      console.log(`Found interrupted job: ${job.id}`);
      console.log(`  Type: ${job.type}`);
      console.log(`  Created: ${job.createdAt}`);
      // You could restart this job here if needed
    }
  }

  // Check for pending jobs that never started
  const pendingJobs = await manager.getAllJobs('pending');
  console.log(`Found ${pendingJobs.length} pending jobs that never started`);

  // Cleanup old jobs
  const deleted = await manager.cleanupJobs();
  console.log(`Cleaned up ${deleted} old jobs`);

  manager.close();
}

// =============================================================================
// Utility Functions
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main() {
  const example = process.argv[2] || '1';

  switch (example) {
    case '1':
      await basicJobPolling();
      break;
    case '2':
      await loopJobWithProgress();
      break;
    case '3':
      await schedulerIntegrationExample();
      break;
    case '4':
      await recoverJobsAfterRestart();
      break;
    default:
      console.log('Usage: npx ts-node examples/job-polling.ts [1|2|3|4]');
      console.log('  1 - Basic job polling');
      console.log('  2 - Loop job with progress tracking');
      console.log('  3 - Job scheduler integration pattern');
      console.log('  4 - Recovering jobs after restart');
  }
}

main().catch(console.error);
