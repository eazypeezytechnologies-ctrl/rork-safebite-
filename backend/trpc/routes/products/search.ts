import { publicProcedure } from '@/backend/trpc/create-context';
import { ProductService } from '@/backend/services/productService';
import { z } from 'zod';

export const searchProductsRoute = publicProcedure
  .input(z.object({
    query: z.string(),
    page: z.number().optional(),
  }))
  .query(async ({ input }) => {
    return await ProductService.searchProducts(input.query, input.page);
  });
