import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProgressTracker } from '../../src/ralph/progress';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ProgressTracker', () => {
  let tempDir: string;
  let progressPath: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `test-progress-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    progressPath = path.join(tempDir, 'progress.txt');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should initialize progress file', async () => {
    await ProgressTracker.initialize(progressPath);

    const content = await fs.readFile(progressPath, 'utf-8');
    expect(content).toContain('Ralph Progress Log');
  });

  it('should append entry to progress', async () => {
    await ProgressTracker.initialize(progressPath);

    await ProgressTracker.append(progressPath, {
      storyId: 'US-001',
      summary: 'Implemented feature',
      filesChanged: ['file1.ts', 'file2.ts'],
      learnings: ['Learning 1', 'Learning 2']
    });

    const content = await fs.readFile(progressPath, 'utf-8');
    expect(content).toContain('US-001');
    expect(content).toContain('Implemented feature');
    expect(content).toContain('Learning 1');
  });

  it('should read progress log', async () => {
    await ProgressTracker.initialize(progressPath);

    await ProgressTracker.append(progressPath, {
      storyId: 'US-001',
      summary: 'Test',
      filesChanged: [],
      learnings: ['Learning 1']
    });

    const log = await ProgressTracker.read(progressPath);
    expect(log.entries).toHaveLength(1);
    expect(log.learnings).toContain('Learning 1');
  });
});
