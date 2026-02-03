import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileManager } from '../../src/files/file-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('FileManager', () => {
  let fileManager: FileManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    fileManager = new FileManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create task directory with artifacts subdirectory', async () => {
    const taskId = 'test-task-123';
    const taskDir = await fileManager.createTaskDir(taskId);

    expect(taskDir).toContain(`task-${taskId}`);
    const stats = await fs.stat(taskDir);
    expect(stats.isDirectory()).toBe(true);

    const artifactsDir = path.join(taskDir, 'artifacts');
    const artifactsStats = await fs.stat(artifactsDir);
    expect(artifactsStats.isDirectory()).toBe(true);
  });

  it('should write task specification', async () => {
    const taskDir = await fileManager.createTaskDir('test-123');
    const spec = {
      prompt: 'Test prompt',
      variables: { key: 'value' }
    };

    await fileManager.writeTaskSpec(taskDir, spec);

    const content = await fs.readFile(
      path.join(taskDir, 'instructions.json'),
      'utf-8'
    );
    expect(JSON.parse(content)).toEqual(spec);
  });

  it('should write schema file', async () => {
    const taskDir = await fileManager.createTaskDir('test-123');
    const schema = {
      type: 'object',
      properties: {
        result: { type: 'string' }
      }
    };

    await fileManager.writeSchema(taskDir, schema);

    const content = await fs.readFile(
      path.join(taskDir, 'schema.json'),
      'utf-8'
    );
    expect(JSON.parse(content)).toEqual(schema);
  });

  it('should read result file', async () => {
    const taskDir = await fileManager.createTaskDir('test-123');
    const result = { data: 'test result' };

    await fs.writeFile(
      path.join(taskDir, 'result.json'),
      JSON.stringify(result)
    );

    const readResult = await fileManager.readResult(taskDir);
    expect(readResult).toEqual(result);
  });

  it('should list artifacts', async () => {
    const taskDir = await fileManager.createTaskDir('test-123');
    const artifactsDir = path.join(taskDir, 'artifacts');

    await fs.writeFile(path.join(artifactsDir, 'file1.ts'), 'content1');
    await fs.writeFile(path.join(artifactsDir, 'file2.ts'), 'content2');

    const artifacts = await fileManager.listArtifacts(taskDir);
    expect(artifacts).toHaveLength(2);
    expect(artifacts).toContain(path.join(artifactsDir, 'file1.ts'));
    expect(artifacts).toContain(path.join(artifactsDir, 'file2.ts'));
  });
});
