import { publicProcedure } from "@/backend/trpc/create-context";
import { BUILD_ID, APP_VERSION, APP_FEATURES } from "@/constants/appVersion";

export const getSnapshotBuildStatusRoute = publicProcedure.query(() => {
  return {
    buildId: BUILD_ID,
    appVersion: APP_VERSION,
    features: APP_FEATURES,
    status: "operational",
    timestamp: new Date().toISOString(),
  };
});
