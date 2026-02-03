import * as fs from 'fs/promises';
import { ProgressEntry, ProgressLog } from '../types';

export class ProgressTracker {
  static async initialize(path: string): Promise<void> {
    const content = `# Ralph Progress Log
Started: ${new Date().toISOString()}
---

`;
    await fs.writeFile(path, content);
  }

  static async append(path: string, entry: ProgressEntry): Promise<void> {
    const timestamp = new Date().toISOString();
    const content = `
## ${timestamp} - ${entry.storyId}
- ${entry.summary}
- Files changed: ${entry.filesChanged.join(', ')}
- **Learnings for future iterations:**
${entry.learnings.map(l => `  - ${l}`).join('\n')}
---
`;

    await fs.appendFile(path, content);
  }

  static async read(path: string): Promise<ProgressLog> {
    try {
      const content = await fs.readFile(path, 'utf-8');

      // Parse entries (simple parsing)
      const entries: ProgressEntry[] = [];
      const learnings: string[] = [];
      const patterns: string[] = [];

      // Split by entry markers
      const entryBlocks = content.split(/^## /m).filter(block => block.trim());

      for (const block of entryBlocks) {
        // Extract story ID from first line
        const firstLine = block.split('\n')[0];
        const storyIdMatch = firstLine.match(/ - ([A-Z]+-\d+)/);

        if (storyIdMatch) {
          const storyId = storyIdMatch[1];
          const lines = block.split('\n').slice(1);
          const summary = lines[0]?.replace(/^- /, '') || '';

          entries.push({
            storyId,
            summary,
            filesChanged: [],
            learnings: []
          });
        }

        // Extract learnings
        const learningMatches = block.matchAll(/^\s+- (.+)/gm);
        for (const match of learningMatches) {
          if (match[1]) {
            learnings.push(match[1]);
          }
        }
      }

      return { entries, learnings, patterns };
    } catch {
      return { entries: [], learnings: [], patterns: [] };
    }
  }
}
