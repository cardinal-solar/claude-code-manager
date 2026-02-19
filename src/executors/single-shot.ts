import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { FileManager } from '../files/file-manager';
import { SchemaValidator } from '../validation/schema';
import { ProcessRunner } from '../process/runner';
import { ExecuteOptions, ExecuteResult } from '../types';
import { ProcessError, ValidationError } from '../errors';

interface SingleShotConfig {
  claudeCodePath: string;
  tempDir: string;
}

export class SingleShotExecutor {
  private fileManager: FileManager;
  private processRunner: ProcessRunner;

  constructor(private config: SingleShotConfig) {
    this.fileManager = new FileManager(config.tempDir);
    this.processRunner = new ProcessRunner();
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

      // Build Claude Code command
      const prompt = this.buildPrompt(options.prompt, options.variables);
      const jsonSchema = SchemaValidator.toJsonSchema(options.schema);

      // Build args for non-interactive execution
      const permissionMode = options.permissionMode || 'bypassPermissions';
      const args = [
        '--print',                              // Non-interactive mode
        '--permission-mode', permissionMode,    // Permission mode (configurable)
        '--output-format', 'json',              // JSON output
        '--json-schema', JSON.stringify(jsonSchema), // Schema validation
        '--no-session-persistence',             // Don't save session
        prompt                                   // The prompt
      ];

      if (options.skill) {
        args.unshift('--skill', options.skill);
      }

      if (options.model) {
        args.unshift('--model', options.model);
      }

      // Execute Claude Code
      const result = await this.processRunner.run({
        command: this.config.claudeCodePath,
        args,
        cwd: taskDir,
        timeout: options.timeout,
        env: options.env,
      });

      if (result.exitCode !== 0) {
        throw new ProcessError(
          `Claude Code exited with code ${result.exitCode}: ${result.error}`,
          result.exitCode ?? null,
          result.signal
        );
      }

      // Parse JSON output from Claude Code
      let claudeResult: any;
      try {
        claudeResult = JSON.parse(result.output);
      } catch (parseError) {
        throw new ValidationError(
          'Failed to parse Claude Code JSON output',
          new Error(`Parse error: ${parseError}`) as any
        );
      }

      // Extract structured_output from Claude Code result
      const resultData = claudeResult.structured_output;

      if (!resultData) {
        throw new ValidationError(
          'No structured_output in Claude Code result',
          new Error('Missing structured_output field') as any
        );
      }

      // Validate against schema
      const validation = SchemaValidator.validate(resultData, options.schema);

      if (!validation.success) {
        throw new ValidationError('Result validation failed', validation.error);
      }

      // Logs from stderr
      const logs = result.error || 'No logs';

      // List artifacts (if any were created in task directory)
      const artifacts = await this.fileManager.listArtifacts(taskDir);

      return {
        success: true,
        outputDir: taskDir,
        logs,
        duration: Date.now() - startTime,
        data: validation.data,
        artifacts
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

  private buildPrompt(prompt: string, variables?: Record<string, any>): string {
    // If variables provided, substitute them in the prompt
    if (variables && Object.keys(variables).length > 0) {
      let processedPrompt = prompt;
      for (const [key, value] of Object.entries(variables)) {
        processedPrompt = processedPrompt.replace(
          new RegExp(`\\{${key}\\}`, 'g'),
          String(value)
        );
      }
      return processedPrompt;
    }
    return prompt;
  }
}
