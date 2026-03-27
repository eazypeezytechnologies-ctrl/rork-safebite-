import { publicProcedure } from '@/backend/trpc/create-context';
import { ProductService } from '@/backend/services/productService';
import { z } from 'zod';

export const getProductByBarcodeRoute = publicProcedure
  .input(z.object({
    barcode: z.string(),
    forceRefresh: z.boolean().optional(),
  }))
  .query(async ({ input }) => {
    return await ProductService.getProductByBarcode(input.barcode, input.forceRefresh);
  });
