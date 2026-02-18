import { spawn } from 'child_process';
import { ProcessTimeoutError } from '../errors';

export interface RunOptions {
  command: string;
  args?: string[];
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface RunResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  output: string;
  error: string;
  duration: number;
}

export class ProcessRunner {
  async run(options: RunOptions): Promise<RunResult> {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    return new Promise((resolve, reject) => {
      const childProcess = spawn(options.command, options.args || [], {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdio: ['ignore', 'pipe', 'pipe'] // stdin ignore, stdout/stderr pipe
      });

      childProcess.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      childProcess.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      let timeoutId: NodeJS.Timeout | undefined;

      if (options.timeout) {
        timeoutId = setTimeout(() => {
          childProcess.kill('SIGTERM');
          reject(new ProcessTimeoutError(options.timeout!));
        }, options.timeout);
      }

      childProcess.on('close', (code, signal) => {
        if (timeoutId) clearTimeout(timeoutId);

        resolve({
          exitCode: code,
          signal,
          output: stdout,
          error: stderr,
          duration: Date.now() - startTime
        });
      });

      childProcess.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
    });
  }
}
