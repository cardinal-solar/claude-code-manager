import { describe, it, expect } from 'vitest';
import { ClaudeCodeManager } from '../src/manager';
import * as os from 'os';

describe('ClaudeCodeManager', () => {
  it('should initialize with default config', () => {
    const manager = new ClaudeCodeManager();
    expect(manager).toBeDefined();
  });

  it('should initialize with custom config', () => {
    const manager = new ClaudeCodeManager({
      claudeCodePath: '/custom/path/claude',
      tempDir: '/tmp/custom'
    });
    expect(manager).toBeDefined();
  });
});
