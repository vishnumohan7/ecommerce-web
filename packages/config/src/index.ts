import { z } from 'zod';
export const runtimeConfigSchema = z.object({ apiUrl: z.string().url() });
