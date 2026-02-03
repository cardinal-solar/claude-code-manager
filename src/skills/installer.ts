import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillInstallError } from '../errors';

export class SkillInstaller {
  private skillDir: string;

  constructor(private skillsBaseDir: string) {
    this.skillDir = path.join(skillsBaseDir, 'claude-code-manager');
  }

  async isInstalled(): Promise<boolean> {
    try {
      await fs.access(this.skillDir);
      return true;
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    try {
      // Create skill directory
      await fs.mkdir(this.skillDir, { recursive: true });

      // Copy skill templates
      const templatesDir = path.join(__dirname, 'templates');

      const executeTaskTemplate = await fs.readFile(
        path.join(templatesDir, 'execute-task.md'),
        'utf-8'
      );
      await fs.writeFile(
        path.join(this.skillDir, 'execute-task.md'),
        executeTaskTemplate
      );

      const validateOutputTemplate = await fs.readFile(
        path.join(templatesDir, 'validate-output.md'),
        'utf-8'
      );
      await fs.writeFile(
        path.join(this.skillDir, 'validate-output.md'),
        validateOutputTemplate
      );
    } catch (error) {
      throw new SkillInstallError(
        'Failed to install skills',
        error
      );
    }
  }

  async uninstall(): Promise<void> {
    try {
      await fs.rm(this.skillDir, { recursive: true, force: true });
    } catch (error) {
      throw new SkillInstallError(
        'Failed to uninstall skills',
        error
      );
    }
  }
}
