# Claude Code Manager

A Node.js library for programmatically managing Claude Code processes with both single-shot and Ralph-compatible loop execution modes.

## Features

- **Dual Execution Modes**: Single-shot and loop-based (Ralph-compatible)
- **Schema Validation**: Zod integration for type-safe output validation
- **Structured Output**: Organized temp directories with result.json, logs, artifacts
- **Skill-Based Bridge**: Claude Code skill for structured I/O
- **Error Handling**: Configurable strategies (fail-fast, retry, graceful, custom)
- **Process Control**: Adaptive - simple for single-shot, full control for loops
- **Ralph Compatibility**: Full support for prd.json/rrd.json workflows
- **TypeScript-First**: Full type safety and IntelliSense support

## Installation

```bash
npm install claude-code-manager
```

Requires `@anthropic-ai/claude-code` to be installed:

```bash
npm install -g @anthropic-ai/claude-code
```

## Quick Start

### Single-Shot Execution

```typescript
import { ClaudeCodeManager } from 'claude-code-manager';
import { z } from 'zod';

const manager = new ClaudeCodeManager();

const schema = z.object({
  code: z.string(),
  tests: z.array(z.string())
});

const result = await manager.execute({
  prompt: 'Create a React UserCard component',
  variables: { styling: 'tailwind' },
  schema
});

console.log('Component:', result.data.code);
```

### Loop Execution (Ralph-Compatible)

```typescript
const result = await manager.executeLoop({
  taskFile: './prd.json',
  maxIterations: 10,
  onIteration: (iter) => {
    console.log(`Iteration ${iter.iteration}: ${iter.taskId}`);
  }
});

if (result.completed) {
  console.log('All tasks completed!');
}
```

## Documentation

See the [examples](./examples) directory for more usage examples.

## License

MIT
