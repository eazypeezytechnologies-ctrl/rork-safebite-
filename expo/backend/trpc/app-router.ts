import { createTRPCRouter } from "@/backend/trpc/create-context";
import hiRoute from "@/backend/trpc/routes/example/hi/route";
import { getProductByBarcodeRoute } from "@/backend/trpc/routes/products/getByBarcode";
import { searchProductsRoute } from "@/backend/trpc/routes/products/search";
import { getPopularProductsRoute } from "@/backend/trpc/routes/products/popular";
import { getRecentProductsRoute } from "@/backend/trpc/routes/products/recent";
import { productLookupRoute } from "@/backend/trpc/routes/products/lookup";
import { searchRecallsRoute } from "@/backend/trpc/routes/recalls/search";
import { searchRecallsByBarcodeRoute } from "@/backend/trpc/routes/recalls/searchByBarcode";
import { trackEventRoute } from "@/backend/trpc/routes/analytics/track";
import { getStatsRoute } from "@/backend/trpc/routes/analytics/stats";
import { listProfilesRoute } from "@/backend/trpc/routes/profiles/list";
import { createProfileRoute } from "@/backend/trpc/routes/profiles/create";
import { updateProfileRoute } from "@/backend/trpc/routes/profiles/update";
import { deleteProfileRoute } from "@/backend/trpc/routes/profiles/delete";
import { exportDataRoute } from "@/backend/trpc/routes/data/export";
import { importDataRoute } from "@/backend/trpc/routes/data/import";
import { scanProductRoute } from "@/backend/trpc/routes/scan";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  products: createTRPCRouter({
    getByBarcode: getProductByBarcodeRoute,
    search: searchProductsRoute,
    popular: getPopularProductsRoute,
    recent: getRecentProductsRoute,
    lookup: productLookupRoute,
  }),
  recalls: createTRPCRouter({
    search: searchRecallsRoute,
    searchByBarcode: searchRecallsByBarcodeRoute,
  }),
  analytics: createTRPCRouter({
    track: trackEventRoute,
    stats: getStatsRoute,
  }),
  profiles: createTRPCRouter({
    list: listProfilesRoute,
    create: createProfileRoute,
    update: updateProfileRoute,
    delete: deleteProfileRoute,
  }),
  data: createTRPCRouter({
    export: exportDataRoute,
    import: importDataRoute,
  }),
  scan: scanProductRoute,
});

export type AppRouter = typeof appRouter;