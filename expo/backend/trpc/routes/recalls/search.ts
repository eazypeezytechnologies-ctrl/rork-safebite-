import { publicProcedure } from '@/backend/trpc/create-context';
import { RecallService } from '@/backend/services/recallService';
import { z } from 'zod';

export const searchRecallsRoute = publicProcedure
  .input(z.object({
    query: z.string(),
  }))
  .query(async ({ input }) => {
    return await RecallService.searchRecalls(input.query);
  });
