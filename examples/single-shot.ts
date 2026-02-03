import { ClaudeCodeManager } from '../src';
import { z } from 'zod';

async function main() {
  const manager = new ClaudeCodeManager();

  const componentSchema = z.object({
    code: z.string(),
    tests: z.array(z.string()),
    dependencies: z.array(z.string())
  });

  console.log('Executing single-shot task...');

  const result = await manager.execute({
    prompt: 'Create a React UserCard component with avatar, name, and email',
    variables: {
      styling: 'tailwind'
    },
    schema: componentSchema,
    onOutput: (chunk) => process.stdout.write(chunk)
  });

  if (result.success && result.data) {
    console.log('\n✅ Task completed successfully!');
    console.log('\nGenerated code:');
    console.log(result.data.code);
    console.log('\nTests:', result.data.tests);
    console.log('\nDependencies:', result.data.dependencies);
  } else {
    console.error('❌ Task failed:', result.error);
  }
}

main().catch(console.error);
