import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Supabase's free session pool allows 15 clients. Test files each own a
    // Prisma client, so run files sequentially while preserving concurrency
    // inside the explicit 30/50-racer invariant tests.
    fileParallelism: false,
  },
});
