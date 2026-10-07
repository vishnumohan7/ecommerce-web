import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const run = (args: string[]) => { const result = spawnSync(pnpm, args, { stdio: 'inherit', env: process.env }); if (result.status !== 0) process.exit(result.status ?? 1); };
if (!existsSync('apps/api/.env') && !process.env.DATABASE_URL) {
  console.error('Create apps/api/.env from .env.example and configure DATABASE_URL/DIRECT_URL first.');
  process.exit(1);
}
run(['check:env']);
run(['--filter', '@app/api', 'exec', 'prisma', 'generate']);
run(['db:migrate:deploy']);
run(['db:seed:minimal']);
console.log('Denes Commerce setup complete. Run: pnpm dev');
