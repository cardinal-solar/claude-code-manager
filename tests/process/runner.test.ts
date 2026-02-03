import { describe, it, expect } from 'vitest';
import { ProcessRunner } from '../../src/process/runner';

describe('ProcessRunner', () => {
  it('should run a simple command and capture output', async () => {
    const runner = new ProcessRunner();
    const result = await runner.run({
      command: 'echo',
      args: ['hello world'],
      timeout: 5000
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('hello world');
  });

  it('should handle command timeout', async () => {
    const runner = new ProcessRunner();

    await expect(
      runner.run({
        command: 'sleep',
        args: ['10'],
        timeout: 100
      })
    ).rejects.toThrow('timed out');
  }, 10000);
});
