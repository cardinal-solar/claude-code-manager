import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PRD } from '../../src/ralph/prd';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('PRD', () => {
  let tempDir: string;
  let prdPath: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `test-prd-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    prdPath = path.join(tempDir, 'prd.json');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create PRD from spec', () => {
    const prd = PRD.create({
      project: 'Test Project',
      branchName: 'ralph/test',
      description: 'Test description',
      userStories: [
        {
          id: 'US-001',
          title: 'Test story',
          description: 'Test',
          acceptanceCriteria: ['Criteria 1'],
          priority: 1,
          estimatedComplexity: 2,
          passes: false
        }
      ]
    });

    expect(prd.getProject()).toBe('Test Project');
    expect(prd.getBranchName()).toBe('ralph/test');
    expect(prd.getUserStories()).toHaveLength(1);
  });

  it('should save and load PRD', async () => {
    const prd = PRD.create({
      project: 'Test',
      branchName: 'test',
      description: 'desc',
      userStories: []
    });

    await prd.save(prdPath);

    const loaded = await PRD.load(prdPath);
    expect(loaded.getProject()).toBe('Test');
  });

  it('should get next story', () => {
    const prd = PRD.create({
      project: 'Test',
      branchName: 'test',
      description: 'desc',
      userStories: [
        {
          id: 'US-001',
          title: 'Story 1',
          description: 'Test',
          acceptanceCriteria: [],
          priority: 2,
          estimatedComplexity: 1,
          passes: false
        },
        {
          id: 'US-002',
          title: 'Story 2',
          description: 'Test',
          acceptanceCriteria: [],
          priority: 1,
          estimatedComplexity: 1,
          passes: false
        }
      ]
    });

    const next = prd.getNextStory();
    expect(next?.id).toBe('US-002'); // Higher priority (1 < 2)
  });

  it('should update story status', async () => {
    const prd = PRD.create({
      project: 'Test',
      branchName: 'test',
      description: 'desc',
      userStories: [
        {
          id: 'US-001',
          title: 'Story 1',
          description: 'Test',
          acceptanceCriteria: [],
          priority: 1,
          estimatedComplexity: 1,
          passes: false
        }
      ]
    });

    prd.updateStory('US-001', { passes: true });

    const story = prd.getUserStories()[0];
    expect(story.passes).toBe(true);
  });
});
