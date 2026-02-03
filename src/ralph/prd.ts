import * as fs from 'fs/promises';
import { PRDSpec, UserStory } from '../types';

export class PRD {
  private constructor(private spec: PRDSpec) {}

  static create(spec: PRDSpec): PRD {
    return new PRD(spec);
  }

  static async load(path: string): Promise<PRD> {
    const content = await fs.readFile(path, 'utf-8');
    const spec = JSON.parse(content) as PRDSpec;
    return new PRD(spec);
  }

  async save(path: string): Promise<void> {
    await fs.writeFile(path, JSON.stringify(this.spec, null, 2));
  }

  getProject(): string {
    return this.spec.project;
  }

  getBranchName(): string {
    return this.spec.branchName;
  }

  getUserStories(): UserStory[] {
    return this.spec.userStories;
  }

  getNextStory(): UserStory | null {
    const incomplete = this.spec.userStories.filter(s => !s.passes);

    if (incomplete.length === 0) {
      return null;
    }

    // Sort by priority (lower number = higher priority)
    incomplete.sort((a, b) => a.priority - b.priority);

    return incomplete[0];
  }

  updateStory(id: string, updates: Partial<UserStory>): void {
    const story = this.spec.userStories.find(s => s.id === id);
    if (story) {
      Object.assign(story, updates);
    }
  }

  isComplete(): boolean {
    return this.spec.userStories.every(s => s.passes);
  }

  getProgress(): { completed: number; total: number } {
    const completed = this.spec.userStories.filter(s => s.passes).length;
    return { completed, total: this.spec.userStories.length };
  }
}
