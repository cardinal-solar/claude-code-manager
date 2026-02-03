import { z } from 'zod';

export class ClaudeCodeError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ClaudeCodeError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ClaudeCodeError {
  constructor(
    message: string,
    public zodError: z.ZodError
  ) {
    super(message, 'VALIDATION_ERROR', zodError.format());
    this.name = 'ValidationError';
  }
}

export class ProcessTimeoutError extends ClaudeCodeError {
  constructor(public timeoutMs: number) {
    super(
      `Process timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      { timeoutMs }
    );
    this.name = 'ProcessTimeoutError';
  }
}

export class TaskIncompleteError extends ClaudeCodeError {
  constructor(
    public completedTasks: number,
    public totalTasks: number
  ) {
    super(
      `Only ${completedTasks}/${totalTasks} tasks completed`,
      'INCOMPLETE',
      { completedTasks, totalTasks }
    );
    this.name = 'TaskIncompleteError';
  }
}

export class ProcessError extends ClaudeCodeError {
  constructor(
    message: string,
    public exitCode: number | null,
    public signal: NodeJS.Signals | null
  ) {
    super(message, 'PROCESS_ERROR', { exitCode, signal });
    this.name = 'ProcessError';
  }
}

export class SkillInstallError extends ClaudeCodeError {
  constructor(message: string, details?: any) {
    super(message, 'SKILL_INSTALL_ERROR', details);
    this.name = 'SkillInstallError';
  }
}
