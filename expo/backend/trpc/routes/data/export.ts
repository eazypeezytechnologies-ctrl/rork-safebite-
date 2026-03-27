import { publicProcedure } from '@/backend/trpc/create-context';
import { Database } from '@/storage/database';

export const exportDataRoute = publicProcedure
  .query(async () => {
    return await Database.exportData();
  });
