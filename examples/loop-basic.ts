import { ClaudeCodeManager } from '../src';

async function main() {
  const manager = new ClaudeCodeManager();

  console.log('Starting Ralph-compatible loop execution...');

  const result = await manager.executeLoop({
    taskFile: './prd.json',
    maxIterations: 10,
    mode: 'code',
    streamOutput: true,
    onIteration: (iter) => {
      console.log(`\n=== Iteration ${iter.iteration} ===`);
      console.log(`Task: ${iter.taskId}`);

      if (iter.commits?.length) {
        console.log(`Commits: ${iter.commits.join(', ')}`);
      }
    }
  });

  if (result.completed) {
    console.log('\n✅ All tasks completed!');
    console.log(`Total iterations: ${result.iterations.length}`);
    console.log(`Duration: ${result.totalDuration}ms`);
  } else {
    console.log('\n⚠️ Loop ended before completion');
    console.log(`Completed: ${result.finalState.tasksCompleted}/${result.finalState.tasksTotal}`);
  }
}

main().catch(console.error);
