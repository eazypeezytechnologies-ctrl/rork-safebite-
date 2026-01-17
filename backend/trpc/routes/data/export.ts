import { publicProcedure } from '@/backend/trpc/create-context';
import { Database } from '@/backend/db/schema';

export const exportDataRoute = publicProcedure
  .query(async () => {
    return await Database.exportData();
  });
