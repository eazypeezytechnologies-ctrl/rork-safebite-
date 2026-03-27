import { publicProcedure } from '@/backend/trpc/create-context';
import { RecallService } from '@/backend/services/recallService';
import { z } from 'zod';

export const searchRecallsByBarcodeRoute = publicProcedure
  .input(z.object({
    barcode: z.string(),
  }))
  .query(async ({ input }) => {
    return await RecallService.searchRecallsByBarcode(input.barcode);
  });
