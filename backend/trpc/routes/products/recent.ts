import { publicProcedure } from '@/backend/trpc/create-context';
import { ProductService } from '@/backend/services/productService';
import { z } from 'zod';

export const getRecentProductsRoute = publicProcedure
  .input(z.object({
    limit: z.number().optional(),
  }))
  .query(async ({ input }) => {
    return await ProductService.getRecentProducts(input.limit);
  });
