import { PRD } from '../ralph/prd';
import { ProgressTracker } from '../ralph/progress';
import { SingleShotExecutor } from './single-shot';
import { z } from 'zod';
import {
  ExecuteLoopOptions,
  LoopResult,
  IterationResult,
  TaskState
} from '../types';
import { TaskIncompleteError } from '../errors';

interface LoopConfig {
  claudeCodePath: string;
  tempDir: string;
}

export class LoopExecutor {
  private singleShotExecutor: SingleShotExecutor;

  constructor(private config: LoopConfig) {
    this.singleShotExecutor = new SingleShotExecutor(config);
  }

  async execute(options: ExecuteLoopOptions): Promise<LoopResult> {
    const startTime = Date.now();
    const iterations: IterationResult[] = [];

    try {
      // Load PRD
      const prd = await PRD.load(options.taskFile);

      // Initialize progress tracker if specified
      let progressPath: string | undefined;
      if (options.progressFile) {
        progressPath = options.progressFile;
        await ProgressTracker.initialize(progressPath);
      }

      // Main loop
      let iteration = 0;
      const maxIterations = options.maxIterations || 100;

      while (iteration < maxIterations) {
        iteration++;

        // Get next story
        const story = prd.getNextStory();

        if (!story) {
          // All stories completed
          const finalState: TaskState = {
            mode: (options.mode as 'code' | 'research') || 'code',
            tasksTotal: prd.getUserStories().length,
            tasksCompleted: prd.getUserStories().filter(s => s.passes).length,
            tasks: prd.getUserStories()
          };

          return {
            success: true,
            completed: true,
            iterations,
            totalDuration: Date.now() - startTime,
            finalState,
            progressLog: progressPath
              ? await ProgressTracker.read(progressPath).then(p =>
                  p.entries.map(e => `${e.storyId}: ${e.summary}`).join('\n')
                )
              : ''
          };
        }

        // Build prompt for this story
        const prompt = this.buildStoryPrompt(story, options.mode);

        // Create schema for story result
        const storySchema = z.object({
          success: z.boolean(),
          summary: z.string(),
          filesChanged: z.array(z.string()),
          learnings: z.array(z.string()).optional(),
          passes: z.boolean()
        });

        // Execute story
        const result = await this.singleShotExecutor.execute({
          prompt,
          schema: storySchema,
          timeout: options.processOptions?.timeout,
          env: options.env,
          model: options.model,
          permissionMode: options.permissionMode,
        });

        // Record iteration
        const iterResult: IterationResult = {
          iteration,
          taskId: story.id,
          success: result.success,
          duration: result.duration,
          commits: [] // TODO: extract from git if ralphOptions.gitAutoCommit
        };

        iterations.push(iterResult);

        // Call iteration hook
        if (options.onIteration) {
          options.onIteration(iterResult);
        }

        if (result.success && result.data) {
          // Update story status
          if (result.data.passes) {
            prd.markStoryComplete(story.id);
          }

          // Update progress tracker
          if (progressPath) {
            await ProgressTracker.append(progressPath, {
              storyId: story.id,
              summary: result.data.summary,
              filesChanged: result.data.filesChanged,
              learnings: result.data.learnings || []
            });
          }

          // Save updated PRD
          await prd.save(options.taskFile);
        } else {
          // Story failed - depending on error strategy, continue or stop
          if (options.errorStrategy?.mode === 'fail-fast') {
            throw new TaskIncompleteError(
              prd.getUserStories().filter(s => s.passes).length,
              prd.getUserStories().length
            );
          }
        }

        // Check cancellation
        if (options.cancelToken?.isCancelled()) {
          break;
        }
      }

      // Max iterations reached
      const finalState: TaskState = {
        mode: (options.mode as 'code' | 'research') || 'code',
        tasksTotal: prd.getUserStories().length,
        tasksCompleted: prd.getUserStories().filter(s => s.passes).length,
        tasks: prd.getUserStories()
      };

      return {
        success: false,
        completed: false,
        iterations,
        totalDuration: Date.now() - startTime,
        finalState,
        progressLog: progressPath
          ? await ProgressTracker.read(progressPath).then(p =>
              p.entries.map(e => `${e.storyId}: ${e.summary}`).join('\n')
            )
          : ''
      };
    } catch (error) {
      // Error during loop
      const finalState: TaskState = {
        mode: (options.mode as 'code' | 'research') || 'code',
        tasksTotal: 0,
        tasksCompleted: 0,
        tasks: []
      };

      return {
        success: false,
        completed: false,
        iterations,
        totalDuration: Date.now() - startTime,
        finalState,
        progressLog: ''
      };
    }
  }

  private buildStoryPrompt(story: any, mode?: string): string {
    const modePrefix = mode === 'code'
      ? 'Implement the following user story:'
      : mode === 'research'
      ? 'Research and document the following:'
      : 'Complete the following task:';

    return `${modePrefix}

**Story ID:** ${story.id}
**Title:** ${story.title}
**Description:** ${story.description}

**Acceptance Criteria:**
${story.acceptanceCriteria.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}

**Priority:** ${story.priority}
**Estimated Complexity:** ${story.estimatedComplexity}

Please complete this task and provide:
1. A summary of what was done
2. List of files changed
3. Any learnings for future iterations
4. Whether all acceptance criteria are met (passes: true/false)

Return your response as JSON with the following structure:
{
  "success": boolean,
  "summary": "description of work done",
  "filesChanged": ["file1.ts", "file2.ts"],
  "learnings": ["learning 1", "learning 2"],
  "passes": boolean (true if all acceptance criteria met)
}`;
  }
}
