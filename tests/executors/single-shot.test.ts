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
