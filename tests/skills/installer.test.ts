import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillInstaller } from '../../src/skills/installer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('SkillInstaller', () => {
  let installer: SkillInstaller;
  let tempSkillsDir: string;

  beforeEach(async () => {
    tempSkillsDir = path.join(os.tmpdir(), `test-skills-${Date.now()}`);
    await fs.mkdir(tempSkillsDir, { recursive: true });
    installer = new SkillInstaller(tempSkillsDir);
  });

  afterEach(async () => {
    await fs.rm(tempSkillsDir, { recursive: true, force: true });
  });

  it('should check if skills are installed', async () => {
    const installed = await installer.isInstalled();
    expect(installed).toBe(false);
  });

  it('should install skills', async () => {
    await installer.install();

    const installed = await installer.isInstalled();
    expect(installed).toBe(true);

    const executeTaskPath = path.join(
      tempSkillsDir,
      'claude-code-manager',
      'execute-task.md'
    );
    const exists = await fs.access(executeTaskPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });
});
