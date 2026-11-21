import { Injectable } from '@nestjs/common';

type ResetHook = () => void | Promise<void>;

/**
 * POST /api/demo/reset restores every module's seed. Modules register a hook
 * here instead of depending on each other.
 */
@Injectable()
export class DemoReset {
  private readonly hooks: ResetHook[] = [];

  register(hook: ResetHook): void {
    this.hooks.push(hook);
  }

  async run(): Promise<void> {
    for (const hook of this.hooks) await hook();
  }
}
