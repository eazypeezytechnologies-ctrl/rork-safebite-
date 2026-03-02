import { publicProcedure } from '@/backend/trpc/create-context';
import { Database } from '@/storage/database';
import { z } from 'zod';

export const importDataRoute = publicProcedure
  .input(z.object({
    jsonData: z.string(),
  }))
  .mutation(async ({ input }) => {
    await Database.importData(input.jsonData);
    return { success: true };
  });
