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
import { SkillInstaller } from './skills/installer';

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

  static async installSkills(skillsDir?: string): Promise<void> {
    const dir = skillsDir || path.join(os.homedir(), '.claude', 'skills');
    const installer = new SkillInstaller(dir);

    if (await installer.isInstalled()) {
      return; // Already installed
    }

    await installer.install();
  }
}
