import * as fs from 'fs/promises';
import * as path from 'path';

export class FileManager {
  constructor(private tempDir: string) {}

  async createTaskDir(taskId: string): Promise<string> {
    const taskDir = path.join(this.tempDir, `task-${taskId}`);
    await fs.mkdir(taskDir, { recursive: true });
    await fs.mkdir(path.join(taskDir, 'artifacts'), { recursive: true });
    return taskDir;
  }

  async writeTaskSpec(taskDir: string, spec: any): Promise<void> {
    const filePath = path.join(taskDir, 'instructions.json');
    await fs.writeFile(filePath, JSON.stringify(spec, null, 2));
  }

  async writeSchema(taskDir: string, schema: any): Promise<void> {
    const filePath = path.join(taskDir, 'schema.json');
    await fs.writeFile(filePath, JSON.stringify(schema, null, 2));
  }

  async readResult(taskDir: string): Promise<any> {
    const filePath = path.join(taskDir, 'result.json');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  async listArtifacts(taskDir: string): Promise<string[]> {
    const artifactsDir = path.join(taskDir, 'artifacts');
    try {
      const files = await fs.readdir(artifactsDir);
      return files.map(file => path.join(artifactsDir, file));
    } catch {
      return [];
    }
  }

  async cleanup(taskDir: string): Promise<void> {
    await fs.rm(taskDir, { recursive: true, force: true });
  }
}
